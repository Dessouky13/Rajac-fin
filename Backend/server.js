require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const googleSheets = require('./services/googleSheets');
const studentService = require('./services/studentService');
const financeService = require('./services/financeService');
const paymentDueService = require('./services/paymentDueService');
const driveWatcher = require('./services/driveWatcher');
const teachersService = require('./services/teachersService');
// const whatsappService = require('./services/whatsappService'); // WhatsApp service disabled for now

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint to trigger Google Drive student sheet processing
app.post('/api/students/process-drive', async (req, res) => {
  try {
    const result = await driveWatcher.watchAndProcess();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'student-enrollment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'RAJAC Language School Finance System API',
    version: '1.0.0',
    endpoints: {
      students: '/api/students/*',
      payments: '/api/payments/*',
      finance: '/api/finance/*',
      bank: '/api/bank/*',
      analytics: '/api/analytics',
      config: '/api/config/*'
    }
  });
});

app.post('/api/students/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await studentService.processUploadedFile(
      req.file.path,
      req.file.originalname
    );

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'Bank deposit recorded successfully',
      data: result
    });
  } catch (error) {
    console.error('Error recording bank deposit:', error);
    res.status(500).json({
      error: 'Failed to record bank deposit',
      message: error.message
    });
  }
});

app.get('/api/bank/deposits', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const deposits = await financeService.getBankDeposits(startDate, endDate);

    res.json({
      success: true,
      total: deposits.length,
      deposits
    });
  } catch (error) {
    console.error('Error getting bank deposits:', error);
    res.status(500).json({
      error: 'Failed to get bank deposits',
      message: error.message
    });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    const summary = await financeService.getFinancialSummary();
    const overdueStudents = await paymentDueService.getOverdueStudents();

    res.json({
      success: true,
      analytics: {
        ...summary,
        overduePayments: {
          totalOverdue: overdueStudents.length,
          students: overdueStudents
        }
      }
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error.message
    });
  }
});

// Write analytics summary into the Analytics sheet
app.post('/api/analytics/write', async (req, res) => {
  try {
    const summary = await financeService.getFinancialSummary();
    const overdueStudents = await paymentDueService.getOverdueStudents();

    await googleSheets.writeAnalytics(summary, overdueStudents.length);

    res.json({
      success: true,
      message: 'Analytics written to sheet successfully',
      data: {
        writtenAt: new Date().toISOString(),
        overdueCount: overdueStudents.length
      }
    });
  } catch (error) {
    console.error('Error writing analytics:', error);
    res.status(500).json({
      error: 'Failed to write analytics',
      message: error.message
    });
  }
});

app.get('/api/payments/overdue', async (req, res) => {
  try {
    const result = await paymentDueService.checkOverduePayments();

    res.json({
      success: true,
      message: 'Overdue payments checked successfully',
      data: result
    });
  } catch (error) {
    console.error('Error checking overdue payments:', error);
    res.status(500).json({
      error: 'Failed to check overdue payments',
      message: error.message
    });
  }
});

// API endpoint for n8n automation - returns overdue students with contact info
app.get('/api/automation/overdue-payments', async (req, res) => {
  try {
    const overdueStudents = await paymentDueService.getOverdueStudents();
    
    // Format data for n8n automation with all necessary contact and payment info
    const automationData = overdueStudents.map(student => ({
      studentId: student.Student_ID || student.studentId,
      name: student.Name || student.name,
      year: student.Year || student.year,
      phoneNumber: student.Phone_Number || student.phoneNumber,
      dueDate: student.Due_Date || student.dueDate,
      daysOverdue: parseInt(student.Days_Overdue || student.daysOverdue || 0),
      installmentNumber: parseInt(student.Installment_Number || student.installmentNumber || 1),
      amountDue: parseFloat(student.Amount_Due || student.amountDue || 0),
      remainingBalance: parseFloat(student.Remaining_Balance || student.remainingBalance || 0),
      totalPaid: parseFloat(student.Total_Paid || student.totalPaid || 0),
      netAmount: parseFloat(student.Net_Amount || student.netAmount || 0),
      lastUpdated: student.Last_Updated || student.lastUpdated || new Date().toISOString()
    }));

    res.json({
      success: true,
      message: 'Overdue payments data retrieved for automation',
      totalOverdue: automationData.length,
      retrievedAt: new Date().toISOString(),
      data: automationData
    });
  } catch (error) {
    console.error('Error retrieving overdue payments for automation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve overdue payments for automation',
      message: error.message
    });
  }
});

