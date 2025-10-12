# Duplicate Student Checking Feature

## Overview
When uploading new student data (via file upload or Google Drive), the system now automatically checks for duplicate students and handles them intelligently.

## How Duplicate Detection Works

### Detection Criteria
A student is considered a duplicate if **both** of the following match an existing student:
- **Name** (case-insensitive, trimmed)
- **Grade/Year** (case-insensitive, trimmed)

### What Gets Updated for Duplicates
When a duplicate is found, the system **only updates**:
- ✅ **Total Fees** - Updated to new value
- ✅ **Net Amount** - Recalculated based on new total fees
- ✅ **Number of Subjects** - Updated to new value
- ✅ **Remaining Balance** - Recalculated (new net amount - existing payments)
- ✅ **Status** - Updated if balance becomes zero

### What Gets Preserved for Duplicates
The system **preserves existing data** for:
- 🔒 **Student ID** - Keeps original ID
- 🔒 **Phone Number** - Keeps existing phone
- 🔒 **Enrollment Date** - Keeps original enrollment date
- 🔒 **Total Paid** - Preserves all existing payments
- 🔒 **Discount Percent** - Keeps existing discount
- 🔒 **Discount Amount** - Keeps existing discount amount

## User Experience

### File Upload Response
When uploading a student file, users will see:
```
Processing complete!
• 15 new students added
• 3 duplicates found and updated
  (Updated fees and subject count only)
```

### Google Drive Import Response
When processing from Google Drive:
```
2 file(s) processed successfully.
• 25 new students added
• 5 duplicates updated (fees & subjects only)
```

## Technical Implementation

### Backend Changes
1. **Modified `saveStudentsToSheets()` in `studentService.js`**:
   - Checks existing Master_Students sheet for duplicates
   - Separates students into "new" and "update" lists
   - Updates duplicate rows in-place using Google Sheets API
   - Adds only new students to the sheet

2. **Added `updateRowRange()` method in `googleSheets.js`**:
   - Supports updating specific cell ranges in Google Sheets
   - Used for updating existing student rows

3. **Enhanced return values**:
   - APIs now return detailed statistics about processing
   - Includes counts of new students, updates, and duplicates found

### Frontend Changes
1. **New Upload Component** (`upload-students-btn.tsx`):
   - File input for Excel/CSV files
   - Shows detailed processing results
   - Handles duplicate information in success messages

2. **Enhanced Drive Processing** (`process-drive-students-btn.tsx`):
   - Updated to show duplicate information
   - Better user feedback about what was processed

3. **Added to Header**:
   - Upload button now available in header alongside Drive import
   - Both show duplicate handling results

## Example Scenarios

### Scenario 1: New Student
```
Upload: Ahmed Mohamed, Grade 10, 3 subjects, 3000 EGP
Result: Added as new student with generated ID
```

### Scenario 2: Duplicate Student - Fee Update
```
Existing: Ahmed Mohamed, Grade 10, 2 subjects, 2500 EGP, 1000 EGP paid
Upload:   Ahmed Mohamed, Grade 10, 4 subjects, 3500 EGP
Result:   Updated to 4 subjects, 3500 EGP total, 2500 EGP remaining (kept 1000 EGP paid)
```

### Scenario 3: Duplicate Student - Same Name, Different Grade
```
Existing: Ahmed Mohamed, Grade 10
Upload:   Ahmed Mohamed, Grade 11
Result:   Added as new student (different grade = not duplicate)
```

## Benefits

### For School Administration
- **Prevents Data Duplication**: No more duplicate student records
- **Preserves Payment History**: All existing payments are maintained
- **Flexible Fee Updates**: Easy to update fees without losing data
- **Clear Reporting**: Always know what was added vs updated

### For Receptionists
- **Error Prevention**: Can't accidentally create duplicates
- **Simple Process**: Just upload file, system handles duplicates automatically
- **Clear Feedback**: Immediately know if duplicates were found and updated

### For Data Integrity
- **Consistent IDs**: Student IDs remain stable across updates
- **Payment Preservation**: Financial records never lost
- **Audit Trail**: Clear distinction between new and updated records

## File Format Requirements

### Supported File Types
- Excel files (.xlsx, .xls)
- CSV files (.csv)

### Required Columns
The system accepts flexible column names for:
- **Name**: "Name", "Student Name", "Full Name", "name"
- **Grade**: "Year", "Grade", "Class", "Level"
- **Subjects**: "Number_of_Subjects", "Number of Subjects", "Subjects", "Subject Count"
- **Fees**: "Total_Fees", "TOTAL Fees", "Total Fees", "Fees", "Amount", "Course Fees", "Tuition"
- **Phone**: "Phone_Number", "Phone Number", "Phone", "Mobile", "Contact Number"

### Sample Excel Format
| Student Name | Grade | Number of Subjects | Total Fees | Phone Number |
|--------------|-------|-------------------|------------|--------------|
| Ahmed Mohamed | 10 | 4 | 3500 | 01234567890 |
| Sara Ali | 9 | 3 | 2800 | 01987654321 |

## Error Handling

### Invalid File Types
- Shows error: "Please upload an Excel (.xlsx, .xls) or CSV file"

### Missing Required Data
- System processes valid rows and skips invalid ones
- Reports how many students were processed successfully

### Google Sheets API Errors
- Detailed error logging in backend
- User-friendly error messages in frontend
- Graceful fallback handling

## Monitoring and Logs

### Backend Logs
```
Found duplicate student: Ahmed Mohamed in Grade 10. Updating fees and subjects.
Updated duplicate student: Ahmed Mohamed in row 15
Adding 12 new students to Master_Students
```

### API Response Format
```json
{
  "success": true,
  "studentsProcessed": 15,
  "studentsAdded": 12,
  "studentsUpdated": 3,
  "duplicatesFound": 3,
  "students": [...]
}
```

This feature ensures data integrity while making it easy for staff to update student information without worrying about creating duplicates or losing existing payment data.