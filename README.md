# RAJAC Language School Finance System

Complete backend system for managing student enrollments, payments, installments, and financial transactions.

## 🎯 Features

### 1. Student Enrollment
- Upload Excel files with student information
- Automatic data extraction and validation
- Unique student ID generation
- Auto-archive uploaded files to Google Drive
- Grade-wise student organization

### 2. Payment Management
- Search students by ID or name
- Apply dynamic discounts
- Multiple payment methods (Cash, InstaPay, Visa, Check)
- Real-time balance calculations
- Complete payment history logging

### 3. Finance Operations
- In/Out transaction recording
- Bank deposit management
- Comprehensive financial analytics
- Cash vs Bank balance tracking

### 4. Installment Due System
- Dynamic installment date configuration (2/3/4 installments)
- Automatic overdue payment detection
- WhatsApp payment reminders
- Days-before-due notifications
- Overdue tracking with phone numbers

### 5. Analytics Dashboard
- Current cash in hand
- Total bank deposits
- Student payment statistics
- Overdue payments with contact info
- Collection rate analysis

## 📋 Prerequisites

1. **Node.js** (v14 or higher)
2. **Google Cloud Account** with:
   - Google Drive API enabled
   - Google Sheets API enabled
   - Service Account with credentials
3. **Twilio Account** (for WhatsApp notifications)

## 🚀 Installation

### Step 1: Clone and Install

```bash
# Create project directory
mkdir rajac-finance-system
cd rajac-finance-system

# Initialize project
npm init -y

# Install dependencies
npm install express googleapis multer xlsx dotenv jsonwebtoken bcryptjs cors node-cron axios moment uuid
npm install --save-dev nodemon
```

### Step 2: Google Cloud Setup

1. **Create a Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable Google Drive API and Google Sheets API

2. **Create Service Account:**
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Name it (e.g., "rajac-finance-service")
   - Grant roles: "Editor" or specific API roles
   - Create and download JSON key

3. **Create Google Drive Folder:**
   - Create a folder for uploads in Google Drive
   - Share it with the service account email (from JSON)
   - Copy the folder ID from the URL

4. **Create Master Spreadsheet:**
   - Create a new Google Sheet
   - Share it with the service account email
   - Copy the spreadsheet ID from the URL

### Step 3: Twilio WhatsApp Setup