app.post('/api/payments/send-reminders', async (req, res) => {
  try {
    const { daysBeforeDue } = req.body;
    
    const result = await paymentDueService.sendPaymentReminders(
      daysBeforeDue || 7
    );

    res.json({
      success: true,
      message: 'Payment reminders sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    res.status(500).json({
      error: 'Failed to send reminders',
      message: error.message
    });
  }
});

// API endpoint for n8n to log successful reminder deliveries
app.post('/api/automation/log-reminder', async (req, res) => {
  try {
    const { 
      studentId, 
      reminderType, // 'whatsapp', 'sms', 'email'
      status, // 'sent', 'delivered', 'failed'
      message,
      deliveredAt 
    } = req.body;

    // Validate required fields
    if (!studentId || !reminderType || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: studentId, reminderType, status'
      });
    }

    // Log the reminder delivery (you can extend this to store in a sheet if needed)
    console.log(`Reminder Log - Student: ${studentId}, Type: ${reminderType}, Status: ${status}, Time: ${deliveredAt || new Date().toISOString()}`);
    
    // Optional: Store in Google Sheets for tracking
    // You could create a "Reminder_Log" sheet to track all reminder deliveries
    
    res.json({
      success: true,
      message: 'Reminder delivery logged successfully',
      loggedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging reminder delivery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log reminder delivery',
      message: error.message
    });
  }
});

app.get('/api/config/installments', async (req, res) => {
  try {
    const installments = await paymentDueService.getUpcomingDueDates();

    res.json({
      success: true,
      installments
    });
  } catch (error) {
    console.error('Error getting installments:', error);
    res.status(500).json({
      error: 'Failed to get installments',
      message: error.message
    });
  }
});

app.put('/api/config/installments', async (req, res) => {
  try {
    const { installments } = req.body;

    if (!installments || !Array.isArray(installments)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'installments array is required with format: [{number: 1, date: "2025-10-15"}, ...]'
      });
    }

    const result = await paymentDueService.updateInstallmentDates(installments);

    res.json({
      success: true,
      message: 'Installment dates updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating installments:', error);
    res.status(500).json({
      error: 'Failed to update installments',
      message: error.message
    });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const config = await googleSheets.getConfig();

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      error: 'Failed to get configuration',
      message: error.message
    });
  }
});

app.put('/api/config/:setting', async (req, res) => {
  try {
    const { setting } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({
        error: 'Missing value',
        message: 'value is required'
      });
    }

    await googleSheets.updateConfig(setting, value);

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      setting,
      value
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({
      error: 'Failed to update configuration',
      message: error.message
    });
  }
});

