const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const googleSheets = require('./googleSheets');
const googleDrive = require('./googleDrive');
const financeService = require('./financeService');
const paymentDueService = require('./paymentDueService');

class StudentService {
  /**
   * Import an array of student objects (MVP JSON paste import).
   * Each student may include: name, year, numberOfSubjects, totalFees, phoneNumber, enrollmentDate, discountPercent, totalPaid, status
   */
  async importStudentsArray(studentsArray) {
    if (!Array.isArray(studentsArray)) throw new Error('studentsArray must be an array');

    const processed = studentsArray.map(s => {
      const totalFees = Number(s.totalFees || s.Total_Fees || s.fees || s.price || 0) || 0;
      const discountPercent = Number(s.discountPercent || s.Discount_Percent || s.discount || 0) || 0;
      const discountAmount = Number(s.discountAmount || Math.round(totalFees * discountPercent / 100)) || 0;
      const netAmount = Number(s.netAmount || Math.round(totalFees - discountAmount)) || 0;
      const totalPaid = Number(s.totalPaid || s.Total_Paid || s.paid || 0) || 0;
      const remainingBalance = Number(s.remainingBalance || s.Remaining_Balance || Math.round(netAmount - totalPaid)) || 0;

      return {
        studentId: s.studentId || this.generateStudentId(),
        name: s.name || s.Name || '',
        year: s.year || s.Year || '',
        numberOfSubjects: s.numberOfSubjects || s.Number_of_Subjects || s.subjects || 0,
        totalFees,
        phoneNumber: this.formatPhoneNumber(s.phoneNumber || s.Phone_Number || s.phone || ''),
        enrollmentDate: s.enrollmentDate || s.Enrollment_Date || moment().format('YYYY-MM-DD'),
        discountPercent,
        discountAmount,
        netAmount,
        totalPaid,
        remainingBalance,
        status: s.status || s.Status || (remainingBalance <= 0 ? 'Paid' : 'Active')
      };
    });

    // reuse existing saver which creates master sheet rows and per-grade sheets
    const result = await this.saveStudentsToSheets(processed);
    return { 
      success: true, 
      imported: result.totalProcessed,
      studentsAdded: result.studentsAdded,
      studentsUpdated: result.studentsUpdated,
      duplicatesFound: result.duplicatesFound
    };
  }
  async processUploadedFile(filePath, fileName) {
    try {
      const students = this.extractStudentData(filePath);
      // Accept flexible column names
      const processedStudents = students.map(student => ({
        studentId: this.generateStudentId(),
        name: student.Name || student["Student Name"] || student["Full Name"] || student["name"] || '',
        year: student.Year || student.Grade || student.Class || student.Level || '',
        numberOfSubjects: student["Number_of_Subjects"] || student["Number of Subjects"] || student.Subjects || student["Subject Count"] || 0,
        totalFees: parseFloat(student["Total_Fees"] || student["TOTAL Fees"] || student["Total Fees"] || student.Fees || student.Amount || student["Course Fees"] || student.Tuition || 0),
        phoneNumber: this.formatPhoneNumber(student["Phone_Number"] || student["Phone Number"] || student.Phone || student.Mobile || student["Contact Number"] || ''),
        enrollmentDate: moment().format('YYYY-MM-DD'),
        discountPercent: 0,
        discountAmount: 0,
        netAmount: parseFloat(student["Total_Fees"] || student["TOTAL Fees"] || student["Total Fees"] || student.Fees || student.Amount || student["Course Fees"] || student.Tuition || 0),
        totalPaid: 0,
        remainingBalance: parseFloat(student["Total_Fees"] || student["TOTAL Fees"] || student["Total Fees"] || student.Fees || student.Amount || student["Course Fees"] || student.Tuition || 0),
        status: 'Active'
      }));
      const result = await this.saveStudentsToSheets(processedStudents);
      const uploadedFile = await googleDrive.uploadFile(filePath, fileName);
      await googleDrive.archiveFile(uploadedFile.id);
      return {
        success: true,
        studentsProcessed: result.totalProcessed,
        studentsAdded: result.studentsAdded,
        studentsUpdated: result.studentsUpdated,
        duplicatesFound: result.duplicatesFound,
        students: processedStudents
      };
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;
    }
  }

