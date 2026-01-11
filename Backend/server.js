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

// Import authorization middleware
const { requireAuth, requireAdmin, rateLimit, auditLog } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow Vercel frontend
const corsOptions = {
  origin: [
    'https://rajac-fin.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
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

// Teachers API routes
app.get('/api/teachers', async (req, res) => {
  try {
    const teachers = await teachersService.getAllTeachers();
    res.json({ success: true, teachers });
  } catch (error) {
    console.error('Error getting teachers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/teachers', async (req, res) => {
  try {
    const result = await teachersService.addTeacher(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error adding teacher:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/teachers/payment', async (req, res) => {
  try {
    const result = await teachersService.payTeacher(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error processing teacher payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await teachersService.deleteTeacher(id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await teachersService.updateTeacher(id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ success: false, error: error.message });
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

app.get('/api/students', async (req, res) => {
  try {
    const { grade } = req.query;
    let students = await studentService.getAllStudents();

    // Filter by grade if provided
    if (grade && grade !== 'All') {
      students = students.filter(s => {
        const year = (s.Year || s.year || '').toString();
        if (!year) return grade === 'Unknown';
        const num = year.match(/(\d{1,3})/);
        if (num && grade.startsWith('Grade_')) {
          return (`Grade_${num[1]}`) === grade;
        }
        return (`Grade_${year.replace(/\s+/g,'_')}`) === grade;
      });
    }

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

// Update student total fees with comprehensive validation and atomic updates
app.put('/api/students/:studentId/total-fees', requireAuth, rateLimit(20, 60000), auditLog('UPDATE_STUDENT_TOTAL_FEES'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { totalFees, updatedBy } = req.body;

    console.log(`[API] Update total fees request for student ${studentId}:`, { totalFees, updatedBy });

    // Validation
    if (!studentId) {
      return res.status(400).json({
        error: 'Missing student ID',
        message: 'Student ID is required in URL parameters'
      });
    }

    if (totalFees === undefined || totalFees === null) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'totalFees is required in request body'
      });
    }

    // Convert to number and validate
    const newTotalFees = parseFloat(totalFees);

    if (isNaN(newTotalFees)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'totalFees must be a valid number'
      });
    }

    if (newTotalFees < 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'totalFees cannot be negative'
      });
    }

    if (newTotalFees > 1000000) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'totalFees exceeds maximum allowed amount (1,000,000 EGP)'
      });
    }

    // Call service method with atomic transaction logic
    const result = await studentService.updateStudentTotalFees(
      studentId,
      newTotalFees,
      updatedBy || 'Frontend User'
    );

    console.log(`[API] Successfully updated total fees for student ${studentId}`);

    res.json({
      success: true,
      message: 'Student total fees updated successfully',
      data: result
    });
  } catch (error) {
    console.error('[API] Error updating student total fees:', error);

    // Distinguish between different error types
    if (error.message === 'Student not found') {
      return res.status(404).json({
        error: 'Student not found',
        message: `No student found with ID: ${req.params.studentId}`
      });
    }

    if (error.message.includes('required') || error.message.includes('must be') || error.message.includes('cannot be')) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message
      });
    }

    // Generic server error
    res.status(500).json({
      error: 'Failed to update student total fees',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

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

app.post('/api/admin/delete-old-sheets', async (req, res) => {
  try {
    const results = await googleSheets.deleteOldGradeSheets();
    return res.json({ success: true, message: 'Old grade sheets deleted', data: results });
  } catch (error) {
    console.error('Error deleting old sheets:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/backup', async (req, res) => {
  try {
    const result = await googleSheets.createBackup();
    return res.json({ success: true, message: 'Backup created', data: result });
  } catch (error) {
    console.error('Error creating backup:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/undo', async (req, res) => {
  try {
    const result = await googleSheets.restoreFromBackup();
    return res.json({ success: true, message: 'Last action undone', data: result });
  } catch (error) {
    console.error('Error undoing last action:', error);
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
        totalIncome: summary?.financial?.totalIncome || 0,
        totalExpenses: summary?.financial?.totalExpenses || 0,
        netProfit: summary?.financial?.netProfit || 0,
        collectionRate: summary?.students?.collectionRate || '0%',
        profitMargin: summary?.financial?.profitMargin || '0%'
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