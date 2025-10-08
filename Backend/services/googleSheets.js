const { google } = require('googleapis');
const moment = require('moment');
const fs = require('fs');

class GoogleSheetsService {
  constructor() {
    const saKeyPath = '/etc/secrets/google-sa-key.json';
    let authOptions = {};

    // Priority 1: Use file path for service account key (for Google Cloud Run)
    if (fs.existsSync(saKeyPath)) {
      console.log('Authenticating using service account key file.');
      authOptions.keyFile = saKeyPath;
    } else {
      // Priority 2: Use environment variables (for local development)
      console.log('Authenticating using environment variables.');
      const credentials = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
      };

      if (credentials.client_email && credentials.private_key) {
        authOptions.credentials = credentials;
      } else {
        console.error('Authentication failed: Service account credentials not found in file or environment variables.');
      }
    }

    this.auth = new google.auth.GoogleAuth({
      ...authOptions,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    });
    
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.spreadsheetId = process.env.GOOGLE_MASTER_SHEET_ID;
  }

  async initializeSpreadsheet() {
    try {
      const sheetNames = [
        'Master_Students',
        'Grade_1', 'Grade_2', 'Grade_3', 'Grade_4', 'Grade_5', 'Grade_6',
        'Grade_7', 'Grade_8', 'Grade_9', 'Grade_10', 'Grade_11', 'Grade_12',
        'Payments_Log',
        'In_Out_Transactions',
        'Bank_Deposits',
        'Overdue_Payments',
          'Config',
          'Analytics'
      ];

      for (const sheetName of sheetNames) {
        await this.createSheetIfNotExists(sheetName);
      }

      await this.initializeMasterStudentsSheet();
      await this.initializePaymentsLogSheet();
      await this.initializeInOutSheet();
      await this.initializeBankDepositsSheet();
      await this.initializeOverdueSheet();
      await this.initializeConfigSheet();
        await this.initializeAnalyticsSheet();
      
      console.log('Spreadsheet initialized successfully');
    } catch (error) {
      console.error('Error initializing spreadsheet:', error);
      throw error;
    }
  }

  async createSheetIfNotExists(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      const sheetExists = response.data.sheets.some(
        sheet => sheet.properties.title === sheetName
      );

      if (!sheetExists) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: { title: sheetName }
              }
            }]
          }
        });
        console.log(`Created sheet: ${sheetName}`);
      }
    } catch (error) {
      console.error(`Error creating sheet ${sheetName}:`, error);
    }
  }

  async initializeMasterStudentsSheet() {
    const headers = [
      'Student_ID', 'Name', 'Year', 'Number_of_Subjects', 
      'Total_Fees', 'Discount_Percent', 'Discount_Amount', 'Net_Amount',
      'Total_Paid', 'Remaining_Balance', 'Phone_Number', 
      'Enrollment_Date', 'Status', 'Last_Payment_Date'
    ];

    await this.updateSheetHeaders('Master_Students', headers);
  }

  async initializePaymentsLogSheet() {
    const headers = [
      'Payment_ID', 'Student_ID', 'Student_Name', 'Payment_Date', 
      'Amount_Paid', 'Payment_Method', 'Discount_Applied', 
      'Net_Amount', 'Remaining_Balance', 'Installment_Number',
      'Processed_By', 'Notes'
    ];

    await this.updateSheetHeaders('Payments_Log', headers);
  }

  async initializeInOutSheet() {
    const headers = [
      'Transaction_ID', 'Date', 'Type', 'Amount', 'Subject', 
      'Payer_Receiver_Name', 'Payment_Method', 'Notes', 'Processed_By'
    ];

    await this.updateSheetHeaders('In_Out_Transactions', headers);
  }

  async initializeBankDepositsSheet() {
    const headers = [
      'Deposit_ID', 'Date', 'Amount', 'Bank_Name', 
      'Deposited_By', 'Notes'
    ];

    await this.updateSheetHeaders('Bank_Deposits', headers);
  }

  async initializeOverdueSheet() {
    const headers = [
      'Student_ID', 'Student_Name', 'Year', 'Phone_Number',
      'Total_Amount_Due', 'Amount_Paid', 'Remaining_Balance',
      'Due_Date', 'Days_Overdue', 'Installment_Number', 'Last_Updated'
    ];

    await this.updateSheetHeaders('Overdue_Payments', headers);
  }

  async initializeConfigSheet() {
    const headers = ['Setting', 'Value'];
    await this.updateSheetHeaders('Config', headers);

    const defaultConfig = [
      ['Number_of_Installments', '3'],
      ['Installment_1_Date', '2025-10-15'],
      ['Installment_2_Date', '2025-12-15'],
      ['Installment_3_Date', '2026-02-15'],
      ['Installment_4_Date', ''],
      ['Current_Academic_Year', '2025-2026'],
      ['WhatsApp_Notifications_Enabled', 'true'],
      ['Notification_Days_Before_Due', '7']
    ];

    const existingData = await this.getSheetData('Config');
    if (existingData.length <= 1) {
      await this.appendRows('Config', defaultConfig);
    }
  }

  async initializeAnalyticsSheet() {
    const headers = ['Metric', 'Value', 'Details', 'Last_Updated'];
    await this.updateSheetHeaders('Analytics', headers);
  }

  async updateSheetHeaders(sheetName, headers) {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      });
    } catch (error) {
      console.error(`Error updating headers for ${sheetName}:`, error);
    }
  }

  async appendRows(sheetName, rows) {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: rows
        }
      });
    } catch (error) {
      console.error(`Error appending rows to ${sheetName}:`, error);
      throw error;
    }
  }

  async getSheetData(sheetName, range = '') {
    try {
      const fullRange = range ? `${sheetName}!${range}` : sheetName;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: fullRange
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`Error getting data from ${sheetName}:`, error);
      return [];
    }
  }

  async updateRow(sheetName, rowIndex, values) {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [values]
        }
      });
    } catch (error) {
      console.error(`Error updating row in ${sheetName}:`, error);
      throw error;
    }
  }

  async findStudentByIdOrName(identifier) {
    const data = await this.getSheetData('Master_Students');
    if (data.length <= 1) return null;

    const headers = data[0];
    const idIndex = headers.indexOf('Student_ID');
    const nameIndex = headers.indexOf('Name');

    const studentRow = data.slice(1).find(row => {
      return row[idIndex] === identifier || 
             row[nameIndex].toLowerCase().includes(identifier.toLowerCase());
    });

    if (!studentRow) return null;

    const student = {};
    headers.forEach((header, index) => {
      student[header] = studentRow[index] || '';
    });

    const rowIndex = data.indexOf(studentRow) + 1;
    student.rowIndex = rowIndex;

    return student;
  }

  async getConfig() {
    const data = await this.getSheetData('Config');
    const config = {};
    
    data.slice(1).forEach(row => {
      if (row[0] && row[1]) {
        config[row[0]] = row[1];
      }
    });

    return config;
  }

  async updateConfig(setting, value) {
    const data = await this.getSheetData('Config');
    const settingIndex = data.findIndex(row => row[0] === setting);

    if (settingIndex > 0) {
      await this.updateRow('Config', settingIndex + 1, [setting, value]);
    } else {
      await this.appendRows('Config', [[setting, value]]);
    }
  }

  async clearSheet(sheetName) {
    try {
      const data = await this.getSheetData(sheetName);
      if (data.length > 1) {
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A2:Z`
        });
      }
    } catch (error) {
      console.error(`Error clearing sheet ${sheetName}:`, error);
    }
  }

  async clearAllData() {
    try {
      const sheetsToClear = [
        'Master_Students',
        'Payments_Log',
        'In_Out_Transactions',
        'Bank_Deposits',
        'Overdue_Payments'
      ];
      for (const s of sheetsToClear) {
        await this.clearSheet(s);
      }
      console.log('All data cleared');
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  async writeAnalytics(summary, overdueCount = 0) {
    try {
      const now = moment().format('YYYY-MM-DD HH:mm:ss');

      // Build a human-readable analytics section plus monthly breakdown and recent transactions
      const headerRows = [
        ['Metric', 'Value', 'Details', 'Last_Updated'],
        ['Total Cash In Hand', summary?.cash?.totalCashInHand || 0, summary?.cash?.description || '', now],
        ['Total In Bank', summary?.bank?.totalInBank || 0, summary?.bank?.description || '', now],
        ['Total Students', summary?.students?.totalStudents || 0, '', now],
        ['Active Students', summary?.students?.activeStudents || 0, '', now],
        ['Total Fees Expected', summary?.students?.totalFeesExpected || 0, '', now],
        ['Total Fees Collected', summary?.students?.totalFeesCollected || 0, '', now],
        ['Total Outstanding', summary?.students?.totalOutstanding || 0, '', now],
        ['Collection Rate', summary?.students?.collectionRate || '0%', '', now],
        ['Total Income', summary?.transactions?.totalIncome || 0, '', now],
        ['Total Expenses', summary?.transactions?.totalExpenses || 0, '', now],
        ['Net Profit', summary?.transactions?.netProfit || 0, '', now],
        ['Total Overdue Students', overdueCount || 0, '', now]
      ];

      // Prepare monthly breakdown if available
      const monthlyRows = [];
      if (Array.isArray(summary?.monthly) && summary.monthly.length > 0) {
        monthlyRows.push(['--']);
        monthlyRows.push(['Monthly Breakdown (YYYY-MM)', 'Income', 'Expenses', 'Fees Collected', 'Deposits', 'Net', 'Last_Updated']);
        summary.monthly.forEach(m => {
          monthlyRows.push([m.month, m.income || 0, m.expenses || 0, m.feesCollected || 0, m.deposits || 0, m.net || 0, now]);
        });
      }

      // Recent transactions / payments / deposits
      const recentRows = [];
      if (Array.isArray(summary?.recent) && summary.recent.length > 0) {
        recentRows.push(['--']);
        recentRows.push(['Recent Items', 'Type', 'Date', 'Amount', 'Method/Notes', 'Last_Updated']);
        summary.recent.forEach(it => {
          const type = it.kind || (it.type || 'item');
          const date = it.date || '';
          const amount = it.amount || '';
          const method = it.method || (it.raw && JSON.stringify(it.raw)) || '';
          recentRows.push([type, it.kind || '', date, amount, method, now]);
        });
      }

      // Clear sheet and write assembled rows (preserve header row as first row)
      await this.updateSheetHeaders('Analytics', ['Metric', 'Value', 'Details', 'Last_Updated']);
      // Clear any existing data under headers
      await this.clearSheet('Analytics');

      // Append headerRows (skip the first header because updateSheetHeaders already set it)
      const rowsToAppend = headerRows.slice(1).concat(monthlyRows).concat(recentRows);
      if (rowsToAppend.length > 0) {
        await this.appendRows('Analytics', rowsToAppend);
      }
    } catch (error) {
      console.error('Error writing analytics:', error);
      throw error;
    }
  }

  async exportMasterSheet() {
    try {
      // Use Drive files.export for exportable mime types; for Google Sheets use exportLinks
      // Construct export URL and request via drive.files.export
      const res = await this.drive.files.export({
        fileId: this.spreadsheetId,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }, { responseType: 'arraybuffer' });

      return Buffer.from(res.data);
    } catch (error) {
      console.error('Error exporting master sheet:', error);
      throw error;
    }
  }
}

module.exports = new GoogleSheetsService();