app.post('/api/init', async (req, res) => {
  try {
    await googleSheets.initializeSpreadsheet();
    
    res.json({
      success: true,
      message: 'Spreadsheet initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing spreadsheet:', error);
    res.status(500).json({
      error: 'Failed to initialize spreadsheet',
      message: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

cron.schedule('0 9 * * *', async () => {
  console.log('Running daily overdue payment check...');
  try {
    await paymentDueService.checkOverduePayments();
    console.log('Daily overdue check completed');
  } catch (error) {
    console.error('Error in daily overdue check:', error);
  }
});

cron.schedule('0 10 * * *', async () => {
  console.log('Running daily payment reminders...');
  try {
    const config = await googleSheets.getConfig();
    const daysBeforeDue = parseInt(config.Notification_Days_Before_Due || 7);
    await paymentDueService.sendPaymentReminders(daysBeforeDue);
    console.log('Daily reminders completed');
  } catch (error) {
    console.error('Error in daily reminders:', error);
  }
});

// Daily analytics write: run shortly after overdue check (09:05)
cron.schedule('5 9 * * *', async () => {
  console.log('Running daily analytics write...');
  try {
    const summary = await financeService.getFinancialSummary();
    const overdueStudents = await paymentDueService.getOverdueStudents();
    await googleSheets.writeAnalytics(summary, overdueStudents.length);
    console.log('Daily analytics written successfully');
  } catch (error) {
    console.error('Error writing daily analytics:', error);
  }
});

app.listen(PORT, async () => {
  console.log(`\n🚀 RAJAC Finance System API Server`);
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(`   POST   /api/students/upload - Upload student enrollment file`);
  console.log(`   GET    /api/students/search/:identifier - Search student by ID or name`);
  console.log(`   GET    /api/students - Get all students`);
  console.log(`   POST   /api/payments/process - Process student payment`);
  console.log(`   POST   /api/payments/apply-discount - Apply discount to student`);
  console.log(`   GET    /api/payments/overdue - Check overdue payments`);
  console.log(`   POST   /api/payments/send-reminders - Send WhatsApp reminders`);
  console.log(`   POST   /api/finance/transaction - Record in/out transaction`);
  console.log(`   GET    /api/finance/transactions - Get all transactions`);
  console.log(`   POST   /api/bank/deposit - Record bank deposit`);
  console.log(`   GET    /api/bank/deposits - Get all bank deposits`);
  console.log(`   GET    /api/analytics - Get financial analytics`);
  console.log(`   GET    /api/teachers - Get all teachers`);
  console.log(`   POST   /api/teachers - Add new teacher`);
  console.log(`   POST   /api/teachers/payment - Pay teacher`);
  console.log(`   GET    /api/config/installments - Get installment dates`);
  console.log(`   PUT    /api/config/installments - Update installment dates`);
  console.log(`   GET    /api/config - Get all configuration`);
  console.log(`   PUT    /api/config/:setting - Update specific setting`);
  console.log(`   POST   /api/init - Initialize spreadsheet structure`);
  console.log(`\n⏰ Scheduled Tasks:`);
  console.log(`   - Daily overdue check: 9:00 AM`);
  console.log(`   - Daily payment reminders: 10:00 AM`);
  console.log(`\n✅ Server is ready to accept requests\n`);

  try {
    console.log('Initializing Google Sheets...');
    await googleSheets.initializeSpreadsheet();
    console.log('✅ Google Sheets initialized successfully\n');
  } catch (error) {
    console.error('⚠️  Warning: Failed to initialize Google Sheets:', error.message);
    console.log('You can manually initialize by calling POST /api/init\n');
  }
});

// Search for a student by ID or name
app.get('/api/students/search/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const student = await studentService.getStudentInfo(identifier);

    if (!student) {
      return res.status(404).json({
        error: 'Student not found',
        message: 'No student found with the provided ID or name'
      });
    }

    res.json({
      success: true,
      student
    });
  } catch (error) {
    console.error('Error searching student:', error);
    res.status(500).json({
      error: 'Failed to search student',
      message: error.message
    });
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await studentService.getAllStudents();
    res.json({
      success: true,
      total: students.length,
      students
    });
  } catch (error) {
    console.error('Error getting students:', error);
    res.status(500).json({
      error: 'Failed to get students',
      message: error.message
    });
  }
});

// Process a student payment
app.post('/api/payments/process', async (req, res) => {
  try {
    const {
      studentId,
      amountPaid,
      paymentMethod,
      discountPercent,
      processedBy
    } = req.body;

    if (!studentId || !amountPaid || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'studentId, amountPaid, and paymentMethod are required'
      });
    }

    const result = await studentService.recordPayment(
      studentId,
      parseFloat(amountPaid),
      paymentMethod,
      discountPercent ? parseFloat(discountPercent) : null,
      processedBy || 'Finance Team'
    );

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      error: 'Failed to process payment',
      message: error.message
    });
  }
});

// Apply a discount to a student
app.post('/api/payments/apply-discount', async (req, res) => {
  try {
    const { studentId, discountPercent } = req.body;

    if (!studentId || discountPercent === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'studentId and discountPercent are required'
      });
    }

    const result = await studentService.applyDiscount(
      studentId,
      parseFloat(discountPercent)
    );

    res.json({
      success: true,
      message: 'Discount applied successfully',
      data: result
    });
  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({
      error: 'Failed to apply discount',
      message: error.message
    });
  }
});

// Record an in/out transaction
app.post('/api/finance/transaction', async (req, res) => {
  try {
    const {
      type,
      amount,
      subject,
      payerReceiverName,
      paymentMethod,
      notes,
      processedBy
    } = req.body;

    if (!type || !amount || !subject || !payerReceiverName || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'type, amount, subject, payerReceiverName, and paymentMethod are required'
      });
    }

    if (!['in', 'out', 'income', 'expense'].includes(type.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid transaction type',
        message: 'type must be: in, out, income, or expense'
      });
    }

    const result = await financeService.recordTransaction(
      type,
      parseFloat(amount),
      subject,
      payerReceiverName,
      paymentMethod,
      notes || '',
      processedBy || 'Finance Team'
    );

    res.json({
      success: true,
      message: 'Transaction recorded successfully',
      data: result
    });
  } catch (error) {
    console.error('Error recording transaction:', error);
    res.status(500).json({
      error: 'Failed to record transaction',
      message: error.message
    });
  }
});