  extractStudentData(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return data;
  }

  generateStudentId() {
    const year = moment().format('YY');
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

  async saveStudentsToSheets(students) {
    // Get existing students from Master_Students to check for duplicates
    const existingStudentsData = await googleSheets.getSheetData('Master_Students');
    const existingStudents = [];
    
    if (existingStudentsData.length > 1) {
      const headers = existingStudentsData[0];
      existingStudents.push(...existingStudentsData.slice(1).map(row => {
        const student = {};
        headers.forEach((header, index) => {
          student[header] = row[index] || '';
        });
        return student;
      }));
    }

    const studentsToAdd = [];
    const studentsToUpdate = [];
    
    // Process each student and check for duplicates
    students.forEach(newStudent => {
      const totalFees = Number(newStudent.totalFees || 0) || 0;
      const discountPercent = Number(newStudent.discountPercent || 0) || 0;
      const discountAmount = Number(newStudent.discountAmount || (totalFees * discountPercent / 100)) || 0;
      const netAmount = Number(newStudent.netAmount || Math.round(totalFees - discountAmount)) || 0;
      const totalPaid = Number(newStudent.totalPaid || 0) || 0;
      const remainingBalance = Number(newStudent.remainingBalance || Math.round(netAmount - totalPaid)) || 0;

      // Check for duplicate: same name and grade
      const duplicate = existingStudents.find(existing => 
        String(existing.Name || '').toLowerCase().trim() === String(newStudent.name || '').toLowerCase().trim() &&
        String(existing.Year || '').toLowerCase().trim() === String(newStudent.year || '').toLowerCase().trim()
      );

      if (duplicate) {
        // Update existing student: only totalFees, netAmount, numberOfSubjects
        console.log(`Found duplicate student: ${newStudent.name} in ${newStudent.year}. Updating fees and subjects.`);
        
        // Keep existing payments and calculated fields, only update specified fields
        const existingTotalPaid = Number(duplicate.Total_Paid || 0) || 0;
        const newRemainingBalance = Math.max(0, netAmount - existingTotalPaid);
        
        studentsToUpdate.push({
          studentId: duplicate.Student_ID,
          name: duplicate.Name,
          year: duplicate.Year,
          numberOfSubjects: newStudent.numberOfSubjects, // Update
          totalFees: totalFees, // Update
          discountPercent: Number(duplicate.Discount_Percent || 0) || 0, // Keep existing
          discountAmount: Number(duplicate.Discount_Amount || 0) || 0, // Keep existing
          netAmount: netAmount, // Update
          totalPaid: existingTotalPaid, // Keep existing
          remainingBalance: newRemainingBalance, // Recalculate
          phoneNumber: duplicate.Phone_Number || '', // Keep existing
          enrollmentDate: duplicate.Enrollment_Date || '', // Keep existing
          status: newRemainingBalance <= 0 ? 'Paid' : (duplicate.Status || 'Active'), // Update based on new balance
          rowIndex: existingStudents.indexOf(duplicate) + 2 // +2 because sheet is 1-indexed and has header
        });
      } else {
        // Add new student
        console.log(`Adding new student: ${newStudent.name} in ${newStudent.year}`);
        studentsToAdd.push({
          studentId: newStudent.studentId,
          name: newStudent.name,
          year: newStudent.year,
          numberOfSubjects: newStudent.numberOfSubjects,
          totalFees,
          discountPercent,
          discountAmount,
          netAmount,
          totalPaid,
          remainingBalance,
          phoneNumber: newStudent.phoneNumber,
          enrollmentDate: newStudent.enrollmentDate,
          status: remainingBalance <= 0 ? 'Paid' : newStudent.status || 'Active'
        });
      }
    });

    // Update duplicate students
    for (const student of studentsToUpdate) {
      const updateRow = [
        student.studentId,
        student.name,
        student.year,
        student.numberOfSubjects,
        student.totalFees,
        student.discountPercent,
        student.discountAmount,
        student.netAmount,
        student.totalPaid,
        student.remainingBalance,
        student.phoneNumber,
        student.enrollmentDate,
        student.status,
        ''
      ];
      
      const range = `Master_Students!A${student.rowIndex}:N${student.rowIndex}`;
      await googleSheets.updateRowRange('Master_Students', range, updateRow);
      console.log(`Updated duplicate student: ${student.name} in row ${student.rowIndex}`);
    }

    // Add new students
    if (studentsToAdd.length > 0) {
      const masterRows = studentsToAdd.map(s => [
        s.studentId,
        s.name,
        s.year,
        s.numberOfSubjects,
        s.totalFees,
        s.discountPercent,
        s.discountAmount,
        s.netAmount,
        s.totalPaid,
        s.remainingBalance,
        s.phoneNumber,
        s.enrollmentDate,
        s.status,
        ''
      ]);

      console.log(`Adding ${studentsToAdd.length} new students to Master_Students`);
      await googleSheets.appendRows('Master_Students', masterRows);
    }

    // Process both new and updated students for grade sheets
    const allProcessedStudents = [...studentsToAdd, ...studentsToUpdate];
    const studentsByYear = allProcessedStudents.reduce((acc, student) => {
      const yearRaw = student.year;
      const year = yearRaw && String(yearRaw).trim() ? String(yearRaw).trim() : 'Unknown';
      if (!acc[year]) acc[year] = [];
      acc[year].push(student);
      return acc;
    }, {});

    for (const [year, yearStudents] of Object.entries(studentsByYear)) {
      // sanitize year to ensure valid sheet name (no empty sheet like 'Grade_')
      // Normalize year to a predictable sheet name. Prefer numeric grade if present (e.g., 'Grade 5' -> 'Grade_5').
      let raw = String(year || '').trim();
      // try to extract numeric grade like 1..12
      const numMatch = raw.match(/(\d{1,3})/);
      let safeYear;
      if (numMatch) {
        safeYear = numMatch[1];
      } else {
        // fallback: replace spaces with underscore and remove unsafe chars
        safeYear = raw.replace(/\s+/g, '_').replace(/[^0-9A-Za-z\-_]/g, '');
        if (!safeYear) safeYear = 'Unknown';
      }
      const sheetName = `Grade_${safeYear}`;
      const yearRows = yearStudents.map(s => [
        s.studentId,
        s.name,
        s.numberOfSubjects,
        s.totalFees,
        s.netAmount,
        s.totalPaid,
        s.remainingBalance,
        s.phoneNumber,
        s.enrollmentDate,
        s.status
      ]);

      try {
        const existingData = await googleSheets.getSheetData(sheetName);
        if (existingData.length === 0) {
          const headers = [
            'Student_ID', 'Name', 'Number_of_Subjects', 'Total_Fees',
            'Net_Amount', 'Total_Paid', 'Remaining_Balance', 'Phone_Number',
            'Enrollment_Date', 'Status'
          ];
          await googleSheets.updateSheetHeaders(sheetName, headers);
        }
        await googleSheets.appendRows(sheetName, yearRows);
        console.log(`Updated ${sheetName} with ${yearRows.length} students (new + updated)`);
      } catch (error) {
        console.error(`Error saving to ${sheetName}:`, error);
      }
    }

    // After saving/importing students, refresh overdue checks so Overdue_Payments is up-to-date
    try {
      await paymentDueService.checkOverduePayments();
    } catch (err) {
      console.error('Warning: failed to run overdue check after saving students:', err && err.message ? err.message : err);
    }
    // Sync per-grade sheets from Master_Students
    try {
      await this.syncGradeSheetsFromMaster();
    } catch (err) {
      console.error('Warning: failed to sync grade sheets after saving students:', err && err.message ? err.message : err);
    }

    // Return summary of what was processed
    return {
      studentsAdded: studentsToAdd.length,
      studentsUpdated: studentsToUpdate.length,
      duplicatesFound: studentsToUpdate.length,
      totalProcessed: studentsToAdd.length + studentsToUpdate.length
    };
  }

  async syncGradeSheetsFromMaster() {
    try {
      const studentsData = await googleSheets.getSheetData('Master_Students');
      if (studentsData.length <= 1) return { synced: 0 };

      const headers = studentsData[0];
      const rows = studentsData.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });

      // Build overdue map from existing Overdue_Payments sheet
      const overdueList = await paymentDueService.getOverdueStudents();
      const overdueMap = {};
      overdueList.forEach(s => {
        overdueMap[s.Student_ID || s.studentId] = {
          daysOverdue: s.Days_Overdue || s.daysOverdue || s.daysOverdue || s.daysOverdue === 0 ? s.Days_Overdue || s.daysOverdue : '',
          dueDate: s.Due_Date || s.dueDate || s.dueDateString || s.dueDate || ''
        };
      });

      // Also get upcoming due dates to compute next due for non-overdue students
      const upcoming = await paymentDueService.getUpcomingDueDates();
      const today = require('moment')();

      const byGrade = {};

      for (const s of rows) {
        const yearRaw = s.Year || s.year || 'Unknown';
        let raw = String(yearRaw || '').trim();
        const numMatch = raw.match(/(\d{1,3})/);
        let safeYear;
        if (numMatch) {
          safeYear = numMatch[1];
        } else {
          safeYear = raw.replace(/\s+/g, '_').replace(/[^0-9A-Za-z\-_]/g, '');
          if (!safeYear) safeYear = 'Unknown';
        }
        const sheetName = `Grade_${safeYear}`;

        const studentId = s.Student_ID || s.studentId || '';
        const name = s.Name || s.name || '';
        const net = parseFloat(s.Net_Amount || s.netAmount || 0) || 0;
        const paid = parseFloat(s.Total_Paid || s.totalPaid || 0) || 0;
        const remaining = parseFloat(s.Remaining_Balance || s.remainingBalance || 0) || 0;
        const phone = s.Phone_Number || s.phoneNumber || '';
        const enroll = s.Enrollment_Date || s.enrollmentDate || '';

        let daysOverdue = '';
        let dueDate = '';
        if (overdueMap[studentId]) {
          daysOverdue = overdueMap[studentId].daysOverdue || '';
          dueDate = overdueMap[studentId].dueDate || '';
        } else {
          // find next upcoming installment date
          const next = upcoming.find(u => new Date(u.date) > new Date());
          if (next) {
            dueDate = next.date;
            daysOverdue = require('moment')(next.date).diff(today, 'days');
          }
        }

        const outRow = [
          studentId,
          name,
          net,
          paid,
          remaining,
          phone,
          enroll,
          daysOverdue,
          dueDate
        ];

        if (!byGrade[sheetName]) byGrade[sheetName] = [];
        byGrade[sheetName].push(outRow);
      }

      // Write to each grade sheet: ensure headers, clear existing data, then append
      const headersOut = ['Student_ID','Name','Net_Amount','Total_Paid','Remaining_Balance','Phone_Number','Enrollment_Date','Days_Overdue','Due_Date'];

      for (const [sheet, rowsArr] of Object.entries(byGrade)) {
        try {
          await googleSheets.updateSheetHeaders(sheet, headersOut);
          await googleSheets.clearSheet(sheet);
          if (rowsArr.length > 0) await googleSheets.appendRows(sheet, rowsArr);
        } catch (err) {
          console.error(`Error writing to grade sheet ${sheet}:`, err && err.message ? err.message : err);
        }
      }

      return { synced: Object.keys(byGrade).length };
    } catch (error) {
      console.error('Error syncing grade sheets from master:', error);
      throw error;
    }
  }

  async getStudentInfo(identifier) {
    const student = await googleSheets.findStudentByIdOrName(identifier);
    
    if (!student) {
      return null;
    }

    return {
      studentId: student.Student_ID,
      name: student.Name,
      year: student.Year,
      numberOfSubjects: student.Number_of_Subjects,
      totalFees: parseFloat(student.Total_Fees || 0),
      discountPercent: parseFloat(student.Discount_Percent || 0),
      discountAmount: parseFloat(student.Discount_Amount || 0),
      netAmount: parseFloat(student.Net_Amount || 0),
      totalPaid: parseFloat(student.Total_Paid || 0),
      remainingBalance: parseFloat(student.Remaining_Balance || 0),
      phoneNumber: student.Phone_Number,
      enrollmentDate: student.Enrollment_Date,
      status: student.Status,
      lastPaymentDate: student.Last_Payment_Date,
      rowIndex: student.rowIndex
    };
  }

  async applyDiscount(studentId, discountPercent) {
    const student = await this.getStudentInfo(studentId);
    if (!student) throw new Error('Student not found');

    const discountAmount = (student.totalFees * discountPercent) / 100;
    const netAmount = student.totalFees - discountAmount;
    const remainingBalance = netAmount - student.totalPaid;

    const updatedRow = [
      student.studentId,
      student.name,
      student.year,
      student.numberOfSubjects,
      student.totalFees,
      discountPercent,
      discountAmount,
      netAmount,
      student.totalPaid,
      remainingBalance,
      student.phoneNumber,
      student.enrollmentDate,
      student.status,
      student.lastPaymentDate
    ];

    await googleSheets.updateRow('Master_Students', student.rowIndex, updatedRow);

    return {
      studentId: student.studentId,
      name: student.name,
      totalFees: student.totalFees,
      discountPercent,
      discountAmount,
      netAmount,
      totalPaid: student.totalPaid,
      remainingBalance
    };
  }

  async recordPayment(studentId, amountPaid, paymentMethod, discountPercent = null, processedBy = 'System') {
    let student = await this.getStudentInfo(studentId);
    if (!student) throw new Error('Student not found');

    if (discountPercent !== null && discountPercent !== student.discountPercent) {
      student = await this.applyDiscount(studentId, discountPercent);
      student = await this.getStudentInfo(studentId);
    }

    const newTotalPaid = student.totalPaid + amountPaid;
    const newRemainingBalance = student.netAmount - newTotalPaid;
    const paymentDate = moment().format('YYYY-MM-DD HH:mm:ss');

    const config = await googleSheets.getConfig();
    const numberOfInstallments = parseInt(config.Number_of_Installments || 3);
    const installmentAmount = student.netAmount / numberOfInstallments;
    const installmentNumber = Math.ceil(newTotalPaid / installmentAmount);

    const paymentRow = [
      this.generatePaymentId(),
      student.studentId,
      student.name,
      paymentDate,
      amountPaid,
      paymentMethod,
      student.discountAmount,
      student.netAmount,
      newRemainingBalance,
      installmentNumber,
      processedBy,
      ''
    ];

    await googleSheets.appendRows('Payments_Log', [paymentRow]);

    const updatedStudentRow = [
      student.studentId,
      student.name,
      student.year,
      student.numberOfSubjects,
      student.totalFees,
      student.discountPercent,
      student.discountAmount,
      student.netAmount,
      newTotalPaid,
      newRemainingBalance,
      student.phoneNumber,
      student.enrollmentDate,
      newRemainingBalance <= 0 ? 'Paid' : 'Active',
      paymentDate
    ];

    await googleSheets.updateRow('Master_Students', student.rowIndex, updatedStudentRow);

    // If the payment method is not cash, record it as a bank deposit as well
    try {
      if (String(paymentMethod || '').toLowerCase() !== 'cash') {
        // Use the paymentMethod as a bank descriptor when no explicit bank name is provided
        const bankName = String(paymentMethod || 'Unknown');
        await financeService.recordBankDeposit(amountPaid, bankName, processedBy, `Auto: student payment ${student.studentId}`);
      }
    } catch (err) {
      // Log but don't fail the payment flow if deposit recording fails
      console.error('Warning: failed to record bank deposit for non-cash payment:', err && err.message ? err.message : err);
    }

    // After recording payment, refresh overdue checks so any resolved overdue entries are removed
    try {
      await paymentDueService.checkOverduePayments();
    } catch (err) {
      console.error('Warning: failed to run overdue check after recording payment:', err && err.message ? err.message : err);
    }
    // Update Analytics sheet after payment
    try {
      const summary = await financeService.getFinancialSummary();
      const overdueStudents = await paymentDueService.getOverdueStudents();
      await googleSheets.writeAnalytics(summary, overdueStudents.length);
      // Sync grade sheets so payments reflect in per-grade sheets
      await this.syncGradeSheetsFromMaster();
    } catch (err) {
      console.error('Warning: failed to update analytics after payment:', err && err.message ? err.message : err);
    }
    return {
      success: true,
      payment: {
        studentId: student.studentId,
        studentName: student.name,
        amountPaid,
        paymentMethod,
        totalPaid: newTotalPaid,
        remainingBalance: newRemainingBalance,
        installmentNumber,
        paymentDate
      }
    };
  }

  generatePaymentId() {
    const date = moment().format('YYYYMMDD');
    const random = Math.floor(100 + Math.random() * 900);
    return `PAY${date}${random}`;
  }

  async getAllStudents() {
    const data = await googleSheets.getSheetData('Master_Students');
    if (data.length <= 1) return [];

    const headers = data[0];
    const students = data.slice(1).map(row => {
      const student = {};
      headers.forEach((header, index) => {
        student[header] = row[index] || '';
      });
      return student;
    });

    return students;
  }

  // Normalize existing Master_Students rows to ensure Net_Amount and Remaining_Balance are numeric and consistent
  async normalizeMasterStudents() {
    const sheet = await googleSheets.getSheetData('Master_Students');
    if (sheet.length <= 1) return 0;

    const headers = sheet[0];
    const rows = sheet.slice(1);
    const updates = [];

    rows.forEach((row, idx) => {
      const r = {};
      headers.forEach((h, i) => { r[h] = row[i] || ''; });

      // Always compute netAmount from Total_Fees and Discount (prefer explicit Discount_Amount when present)
      const totalFees = Number(r.Total_Fees || 0) || 0;
      const discountPercent = Number(r.Discount_Percent || 0) || 0;
      const discountAmount = Number(r.Discount_Amount) || Math.round(totalFees * discountPercent / 100) || 0;

      // Force netAmount calculation from totalFees and discountAmount to avoid stale/zero values
      const netAmount = Math.round(totalFees - discountAmount);

      const totalPaid = Number(r.Total_Paid || 0) || 0;
      // Recompute remaining balance from netAmount and totalPaid
      const remainingBalance = Math.round(netAmount - totalPaid);

      const updatedRow = [
        r.Student_ID || '',
        r.Name || '',
        r.Year || '',
        r.Number_of_Subjects || 0,
        totalFees,
        discountPercent,
        discountAmount,
        netAmount,
        totalPaid,
        remainingBalance,
        r.Phone_Number || '',
        r.Enrollment_Date || '',
        remainingBalance <= 0 ? 'Paid' : (r.Status || 'Active'),
        r.Last_Payment_Date || ''
      ];

      updates.push({ rowIndex: idx + 2, values: updatedRow });
    });

    // batch update rows (sequentially for simplicity)
    for (const u of updates) {
      await googleSheets.updateRow('Master_Students', u.rowIndex, u.values);
    }

    return updates.length;
  }
}

module.exports = new StudentService();