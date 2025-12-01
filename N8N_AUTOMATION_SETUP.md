# n8n Automation Setup for Payment Reminders

## Overview
This guide explains how to set up automated payment reminders using n8n to send WhatsApp, SMS, and email notifications to parents in Egypt.

## API Endpoints Added

### 1. Get Overdue Payments for Automation
```
GET /api/automation/overdue-payments
```

**Response Format:**
```json
{
  "success": true,
  "message": "Overdue payments data retrieved for automation",
  "totalOverdue": 5,
  "retrievedAt": "2024-01-15T10:30:00.000Z",
  "data": [
    {
      "studentId": "STD001",
      "name": "Ahmed Mohamed",
      "year": "Grade 10",
      "phoneNumber": "+201234567890",
      "dueDate": "2024-01-10",
      "daysOverdue": 5,
      "installmentNumber": 2,
      "amountDue": 1500.00,
      "remainingBalance": 3000.00,
      "totalPaid": 1500.00,
      "netAmount": 4500.00,
      "lastUpdated": "2024-01-15T09:00:00.000Z"
    }
  ]
}
```

### 2. Log Reminder Delivery
```
POST /api/automation/log-reminder
```

**Request Body:**
```json
{
  "studentId": "STD001",
  "reminderType": "whatsapp", // or "sms", "email"
  "status": "sent", // or "delivered", "failed"
  "message": "Reminder sent successfully",
  "deliveredAt": "2024-01-15T10:35:00.000Z"
}
```

## n8n Workflow Setup

### Step 1: Create Workflow Trigger
1. **Schedule Trigger**: Set to run daily at 9:00 AM Cairo time
2. **Timezone**: Africa/Cairo
3. **Expression**: `0 9 * * *`

### Step 2: Fetch Overdue Payments
1. **HTTP Request Node**
   - Method: GET
   - URL: `https://your-backend-url/api/automation/overdue-payments`
   - Headers: None required (endpoint is public)

### Step 3: Process Each Student
1. **Split In Batches Node**
   - Batch Size: 1
   - Input Data: `{{ $json.data }}`

### Step 4: Choose Communication Method
Create branches for different reminder types:

#### WhatsApp Branch (Recommended for Egypt)
**Provider Options:**
1. **WhatsApp Business API** (Official - Higher cost but reliable)
2. **WhatsApp Web API** (Unofficial - Lower cost)
3. **Twilio WhatsApp** (Most reliable - Moderate cost)

**Estimated Costs:**
- WhatsApp Business API: $0.005-0.01 per message
- Twilio WhatsApp: $0.005 per message
- Unofficial APIs: $0.001-0.003 per message

#### SMS Branch
**Provider Options for Egypt:**
1. **Twilio**: $0.075 per SMS to Egypt
2. **Infobip**: $0.05-0.08 per SMS
3. **Local Egyptian Providers**: $0.02-0.04 per SMS

#### Email Branch
**Provider Options:**
1. **SendGrid**: Free up to 100 emails/day
2. **Mailgun**: $0.0006 per email
3. **Gmail SMTP**: Free (limited)

### Step 5: WhatsApp Setup (Recommended)

#### Using Twilio WhatsApp API:
1. **HTTP Request Node**
   - Method: POST
   - URL: `https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json`
   - Authentication: Basic Auth
     - Username: Your Twilio Account SID
     - Password: Your Twilio Auth Token
   - Headers:
     - Content-Type: `application/x-www-form-urlencoded`
   - Body (Form Data):
     ```
     From: whatsapp:+14155238886
     To: whatsapp:{{ $json.phoneNumber }}
     Body: مرحباً {{ $json.name }}، هذا تذكير بأن لديك مبلغ {{ $json.amountDue }} جنيه مصري متأخر منذ {{ $json.daysOverdue }} يوم. تاريخ الاستحقاق كان {{ $json.dueDate }}. يرجى الدفع في أقرب وقت ممكن.
     ```

#### Arabic Message Template:
```
مرحباً {{ student.name }}،

هذا تذكير بأن لديك مبلغ {{ student.amountDue }} جنيه مصري متأخر في الدفع.

📅 تاريخ الاستحقاق: {{ student.dueDate }}
⏰ عدد الأيام المتأخرة: {{ student.daysOverdue }} يوم
💰 المبلغ المطلوب: {{ student.amountDue }} ج.م

يرجى التواصل مع الإدارة لترتيب الدفع.

شكراً لتعاونكم
إدارة الأكاديمية
```

