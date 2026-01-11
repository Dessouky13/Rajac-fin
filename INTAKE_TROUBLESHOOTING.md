# Student Intake System - Troubleshooting Guide

## Issues Identified

### 1. Multiple Email Notifications
**Problem**: Receiving multiple emails for each form submission

**Root Cause**: Duplicate triggers attached to your Google Apps Script

**Solution**:

1. **Open your Google Form**
2. Click on the **3 dots menu** (⋮) → **Script editor**
3. In the Apps Script editor, click on the **clock icon** (⏰) on the left sidebar (Triggers)
4. **Delete ALL existing triggers** by clicking the 3 dots (⋮) next to each trigger and selecting "Delete trigger"

5. **Run the setup function**:
   - Copy the code from `GoogleAppsScript-Intake.gs` file
   - Replace all existing code in your script editor
   - Update the `MASTER_SHEET_ID` in the CONFIG section (line 22)
   - Update the `ADMIN_EMAIL` in the CONFIG section (line 26)
   - Click **Save** (💾)
   - From the function dropdown at the top, select `setupTrigger`
   - Click **Run** (▶️)
   - Authorize the script if prompted
   - Check the execution log - it should say "Trigger created successfully!"

6. **Verify**: You should now have exactly ONE trigger:
   - Function: `onFormSubmit`
   - Event Type: "On form submit"

---

### 2. Numbers Not Appearing in Master Sheet
**Problem**: When uploading data with numbers, they appear as text or don't show up at all

**Root Causes**:
1. **Google Apps Script**: Numbers being passed as strings
2. **Data Type Mismatch**: Numeric values stored as text

**Solutions**:

#### A. Google Apps Script Fix (Already included in new script)
The new script (`GoogleAppsScript-Intake.gs`) includes:
- Proper numeric parsing using `parseFloat()` and `parseInt()`
- Number formatting for fee columns
- Validation to ensure numeric values are numbers, not strings

#### B. Backend Code Fix
The backend code also needs a small adjustment to ensure numbers are preserved.

**Check your spreadsheet**:
1. Open your Master_Students sheet
2. Click on column E (Total_Fees)
3. Check if values are **aligned left** (text) or **aligned right** (numbers)
4. If aligned left, they're stored as text!

**To fix existing data**:
Run this script in your Google Apps Script editor:

```javascript
function fixNumericColumns() {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID_HERE');
  const sheet = ss.getSheetByName('Master_Students');

  // Get all data
  const data = sheet.getDataRange().getValues();

  // Skip header row (row 0)
  for (let i = 1; i < data.length; i++) {
    // Column indices (0-based):
    // 4 = Total_Fees (E)
    // 7 = Net_Amount (H)
    // 9 = Remaining_Balance (J)
    const numericColumns = [4, 7, 9];

    numericColumns.forEach(col => {
      const value = data[i][col];
      if (typeof value === 'string' && value !== '') {
        // Convert string to number
        const numValue = parseFloat(value.replace(/[^0-9.]/g, ''));
        if (!isNaN(numValue)) {
          sheet.getRange(i + 1, col + 1).setValue(numValue);
        }
      }
    });
  }

  Logger.log('Fixed numeric columns for ' + (data.length - 1) + ' rows');
}
```

---

## How to Update Your Google Apps Script

### Step-by-Step Instructions:

1. **Backup your current script** (optional but recommended):
   - Copy all existing code to a text file
   - Save it as `backup-script.gs`

2. **Open your Google Form**:
   - Go to your student intake Google Form
   - Click on **More options** (⋮) → **Script editor**

3. **Replace the code**:
   - Select ALL existing code (Ctrl+A)
   - Delete it
   - Copy the entire content from `GoogleAppsScript-Intake.gs`
   - Paste it into the editor

4. **Configure the script**:
   ```javascript
   const CONFIG = {
     // Replace with your actual Spreadsheet ID
     // Find it in the URL: https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit
     MASTER_SHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

     // Change to your email
     ADMIN_EMAIL: 'your-admin-email@example.com',

     // Update these to match your form questions EXACTLY
     FORM_FIELDS: {
       NAME: 'Student Name',        // Must match form question
       YEAR: 'Grade/Year',          // Must match form question
       SUBJECTS: 'Number of Subjects',
       FEES: 'Total Fees',
       PHONE: 'Phone Number'
     }
   };
   ```

5. **Save the script**:
   - Click **Save** (💾)
   - Give your project a name (e.g., "RAJAC Student Intake Handler")

6. **Delete old triggers**:
   - Click the **clock icon** (⏰) on the left (Triggers)
   - Delete ALL existing triggers

