/**
 * RAJAC Finance System - Student Intake Form Handler
 * This script processes Google Form submissions and writes to Master_Students sheet
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to your Google Form
 * 2. Click on the 3 dots menu > Script editor
 * 3. Replace all code with this script
 * 4. Update MASTER_SHEET_ID with your spreadsheet ID
 * 5. Save and authorize the script
 * 6. IMPORTANT: Delete any existing triggers first!
 * 7. Run setupTrigger() function once to create the trigger
 */

// ===== CONFIGURATION =====
const CONFIG = {
  // Replace with your Master Spreadsheet ID
  MASTER_SHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  MASTER_SHEET_NAME: 'Master_Students',

  // Email notification settings
  SEND_EMAIL_NOTIFICATIONS: true,
  ADMIN_EMAIL: 'your-admin-email@example.com', // Change this to your email

  // Form field mappings (adjust based on your form question titles)
  FORM_FIELDS: {
    NAME: 'Student Name', // Exact question text from your form
    YEAR: 'Grade/Year',
    SUBJECTS: 'Number of Subjects',
    FEES: 'Total Fees',
    PHONE: 'Phone Number'
  }
};

/**
 * Main function triggered on form submit
 * This should ONLY run once per submission
 */
function onFormSubmit(e) {
  try {
    Logger.log('Form submitted - Processing student intake');

    // Get form response
    const formResponse = e.response;
    const itemResponses = formResponse.getItemResponses();

    // Extract data from form
    const studentData = extractStudentData(itemResponses);

    // Validate data
    if (!validateStudentData(studentData)) {
      throw new Error('Invalid student data received');
    }

    // Generate student ID
    const studentId = generateStudentId();

    // Get current date
    const enrollmentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // Calculate financial fields
    const totalFees = parseFloat(studentData.fees) || 0;
    const discountPercent = 0;
    const discountAmount = 0;
    const netAmount = totalFees;
    const totalPaid = 0;
    const remainingBalance = netAmount;
    const status = 'Active';

    // Prepare row data for Master_Students sheet
    // Order matches: Student_ID, Name, Year, Number_of_Subjects, Total_Fees,
    //                Discount_Percent, Discount_Amount, Net_Amount, Total_Paid,
    //                Remaining_Balance, Phone_Number, Enrollment_Date, Status, Last_Payment_Date
    const rowData = [
      studentId,
      studentData.name,
      studentData.year,
      parseInt(studentData.subjects) || 0, // Ensure numeric
      totalFees, // Ensure numeric
      discountPercent,
      discountAmount,
      netAmount, // Ensure numeric
      totalPaid,
      remainingBalance, // Ensure numeric
      formatPhoneNumber(studentData.phone),
      enrollmentDate,
      status,
      '' // Last_Payment_Date initially empty
    ];

    // Write to Master_Students sheet
    const result = writeToMasterSheet(rowData);

    if (!result.success) {
      throw new Error('Failed to write to Master sheet: ' + result.error);
    }

    // Send confirmation email (optional)
    if (CONFIG.SEND_EMAIL_NOTIFICATIONS) {
      sendConfirmationEmail(studentData, studentId);
    }

    Logger.log('Successfully processed student: ' + studentId);

  } catch (error) {
    Logger.log('ERROR in onFormSubmit: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);

    // Send error notification to admin
    if (CONFIG.SEND_EMAIL_NOTIFICATIONS && CONFIG.ADMIN_EMAIL) {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: 'ERROR: Student Intake Form Submission Failed',
        body: 'Error processing form submission:\n\n' + error.message + '\n\nStack trace:\n' + error.stack
      });
    }

    // Re-throw error so it appears in trigger logs
    throw error;
  }
}

/**
 * Extract student data from form responses
 */
function extractStudentData(itemResponses) {
  const data = {};

  itemResponses.forEach(function(itemResponse) {
    const question = itemResponse.getItem().getTitle();
    const answer = itemResponse.getResponse();

    // Map form questions to data fields
    if (question === CONFIG.FORM_FIELDS.NAME || question.includes('Name') || question.includes('name')) {
      data.name = answer;
    } else if (question === CONFIG.FORM_FIELDS.YEAR || question.includes('Grade') || question.includes('Year') || question.includes('grade')) {
      data.year = answer;
    } else if (question === CONFIG.FORM_FIELDS.SUBJECTS || question.includes('Subject') || question.includes('subjects')) {
      data.subjects = answer;
    } else if (question === CONFIG.FORM_FIELDS.FEES || question.includes('Fees') || question.includes('fees') || question.includes('Total')) {
      // Extract numeric value from fees (handle currency symbols, commas, etc.)
      data.fees = extractNumericValue(answer);
    } else if (question === CONFIG.FORM_FIELDS.PHONE || question.includes('Phone') || question.includes('phone') || question.includes('Mobile')) {
      data.phone = answer;
    }
  });

  return data;
}

/**
 * Extract numeric value from string (removes currency symbols, commas, etc.)
 */
function extractNumericValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;

  // Remove currency symbols, commas, spaces
  const cleaned = value.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Validate student data
 */
function validateStudentData(data) {
  if (!data.name || data.name.trim() === '') {
    Logger.log('Validation failed: Missing student name');
    return false;
  }

  if (!data.year || data.year.trim() === '') {
    Logger.log('Validation failed: Missing year/grade');
    return false;
  }

  return true;
}

/**
 * Generate unique student ID
 */
function generateStudentId() {
  const year = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yy');
  const random = Math.floor(1000 + Math.random() * 9000);
  return 'STU' + year + random;
}

/**
 * Format phone number to Egyptian format
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';

  // Remove all non-numeric characters
  let cleaned = phone.toString().replace(/\D/g, '');

  // Add country code if missing
  if (cleaned.startsWith('20')) {
    return cleaned;
  } else if (cleaned.startsWith('0')) {
    return '20' + cleaned.substring(1);
  } else if (cleaned.length === 10) {
    return '20' + cleaned;
  }

  return cleaned;
}

/**
 * Write data to Master_Students sheet
 */
function writeToMasterSheet(rowData) {
  try {
    // Open spreadsheet
    const spreadsheet = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.MASTER_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        error: 'Sheet "' + CONFIG.MASTER_SHEET_NAME + '" not found'
      };
    }

    // Append row to sheet
    // IMPORTANT: Using appendRow ensures numbers are stored as numbers, not text
    sheet.appendRow(rowData);

    // Optional: Format the last row to ensure numbers are formatted correctly
    const lastRow = sheet.getLastRow();

    // Format numeric columns (Total_Fees, Net_Amount, Remaining_Balance)
    // Columns: E (Total_Fees), H (Net_Amount), J (Remaining_Balance)
    const numericColumns = ['E', 'H', 'J'];
    numericColumns.forEach(function(col) {
      const cell = sheet.getRange(col + lastRow);
      cell.setNumberFormat('#,##0.00'); // Format as number with 2 decimals
    });

    Logger.log('Successfully wrote row ' + lastRow + ' to Master_Students');

    return {
      success: true,
      row: lastRow
    };

  } catch (error) {
    Logger.log('Error writing to Master sheet: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send confirmation email to admin
 */
function sendConfirmationEmail(studentData, studentId) {
  try {
    if (!CONFIG.ADMIN_EMAIL) {
      Logger.log('No admin email configured, skipping email notification');
      return;
    }

    const subject = 'New Student Enrollment: ' + studentData.name;
    const body = 'A new student has been enrolled:\n\n' +
                 'Student ID: ' + studentId + '\n' +
                 'Name: ' + studentData.name + '\n' +
                 'Year: ' + studentData.year + '\n' +
                 'Number of Subjects: ' + studentData.subjects + '\n' +
                 'Total Fees: ' + studentData.fees + ' EGP\n' +
                 'Phone: ' + studentData.phone + '\n\n' +
                 'Enrollment Date: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    MailApp.sendEmail(CONFIG.ADMIN_EMAIL, subject, body);
    Logger.log('Confirmation email sent to: ' + CONFIG.ADMIN_EMAIL);

  } catch (error) {
    Logger.log('Error sending confirmation email: ' + error.message);
    // Don't throw - email failure shouldn't stop the enrollment
  }
}

/**
 * Setup function - Run this ONCE to create the form submit trigger
 * IMPORTANT: Delete any existing triggers before running this!
 */
function setupTrigger() {
  // First, delete all existing triggers for this project
  deleteAllTriggers();

  // Get the form
  const form = FormApp.getActiveForm();

  if (!form) {
    Logger.log('ERROR: No active form found. Please run this script from the form\'s script editor.');
    return;
  }

  // Create a new trigger for form submissions
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  Logger.log('Trigger created successfully!');
  Logger.log('The script will now run once for each form submission.');
}

/**
 * Delete all existing triggers to prevent duplicates
 * Run this if you're receiving multiple emails
 */
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  Logger.log('Found ' + triggers.length + ' existing triggers');

  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
    Logger.log('Deleted trigger: ' + trigger.getHandlerFunction());
  });

  Logger.log('All triggers deleted!');
}

/**
 * Test function - Use this to test the script without submitting the form
 */
function testScript() {
  // Sample test data
  const testData = {
    name: 'Test Student',
    year: 'Grade 10',
    subjects: '5',
    fees: '15000',
    phone: '01234567890'
  };

  const studentId = generateStudentId();
  const enrollmentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const rowData = [
    studentId,
    testData.name,
    testData.year,
    parseInt(testData.subjects),
    parseFloat(testData.fees),
    0, // discount percent
    0, // discount amount
    parseFloat(testData.fees), // net amount
    0, // total paid
    parseFloat(testData.fees), // remaining balance
    formatPhoneNumber(testData.phone),
    enrollmentDate,
    'Active',
    ''
  ];

  const result = writeToMasterSheet(rowData);
  Logger.log('Test result: ' + JSON.stringify(result));
}