// Get all transactions with optional filtering
app.get('/api/finance/transactions', async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    const transactions = await financeService.getTransactions(
      startDate,
      endDate,
      type
    );

    res.json({
      success: true,
      total: transactions.length,
      transactions
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      error: 'Failed to get transactions',
      message: error.message
    });
  }
});

// Record a bank deposit
app.post('/api/bank/deposit', async (req, res) => {
  try {
    const { amount, bankName, depositedBy, notes } = req.body;

    if (!amount || !bankName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'amount and bankName are required'
      });
    }

    const result = await financeService.recordBankDeposit(
      parseFloat(amount),
      bankName,
      depositedBy || 'Finance Team',
      notes || ''
    );

    res.json({
      success: true,
      message: 'Bank deposit recorded successfully',
      data: result
    });
  } catch (error) {
    console.error('Error recording bank deposit:', error);
    res.status(500).json({
      error: 'Failed to record bank deposit',
      message: error.message
    });
  }
});

app.post('/api/bank/withdraw', async (req, res) => {
  try {
    const { amount, bankName, withdrawnBy, notes } = req.body;

    if (!amount || !bankName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'amount and bankName are required'
      });
    }

    const result = await financeService.recordBankWithdrawal(
      parseFloat(amount),
      bankName,
      withdrawnBy || 'Finance Team',
      notes || ''
    );

    res.json({
      success: true,
      message: 'Bank withdrawal recorded successfully',
      data: result
    });
  } catch (error) {
    console.error('Error recording bank withdrawal:', error);
    res.status(500).json({
      error: 'Failed to record bank withdrawal',
      message: error.message
    });
  }
});