#### English Message Template:
```
Hello {{ student.name }},

This is a reminder that you have an overdue payment of {{ student.amountDue }} EGP.

📅 Due Date: {{ student.dueDate }}
⏰ Days Overdue: {{ student.daysOverdue }} days
💰 Amount Due: {{ student.amountDue }} EGP

Please contact the administration to arrange payment.

Thank you for your cooperation
Academy Administration
```

### Step 6: Log Delivery Status
1. **HTTP Request Node**
   - Method: POST
   - URL: `https://your-backend-url/api/automation/log-reminder`
   - Body:
     ```json
     {
       "studentId": "{{ $json.studentId }}",
       "reminderType": "whatsapp",
       "status": "{{ $json.status || 'sent' }}",
       "message": "{{ $json.message || 'Reminder sent successfully' }}",
       "deliveredAt": "{{ new Date().toISOString() }}"
     }
     ```

### Step 7: Error Handling
1. **Error Trigger Node** after each communication attempt
2. **Log failed attempts** to the same endpoint with status "failed"

## Cost Analysis (Monthly)

### Scenario: 100 overdue students, 4 reminders per month

#### WhatsApp (Recommended)
- **Twilio WhatsApp**: 100 students × 4 reminders × $0.005 = $2/month
- **WhatsApp Business**: 100 students × 4 reminders × $0.008 = $3.20/month

#### SMS
- **Local Egyptian Provider**: 100 students × 4 reminders × $0.03 = $12/month
- **Twilio SMS**: 100 students × 4 reminders × $0.075 = $30/month

#### Email
- **SendGrid**: Free up to 100 emails/day
- **Mailgun**: 100 students × 4 reminders × $0.0006 = $0.24/month

**Recommendation**: Use WhatsApp for best engagement in Egypt at lowest cost.

## Advanced Features

### 1. Smart Scheduling
- Morning reminders for parents (9 AM)
- Evening reminders for students (6 PM)
- Weekend special reminders

### 2. Escalation Logic
```javascript
// In n8n Function Node
if (student.daysOverdue > 30) {
  // Send to administration for direct contact
  reminderType = 'admin_alert';
} else if (student.daysOverdue > 14) {
  // Send urgent reminder
  reminderType = 'urgent';
} else if (student.daysOverdue > 7) {
  // Send regular reminder
  reminderType = 'regular';
}
```

### 3. Multi-language Support
Detect preferred language and send appropriate message.

### 4. Parent Portal Integration
Include link to online payment portal in messages.

## Security Considerations

1. **API Rate Limiting**: Implement rate limiting to prevent abuse
2. **Authentication**: Add API key authentication for production
3. **Data Privacy**: Ensure GDPR/local privacy compliance
4. **Phone Number Validation**: Validate Egyptian phone numbers

## Testing Workflow

1. **Test with Single Student**: Start with one test student
2. **Dry Run Mode**: Log messages without sending
3. **Gradual Rollout**: Start with 10 students, then scale up
4. **Monitor Delivery Rates**: Track success/failure rates

## Monitoring and Analytics

### Key Metrics to Track:
- Message delivery rate
- Response rate from parents
- Payment rate after reminders
- Cost per successful payment
- Best performing message times

### Dashboard Queries:
```sql
-- In your analytics tool
SELECT 
  reminderType,
  status,
  COUNT(*) as count,
  DATE(deliveredAt) as date
FROM reminder_logs 
GROUP BY reminderType, status, DATE(deliveredAt)
```

## Troubleshooting

### Common Issues:
1. **Invalid Phone Numbers**: Validate Egyptian format (+20xxxxxxxxxx)
2. **Rate Limiting**: Implement delays between messages
3. **Failed Deliveries**: Retry logic with exponential backoff
4. **Arabic Text Encoding**: Ensure UTF-8 encoding

### Error Codes:
- `400`: Invalid phone number format
- `429`: Rate limit exceeded
- `500`: Provider service error

## Next Steps

1. Set up n8n instance (cloud or self-hosted)
2. Choose communication provider and get API credentials
3. Create the workflow using the templates above
4. Test with a small group of students
5. Monitor performance and adjust as needed
6. Scale up to full student base

## Support

For technical support with the API endpoints, check the backend logs or contact the development team.