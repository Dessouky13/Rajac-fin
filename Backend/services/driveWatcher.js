const { google } = require('googleapis');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const studentService = require('./studentService');
const googleDrive = require('./googleDrive');
const googleSheets = require('./googleSheets');

class DriveWatcher {
  constructor() {
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.uploadFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    // archive mode: 'drive' (default) or 'sheet' (skip Drive archive, mark in sheet only)
    this.archiveMode = (process.env.GOOGLE_DRIVE_ARCHIVE_MODE || 'drive').toLowerCase();
    this.processedFiles = new Set();
  }

  async watchAndProcess() {
    try {
      console.log('🔍 Checking Google Drive for new student files...');
      // Load processed file IDs from sheet to avoid re-processing when Drive archive isn't permitted
      let processedFromSheet = [];
      try {
        const rows = await googleSheets.getSheetData('Processed_Files');
        // rows: header optional; assume first column is fileId
        processedFromSheet = (rows || []).slice(1).map(r => (r && r[0]) ? r[0] : null).filter(Boolean);
      } catch (err) {
        console.warn('Processed_Files sheet not found or unreadable; will create on first append');
        processedFromSheet = [];
      }

      const files = await this.getUnprocessedFiles();
      if (files.length === 0) {
        console.log('✅ No new files to process');
        return { filesProcessed: 0 };
      }
      console.log(`📄 Found ${files.length} new file(s) to process`);
      const results = [];
      for (const file of files) {
        // skip if recorded in Processed_Files sheet or previous runtime set
        if (this.processedFiles.has(file.id) || processedFromSheet.includes(file.id)) {
          console.log(`Skipping already-processed file: ${file.name} (${file.id})`);
          continue;
        }
        try {
          console.log(`Processing: ${file.name}`);
          const result = await this.processFile(file);
          results.push(result);
          // mark processed in sheet (create sheet if needed)
          try {
            await googleSheets.createSheetIfNotExists('Processed_Files');
            await googleSheets.appendRows('Processed_Files', [[file.id, file.name, new Date().toISOString()]]);
          } catch (sheetErr) {
            console.warn('Could not append to Processed_Files sheet:', sheetErr.message || sheetErr);
          }

          // Archival behavior: either perform Drive archive (default) or skip and rely on Processed_Files sheet.
          if (this.archiveMode === 'sheet') {
            console.log('Archive mode is set to sheet; skipping Drive archive for', file.name);
          } else {
            // Try to archive using the shared googleDrive helper if available,
            // otherwise fall back to a local implementation using this.drive.
            try {
              if (googleDrive && typeof googleDrive.archiveFile === 'function') {
                await googleDrive.archiveFile(file.id);
              } else {
                console.warn('googleDrive.archiveFile not available, using fallback archive');
                await this.fallbackArchiveFile(file.id);
              }
            } catch (archiveErr) {
              // detect quota/permission errors that indicate service account cannot perform Drive writes
              const reason = archiveErr && archiveErr.errors && archiveErr.errors[0] && archiveErr.errors[0].reason;
              if (reason === 'storageQuotaExceeded') {
                console.error('Drive archival blocked: service account storage/quota limitation detected (storageQuotaExceeded).');
                console.error('Remediation: move the upload/archive folders into a Shared Drive and add the service account as a member, or use OAuth user-delegation.');
                console.error('Falling back to sheet-only archival mode for this run.');
                // switch to sheet mode for remainder of this run so processing continues
                this.archiveMode = 'sheet';
              } else {
                console.error('Error archiving file (helper):', archiveErr.message || archiveErr);
                // attempt fallback once more
                try {
                  await this.fallbackArchiveFile(file.id);
                } catch (finalErr) {
                  console.error('Final archive attempt failed:', finalErr && finalErr.message ? finalErr.message : finalErr);
                }
              }
            }
            }
          this.processedFiles.add(file.id);
          console.log(`✅ Successfully processed: ${file.name}`);
        } catch (error) {
          console.error(`❌ Error processing ${file.name}:`, error.message);
          results.push({
            fileName: file.name,
            success: false,
            error: error.message
          });
        }
      }
      return {
        filesProcessed: results.filter(r => r.success).length,
        filesFailed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error('Error in Drive watcher:', error);
      throw error;
    }
  }

  async fallbackArchiveFile(fileId) {
    try {
      // Prefer explicit archive folder id from env if provided
      let archiveFolderId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || null;
      if (!archiveFolderId) {
        // ensure Archive folder exists (create if needed)
        const folderRes = await this.drive.files.list({
          q: `name='Archive' and '${this.uploadFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
          fields: 'files(id, name)'
        });

        if (folderRes.data.files && folderRes.data.files.length > 0) {
          archiveFolderId = folderRes.data.files[0].id;
        } else {
          const createRes = await this.drive.files.create({
            resource: {
              name: 'Archive',
              mimeType: 'application/vnd.google-apps.folder',
              parents: [this.uploadFolderId]
            },
            fields: 'id'
          });
          archiveFolderId = createRes.data.id;
        }
      }

      console.log('Using archiveFolderId:', archiveFolderId);

      const file = await this.drive.files.get({ fileId, fields: 'parents' });
      const previousParentsArr = file.data.parents || [];
      const previousParents = previousParentsArr.join(',');

      const updateParams = {
        fileId,
        addParents: archiveFolderId,
        fields: 'id, parents'
      };
      if (previousParents && previousParents.length > 0) {
        updateParams.removeParents = previousParents;
      }

      try {
        await this.drive.files.update(updateParams);
        console.log(`File ${fileId} archived (fallback) successfully`);
        return true;
      } catch (err) {
        // If increasing parents is not allowed (shared drive or root), try copy+delete fallback
        if (err && err.errors && err.errors[0] && err.errors[0].reason === 'cannotAddParent') {
          console.warn('Cannot add parent when archiving — trying copy+delete fallback');
          // copy file into archive folder
          const copyRes = await this.drive.files.copy({
            fileId,
            resource: { parents: [archiveFolderId] },
            fields: 'id'
          });
          // delete original
          await this.drive.files.delete({ fileId });
          console.log(`File ${fileId} archived (copied then deleted) successfully`);
          return true;
        }
        throw err;
      }
    } catch (error) {
      console.error('Error in fallbackArchiveFile:', error);
      throw error;
    }
  }

  async getUnprocessedFiles() {
    try {
      const response = await this.drive.files.list({
        q: `'${this.uploadFolderId}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false`,
        fields: 'files(id, name, createdTime, mimeType)',
        orderBy: 'createdTime desc'
      });
      const allFiles = response.data.files || [];
      const unprocessedFiles = allFiles.filter(file => !this.processedFiles.has(file.id));
      return unprocessedFiles;
    } catch (error) {
      console.error('Error getting files from Drive:', error);
      throw error;
    }
  }

  async processFile(file) {
    try {
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFilePath = path.join(tempDir, file.name);
      const dest = fs.createWriteStream(tempFilePath);
      const response = await this.drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'stream' }
      );
      await new Promise((resolve, reject) => {
        response.data
          .on('end', () => resolve())
          .on('error', err => reject(err))
          .pipe(dest);
      });
  const students = this.extractStudentData(tempFilePath);
  console.log(`DEBUG: Parsed ${students.length} student record(s) from ${file.name}:`, JSON.stringify(students, null, 2));
      const processedStudents = students.map(student => {
        const name = student.studentName || student.sheetName || student.Name || '';
        const yearVal = student.year || student.Year || student.Grade || '';
        const year = yearVal ? String(yearVal) : '0';
        const totalFeesVal = student.totalFees || student.Total_Fees || student['TOTAL Fees'] || student.Amount || 0;
        const totalFees = parseFloat(totalFeesVal || 0) || 0;
        const phoneRaw = student.phone || student.Phone || student['Phone Number'] || '';

        return {
          studentId: this.generateStudentId(),
          name: name,
          year: year,
          numberOfSubjects: student.numSubjects || student['Number of Subjects'] || student.Subjects || 0,
          totalFees: totalFees,
          phoneNumber: this.formatPhoneNumber(phoneRaw),
          enrollmentDate: new Date().toISOString().split('T')[0],
          discountPercent: 0,
          discountAmount: 0,
          netAmount: totalFees,
          totalPaid: 0,
          remainingBalance: totalFees,
          status: 'Active'
        };
      });
      await studentService.saveStudentsToSheets(processedStudents);
      fs.unlinkSync(tempFilePath);
      return {
        fileName: file.name,
        success: true,
        studentsProcessed: processedStudents.length,
        students: processedStudents
      };
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      throw error;
    }
  }