// Admin endpoint: normalize Master_Students numeric fields (Net_Amount, Remaining_Balance)
app.post('/api/students/normalize', async (req, res) => {
  try {
    const result = await studentService.normalizeMasterStudents();
    res.json({ success: true, message: 'Normalization complete', modified: result });
  } catch (error) {
    console.error('Error normalizing students:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// MVP: Import students via JSON payload (paste) and run overdue check
app.post('/api/students/import-json', async (req, res) => {
  try {
    const { students } = req.body;
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ success: false, error: 'students must be an array' });
    }

    const importResult = await studentService.importStudentsArray(students);
    // After import, run overdue check to generate Overdue_Payments
    const overdueResult = await paymentDueService.checkOverduePayments();

    res.json({ success: true, importResult, overdueResult });
  } catch (error) {
    console.error('Error importing students:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoints
app.get('/api/admin/master-sheet', async (req, res) => {
  try {
    // Export the master spreadsheet as XLSX via Drive export
    const buffer = await googleSheets.exportMasterSheet();
    res.setHeader('Content-Disposition', 'attachment; filename="master_students.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting master sheet:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/delete-all', async (req, res) => {
  try {
    await googleSheets.clearAllData();
    return res.json({ success: true, message: 'All data cleared' });
  } catch (error) {
    console.error('Error clearing data:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/backup-analytics', async (req, res) => {
  try {
    // Get current analytics data
    const analyticsData = await googleSheets.getSheetData('Analytics');
    if (analyticsData.length > 1) {
      // Remove header row and trigger backup
      await googleSheets.checkAndCreateMonthlyBackup(analyticsData.slice(1));
      return res.json({ success: true, message: 'Analytics backup created successfully' });
    } else {
      return res.json({ success: true, message: 'No analytics data to backup' });
    }
  } catch (error) {
    console.error('Error creating analytics backup:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/cleanup-duplicate-deposits', async (req, res) => {
  try {
    const result = await financeService.cleanupDuplicateBankDeposits();
    return res.json(result);
  } catch (error) {
    console.error('Error cleaning up duplicate deposits:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/installments', async (req, res) => {
  try {
    const { installments } = req.body;
    if (!installments || !Array.isArray(installments)) {
      return res.status(400).json({ success: false, message: 'installments array required' });
    }
    const result = await paymentDueService.updateInstallmentDates(installments);
    return res.json({ success: true, message: 'Installments updated', data: result });
  } catch (error) {
    console.error('Error updating installments:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Compact analytics payload for chatbot consumption
app.get('/api/analytics/chat', async (req, res) => {
  try {
    const summary = await financeService.getFinancialSummary();
    const overdueStudents = await paymentDueService.getOverdueStudents();

    // Build a compact payload optimized for chatbots
    const compact = {
      timestamp: new Date().toISOString(),
      cashAvailable: summary?.cash?.totalCashInHand || 0,
      bankAvailable: summary?.bank?.totalInBank || 0,
      totalBalance: (Number(summary?.cash?.totalCashInHand || 0) + Number(summary?.bank?.totalInBank || 0)),
      students: {
        total: summary?.students?.totalStudents || 0,
        active: summary?.students?.activeStudents || 0,
        outstanding: summary?.students?.totalOutstanding || 0
      },
      kpis: {
        totalIncome: summary?.transactions?.totalIncome || 0,
        totalExpenses: summary?.transactions?.totalExpenses || 0,
        netProfit: summary?.transactions?.netProfit || 0,
        collectionRate: summary?.students?.collectionRate || '0%'
      },
      monthly: (summary?.monthly || []).slice(-12), // last up to 12 months
      recent: (summary?.recent || []).slice(0, 10),
      overdueCount: overdueStudents.length,
      sampleQueries: [
        'What is the current available cash?',
        'How much is in the bank?',
        'What was revenue in 2025-06?',
        'Show net profit for the last 3 months',
        'List recent deposits and payments',
        'How many students are overdue and who are they?'
      ]
    };

    res.json({ success: true, data: compact });
  } catch (error) {
    console.error('Error getting chat analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to get chat analytics', message: error.message });
  }
});

// Teachers API routes
app.get('/api/teachers', async (req, res) => {
  try {
    const teachers = await teachersService.getAllTeachers();
    res.json({ success: true, data: teachers });
  } catch (error) {
    console.error('Error getting teachers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/teachers', async (req, res) => {
  try {
    console.log('Received teacher data:', req.body);
    const { name, subject, numberOfStudents, feePerStudent, totalAmount } = req.body;
    
    // More explicit validation
    if (!name || !subject) {
      return res.status(400).json({ success: false, error: 'Name and subject are required' });
    }
    
    if (numberOfStudents === undefined || numberOfStudents === null || isNaN(numberOfStudents)) {
      return res.status(400).json({ success: false, error: 'Valid number of students is required' });
    }
    
    if (feePerStudent === undefined || feePerStudent === null || isNaN(feePerStudent)) {
      return res.status(400).json({ success: false, error: 'Valid fee per student is required' });
    }
    
    if (totalAmount === undefined || totalAmount === null || isNaN(totalAmount)) {
      return res.status(400).json({ success: false, error: 'Valid total amount is required' });
    }
    
    const result = await teachersService.addTeacher({ 
      name: name.trim(), 
      subject: subject.trim(), 
      numberOfStudents: Number(numberOfStudents), 
      feePerStudent: Number(feePerStudent),
      totalAmount: Number(totalAmount) 
    });
    res.json(result);
  } catch (error) {
    console.error('Error adding teacher:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/teachers/:teacherId/update', async (req, res) => {
  try {
    console.log('Received teacher update data:', req.body);
    const { teacherId } = req.params;
    const { numberOfStudents, feePerStudent, totalAmount } = req.body;
    
    if (numberOfStudents === undefined || numberOfStudents === null || isNaN(numberOfStudents)) {
      return res.status(400).json({ success: false, error: 'Valid number of students is required' });
    }
    
    if (feePerStudent === undefined || feePerStudent === null || isNaN(feePerStudent)) {
      return res.status(400).json({ success: false, error: 'Valid fee per student is required' });
    }
    
    if (totalAmount === undefined || totalAmount === null || isNaN(totalAmount)) {
      return res.status(400).json({ success: false, error: 'Valid total amount is required' });
    }
    
    const result = await teachersService.updateTeacher(teacherId, { 
      numberOfStudents: Number(numberOfStudents), 
      feePerStudent: Number(feePerStudent),
      totalAmount: Number(totalAmount) 
    });
    res.json(result);
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/teachers/payment', async (req, res) => {
  try {
    const { teacherName, amount, method } = req.body;
    if (!teacherName || !amount || !method) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    const result = await teachersService.payTeacher({ teacherName, amount: Number(amount), method });
    res.json(result);
  } catch (error) {
    console.error('Error paying teacher:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});