7. **Create new trigger**:
   - In the function dropdown (top of editor), select `deleteAllTriggers`
   - Click **Run** (▶️)
   - Check execution log - should show triggers deleted
   - Then select `setupTrigger` from the dropdown
   - Click **Run** (▶️)
   - **Authorize** the script if prompted:
     - Click "Review permissions"
     - Select your Google account
     - Click "Advanced" → "Go to [Project name] (unsafe)"
     - Click "Allow"
   - Check execution log - should say "Trigger created successfully!"

8. **Test the script**:
   - Method 1: Submit a test form entry
   - Method 2: Run the `testScript` function from the editor
   - Check your Master_Students sheet for the new entry
   - Verify numbers appear as numbers (right-aligned, not left-aligned)

---

## Verification Checklist

After implementing the fixes, verify:

- [ ] Exactly ONE trigger exists in your Apps Script project
- [ ] Trigger function is named `onFormSubmit`
- [ ] Trigger event type is "On form submit"
- [ ] Test form submission creates exactly ONE row in Master_Students
- [ ] You receive exactly ONE email notification (if enabled)
- [ ] Numeric columns (Total_Fees, Net_Amount, Remaining_Balance) contain numbers, not text
- [ ] Numbers are right-aligned in the spreadsheet
- [ ] Phone numbers are formatted correctly (starting with 20)
- [ ] Student ID is generated in format STU26XXXX

---

## Common Errors and Solutions

### Error: "Cannot read property 'response' of undefined"
**Cause**: Script triggered manually instead of by form submission
**Solution**: Only the form submission should trigger the script. Don't run `onFormSubmit` manually.

### Error: "Exception: Requested entity was not found"
**Cause**: Invalid Spreadsheet ID in CONFIG
**Solution**: Double-check your MASTER_SHEET_ID in the CONFIG section

### Error: "You do not have permission to call SpreadsheetApp.openById"
**Cause**: Script not authorized
**Solution**: Reauthorize the script by running setupTrigger again

### Numbers still appearing as text
**Cause**: Old data was saved as text
**Solution**: Run the `fixNumericColumns` function (see above) to convert existing data

### Form field mapping not working
**Cause**: Form question text doesn't match CONFIG.FORM_FIELDS
**Solution**:
1. Open your form
2. Check the EXACT text of each question
3. Update CONFIG.FORM_FIELDS to match exactly

---

## Testing Your Setup

### Test 1: Manual Test
1. Submit a test form with known values:
   - Name: "Test Student 123"
   - Grade: "10"
   - Subjects: "5"
   - Fees: "15000"
   - Phone: "01234567890"

2. Check Master_Students sheet:
   - Should have exactly ONE new row
   - Student_ID format: STU26XXXX
   - Total_Fees: 15000 (number, right-aligned)
   - Phone: 201234567890

3. Check your email:
   - Should receive exactly ONE notification

### Test 2: Number Validation
1. Click on a cell in the Total_Fees column
2. The value should appear in the formula bar as a number (no quotes)
3. Right-click → Format cells → should show "Number" format

### Test 3: Multiple Submissions
1. Submit 3 forms in quick succession
2. Check Master_Students: should have exactly 3 new rows
3. Check email: should receive exactly 3 emails (one per submission)
4. Each row should have a unique Student_ID

---

## Maintenance

### Periodic Checks (Monthly)
1. **Verify trigger integrity**:
   - Check that exactly one trigger exists
   - If multiple triggers appear, run `deleteAllTriggers` then `setupTrigger`

2. **Data quality check**:
   - Review numeric columns for text values
   - Run `fixNumericColumns` if needed

3. **Test form submission**:
   - Submit a test entry
   - Verify data appears correctly

### If Issues Persist

1. **Check execution log**:
   - In Apps Script editor: View → Logs
   - Look for error messages

2. **Check trigger execution history**:
   - Click clock icon (⏰)
   - Review recent executions
   - Check for failures

3. **Enable detailed logging**:
   - Add more Logger.log() statements
   - Run test submission
   - Review logs

4. **Contact support** with:
   - Execution logs
   - Error messages
   - Screenshots of trigger setup
   - Sample form submission data

---

## Best Practices

1. **Never create triggers manually** - always use the `setupTrigger()` function
2. **Regular backups** - export your Master_Students sheet weekly
3. **Test before production** - always test with dummy data first
4. **Monitor email notifications** - if you start receiving multiples, check triggers immediately
5. **Data validation** - periodically check that numbers are stored as numbers
6. **Keep script updated** - if you modify the script, update documentation

---

## Contact Information

For technical support with this system, contact your system administrator with:
- Error messages from execution logs
- Screenshots of the issue
- Sample data that reproduces the problem
- Spreadsheet ID (for troubleshooting)

---

**Last Updated**: 2026-01-01
**Version**: 2.0