  extractStudentData(filePath) {
    // Robust semi-structured extraction for student invoices
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetNames = workbook.SheetNames;
    const results = [];

    function cleanSubject(s) {
      if (!s) return null;
      let txt = String(s).trim();
      txt = txt.replace(/^[\-\u2022\.\d\)\s]+/, "");
      txt = txt.replace(/\s+/g, " ");
      txt = txt.replace(/(\s+\d[\d,\.]*)+$/, "");
      txt = txt.replace(/[:\.\-]+$/, "");
      return txt || null;
    }

    sheetNames.forEach((sheetName) => {
      const ws = workbook.Sheets[sheetName];

      // Try table parsing first: sheet_to_json with header row
      const tableRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const looksLikeTable = Array.isArray(tableRows) && tableRows.length > 0 && (
        Object.keys(tableRows[0]).some(k => /name|student|full name|student name/i.test(k)) ||
        Object.keys(tableRows[0]).some(k => /phone|mobile|contact/i.test(k)) ||
        Object.keys(tableRows[0]).some(k => /fee|total/i.test(k)) ||
        Object.keys(tableRows[0]).some(k => /year|grade|class/i.test(k))
      );

      if (looksLikeTable) {
        console.log(`DEBUG: Parsing sheet '${sheetName}' as table with ${tableRows.length} rows`);
        tableRows.forEach(rowObj => {
          // Normalize common key names to expected fields
          const name = rowObj.Name || rowObj.name || rowObj['Student Name'] || rowObj['Full Name'] || rowObj['studentName'] || '';
          let phone = rowObj.Phone || rowObj.phone || rowObj['Phone Number'] || rowObj.Mobile || '';
          // fallback: search any value in the row for a phone-like pattern
          if (!phone || String(phone).trim() === '') {
            const phoneRegex = /(\+?\d[\d\-\s\(\)]{6,}\d)/;
            for (const v of Object.values(rowObj)) {
              if (v && String(v).match && String(v).match(phoneRegex)) {
                phone = String(v).match(phoneRegex)[0];
                break;
              }
            }
          }
          const year = rowObj.Year || rowObj.year || rowObj.Grade || rowObj.Class || '';
          const numSubjects = rowObj.Number_of_Subjects || rowObj['Number of Subjects'] || rowObj.subjects || 0;
          const totalFees = rowObj.Total_Fees || rowObj.totalFees || rowObj.Fees || rowObj.Amount || null;

          if (name && String(name).trim()) {
            results.push({
              sheetName,
              studentName: String(name).trim(),
              phone: phone || null,
              year: year || null,
              numSubjects: Number(numSubjects) || 0,
              subjects: [],
              totalFees: totalFees === '' ? null : (totalFees === null ? null : Number(totalFees))
            });
          }
        });
        return; // next sheet
      }

      // Fallback: invoice-style / freeform parsing (previous logic)
      const sheet = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      const bigText = sheet.map((row) => row.join(' | ')).join('\n');
      const studentName = sheetName.trim();

      // Phone
      let phone = null;
      const phoneMatch = bigText.match(/Phone[:\s]*\[?([^\]\n\r]+)\]?/i);
      if (phoneMatch) {
        phone = phoneMatch[1].trim();
      } else {
        const generic = bigText.match(/(\+?\d[\d\-\s\(\)]{6,}\d)/);
        if (generic) phone = generic[1].trim();
      }

      // Year
      let year = null;
      for (let r = 0; r < sheet.length; r++) {
        for (let c = 0; c < sheet[r].length; c++) {
          const cell = String(sheet[r][c] || '').toUpperCase();
          if (cell.includes('YEAR') || cell.includes('GRADE') || cell.includes('CLASS')) {
            const neighbors = [
              sheet[r][c + 1],
              sheet[r][c - 1],
              (sheet[r + 1] || [])[c],
              (sheet[r - 1] || [])[c],
            ].filter(Boolean);
            for (let n of neighbors) {
              const m = String(n).match(/\b([1-9]|1[0-2])\b/);
              if (m) {
                year = parseInt(m[1], 10);
                break;
              }
            }
          }
          if (year) break;
        }
        if (year) break;
      }

      // Subjects
      let subjects = [];
      let subjectCol = null;
      let headerRow = null;

      for (let r = 0; r < sheet.length; r++) {
        for (let c = 0; c < sheet[r].length; c++) {
          if (String(sheet[r][c]).match(/SUBJECTS?/i)) {
            subjectCol = c;
            headerRow = r;
            break;
          }
        }
        if (subjectCol !== null) break;
      }

      if (subjectCol !== null) {
        for (let r = headerRow + 1; r < sheet.length; r++) {
          const rowText = sheet[r].join(' ').trim();
          if (!rowText) break;
          if (/TOTAL/i.test(rowText)) break;

          const subj = cleanSubject(sheet[r][subjectCol]);
          if (subj) {
            if (!/^[A-Z0-9\.\s]{1,3}$/.test(subj)) {
              if (!subjects.some((s) => s.toUpperCase() === subj.toUpperCase())) {
                subjects.push(subj);
              }
            }
          }
        }
      }

      // Total fees
      let totalFees = null;
      for (let r = 0; r < sheet.length; r++) {
        const rowText = sheet[r].join(' ');
        if (/TOTAL/i.test(rowText)) {
          const nums = rowText.match(/\d[\d,]*(?:\.\d+)?/g);
          if (nums && nums.length) {
            const chosen = nums.sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)[0];
            totalFees = parseFloat(chosen.replace(/,/g, ''));
          }
          break;
        }
      }