1. Sign up at [Twilio](https://www.twilio.com/)
2. Get a WhatsApp-enabled number
3. Note your Account SID, Auth Token, and WhatsApp number

### Step 4: Environment Configuration

Create `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development

# JWT Secret
JWT_SECRET=your_strong_secret_key_min_32_characters

# Google Configuration
GOOGLE_CLIENT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id
GOOGLE_MASTER_SHEET_ID=your_spreadsheet_id

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# School Configuration
SCHOOL_NAME=RAJAC Language School
DEFAULT_INSTALLMENTS=3
```

### Step 5: Project Structure

Create the following structure:

```
rajac-finance-system/
├── services/
│   ├── googleSheets.js
│   ├── googleDrive.js
│   ├── studentService.js
│   ├── financeService.js
│   ├── paymentDueService.js
│   └── whatsappService.js
├── uploads/
├── .env
├── .env.example
├── package.json
├── server.js
└── README.md
```

### Step 6: Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📡 API Endpoints

### Student Management

#### Upload Student Enrollment File
```http
POST /api/students/upload
Content-Type: multipart/form-data

file: [Excel file with columns: Name, Year, Number of Subjects, TOTAL Fees, Phone Number]
```

#### Search Student
```http
GET /api/students/search/:identifier
# identifier can be student ID or name
```

#### Get All Students
```http
GET /api/students
```

### Payment Processing

#### Process Payment
```http
POST /api/payments/process
Content-Type: application/json

{
  "studentId": "STU251234",
  "amountPaid": 1000,
  "paymentMethod": "Cash",
  "discountPercent": 10,
  "processedBy": "Ahmed"
}
```

#### Apply Discount
```http
POST /api/payments/apply-discount
Content-Type: application/json

{
  "studentId": "STU251234",
  "discountPercent": 15
}
```

#### Check Overdue Payments
```http
GET /api/payments/overdue
```

#### Send Payment Reminders
```http
POST /api/payments/send-reminders
Content-Type: application/json

{
  "daysBeforeDue": 7
}
```

### Finance Operations

#### Record Transaction
```http
POST /api/finance/transaction
Content-Type: application/json

{
  "type": "in",
  "amount": 5000,
  "subject": "Book Sales",
  "payerReceiverName": "Ahmed Mohamed",
  "paymentMethod": "Cash",
  "notes": "September book sales",
  "processedBy": "Finance Team"
}
```

#### Get Transactions
```http
GET /api/finance/transactions?startDate=2025-01-01&endDate=2025-12-31&type=in
```

### Bank Operations

#### Record Bank Deposit
```http
POST /api/bank/deposit
Content-Type: application/json

{
  "amount": 50000,
  "bankName": "National Bank of Egypt",
  "depositedBy": "Mohamed Ali",
  "notes": "Weekly deposit"
}
```

#### Get Bank Deposits
```http
GET /api/bank/deposits?startDate=2025-01-01&endDate=2025-12-31
```

### Analytics

#### Get Financial Summary
```http
GET /api/analytics
```

Response:
```json
{
  "success": true,
  "analytics": {
    "cash": {
      "totalCashInHand": 45000,
      "description": "Current cash available"
    },
    "bank": {
      "totalInBank": 150000,
      "description": "Total amount deposited in bank"
    },
    "students": {
      "totalStudents": 250,
      "activeStudents": 245,
      "totalFeesExpected": 500000,
      "totalFeesCollected": 350000,
      "totalOutstanding": 150000,
      "collectionRate": "70.00%"
    },
    "transactions": {
      "totalIncome": 360000,
      "totalExpenses": 100000,
      "netProfit": 260000
    },
    "overduePayments": {
      "totalOverdue": 15,
      "students": [...]
    }
  }
}
```

### Configuration

#### Get Installment Dates
```http
GET /api/config/installments
```

#### Update Installment Dates
```http
PUT /api/config/installments
Content-Type: application/json

{
  "installments": [
    { "number": 1, "date": "2025-10-15" },
    { "number": 2, "date": "2025-12-15" },
    { "number": 3, "date": "2026-02-15" }
  ]
}
```

#### Get All Configuration
```http
GET /api/config
```

#### Update Specific Setting
```http
PUT /api/config/WhatsApp_Notifications_Enabled
Content-Type: application/json

{
  "value": "true"
}
```

## ⚙️ Automated Tasks

### Daily Overdue Check (9:00 AM)
- Scans all active students
- Calculates expected payments based on installment dates
- Updates Overdue_Payments sheet
- Lists students with missed payments

### Daily Payment Reminders (10:00 AM)
- Sends WhatsApp notifications to parents
- Configurable days-before-due threshold
- Only sends to students with upcoming payments
- Respects WhatsApp_Notifications_Enabled setting

## 📊 Google Sheets Structure

### Master_Students
- Student_ID, Name, Year, Number_of_Subjects
- Total_Fees, Discount_Percent, Discount_Amount, Net_Amount
- Total_Paid, Remaining_Balance, Phone_Number
- Enrollment_Date, Status, Last_Payment_Date

### Grade_1 to Grade_12
- Individual sheets for each grade
- Subset of student information per year

### Payments_Log
- Complete payment history
- Payment_ID, Student details, Amount, Method
- Discount applied, Installment number, Processor

### In_Out_Transactions
- All income and expense transactions
- Transaction_ID, Date, Type, Amount
- Subject, Payer/Receiver, Payment method

### Bank_Deposits
- All bank deposit records
- Deposit_ID, Date, Amount, Bank_Name
- Deposited_By, Notes

### Overdue_Payments
- Auto-updated daily
- Student details, Amount due, Days overdue
- Installment number, Phone numbers for contact

### Config
- System configuration settings
- Installment dates and count
- WhatsApp notification settings
- Academic year information

## 🔐 Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Rotate service account keys** regularly
3. **Use strong JWT secrets** (32+ characters)
4. **Implement rate limiting** for production
5. **Add authentication** for API endpoints (JWT recommended)
6. **Use HTTPS** in production
7. **Validate all inputs** before processing

## 🐛 Troubleshooting

### Google Sheets API Errors
- Verify service account has access to spreadsheet
- Check API is enabled in Google Cloud Console
- Ensure private key format is correct (with \n)

### WhatsApp Messages Not Sending
- Verify Twilio credentials
- Check phone number format (must include country code)
- Ensure WhatsApp sandbox is approved (for testing)

### File Upload Issues
- Check `uploads/` directory exists and has write permissions
- Verify Excel file format (.xlsx or .xls)
- Ensure required columns exist in uploaded file

### Overdue Detection Not Working
- Verify installment dates are configured
- Check Config sheet has correct date format (YYYY-MM-DD)
- Ensure cron jobs are running

## 📞 Support

For issues or questions:
1. Check logs in console
2. Verify environment variables
3. Test API endpoints with tools like Postman
4. Review Google Sheets for data consistency

## 📝 License

Proprietary - RAJAC Language School

---

**Built with ❤️ for RAJAC Language School**

---

## 🔄 How to Deploy New Changes (GitHub & GCP)

Whenever you want to update production, always follow these steps:

### 1. Make Changes Locally
- Edit your code as needed on your local machine.

### 2. Commit and Push to GitHub
```bash
git add .
git commit -m "Describe your update"
git push origin main
```

### 3. Deploy to Google Cloud Run (GCP)
- Make sure your local code matches GitHub (production):
```bash
git pull origin main
```
- Build and push the Docker image from the Backend directory:
```bash
gcloud builds submit --tag gcr.io/dogwood-harmony-459220-n7/rajac-finance-backend ./Backend
```
- Deploy the new image to Cloud Run:
```bash
gcloud run deploy rajac-finance-backend \
  --image gcr.io/dogwood-harmony-459220-n7/rajac-finance-backend \
  --region us-central1 \
  --platform managed
```

**Tip:**
- Always check that your code is up to date with GitHub before deploying.
- You must be authenticated with `gcloud auth login` and have the correct project set: `gcloud config set project YOUR_PROJECT_ID`
- The service URL will be shown after deployment.

---