      results.push({
        sheetName,
        studentName,
        phone,
        year,
        numSubjects: subjects.length,
        subjects,
        totalFees,
      });
    });

    return results;
  }

  generateStudentId() {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `STU${year}${random}`;
  }

  formatPhoneNumber(phone) {
    let cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.startsWith('20')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '20' + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      return '20' + cleaned;
    }
    return cleaned;
  }

  async getProcessingStatus() {
    try {
      const allFiles = await this.drive.files.list({
        q: `'${this.uploadFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, createdTime, parents)',
        orderBy: 'createdTime desc',
        pageSize: 20
      });
      const archiveFolders = await this.drive.files.list({
        q: `name='Archive' and '${this.uploadFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id)'
      });
      let archivedFiles = [];
      if (archiveFolders.data.files.length > 0) {
        const archiveFolderId = archiveFolders.data.files[0].id;
        const archived = await this.drive.files.list({
          q: `'${archiveFolderId}' in parents and trashed=false`,
          fields: 'files(id, name, createdTime)',
          orderBy: 'createdTime desc',
          pageSize: 20
        });
        archivedFiles = archived.data.files || [];
      }
      return {
        pendingFiles: allFiles.data.files || [],
        archivedFiles: archivedFiles,
        totalPending: (allFiles.data.files || []).length,
        totalArchived: archivedFiles.length
      };
    } catch (error) {
      console.error('Error getting processing status:', error);
      throw error;
    }
  }
}

module.exports = new DriveWatcher();
