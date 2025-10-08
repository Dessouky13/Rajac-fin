const moment = require('moment');
const googleSheets = require('./googleSheets');
const whatsappService = require('./whatsappService');

class PaymentDueService {
  async checkOverduePayments() {
    try {
      console.log('Checking overdue payments...');
      
      const config = await googleSheets.getConfig();
      const numberOfInstallments = parseInt(config.Number_of_Installments || 3);
      
      const installmentDates = [];
      for (let i = 1; i <= numberOfInstallments; i++) {
        const dateKey = `Installment_${i}_Date`;
        if (config[dateKey]) {
          installmentDates.push({
            number: i,
            date: moment(config[dateKey]),
            dateString: config[dateKey]
          });
        }
      }

      if (installmentDates.length === 0) {
        console.log('No installment dates configured');
        return { overdueStudents: [] };
      }

      const students = await googleSheets.getSheetData('Master_Students');
      if (students.length <= 1) {
        return { overdueStudents: [] };
      }

      const headers = students[0];
      const overdueStudents = [];
      const today = moment();

      for (let i = 1; i < students.length; i++) {
        const row = students[i];
        const student = {};
        headers.forEach((header, index) => {
          student[header] = row[index] || '';
        });

        if (student.Status === 'Paid' || student.Status === 'Inactive') {
          continue;
        }

        const netAmount = parseFloat(student.Net_Amount || 0);
        const totalPaid = parseFloat(student.Total_Paid || 0);
        const remainingBalance = parseFloat(student.Remaining_Balance || 0);

        if (remainingBalance <= 0) continue;

        const installmentAmount = netAmount / numberOfInstallments;

        for (const installment of installmentDates) {
          if (today.isAfter(installment.date)) {
            const expectedPaidByThisDate = installmentAmount * installment.number;
            
            if (totalPaid < expectedPaidByThisDate) {
              const amountDue = expectedPaidByThisDate - totalPaid;
              const daysOverdue = today.diff(installment.date, 'days');

              overdueStudents.push({
                studentId: student.Student_ID,
                name: student.Name,
                year: student.Year,
                phoneNumber: student.Phone_Number,
                netAmount,
                totalPaid,
                remainingBalance,
                installmentNumber: installment.number,
                dueDate: installment.dateString,
                daysOverdue,
                amountDue: Math.min(amountDue, remainingBalance),
                expectedPaidByDate: expectedPaidByThisDate
              });

              break;
            }
          }
        }
      }

      await this.updateOverdueSheet(overdueStudents);

      return {
        overdueStudents,
        totalOverdue: overdueStudents.length,
        checkedAt: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    } catch (error) {
      console.error('Error checking overdue payments:', error);
      throw error;
    }
  }

  async updateOverdueSheet(overdueStudents) {
    try {
      await googleSheets.clearSheet('Overdue_Payments');

      if (overdueStudents.length > 0) {
        const rows = overdueStudents.map(s => [
          s.studentId,
          s.name,
          s.year,
          s.phoneNumber,
          s.netAmount,
          s.totalPaid,
          s.remainingBalance,
          s.dueDate,
          s.daysOverdue,
          s.installmentNumber,
          moment().format('YYYY-MM-DD HH:mm:ss')
        ]);

        await googleSheets.appendRows('Overdue_Payments', rows);
      }

      console.log(`Updated overdue sheet with ${overdueStudents.length} students`);
    } catch (error) {
      console.error('Error updating overdue sheet:', error);
      throw error;
    }
  }

  async sendPaymentReminders(daysBeforeDue = 7) {
    try {
      const config = await googleSheets.getConfig();
      const whatsappEnabled = config.WhatsApp_Notifications_Enabled === 'true';

      if (!whatsappEnabled) {
        console.log('WhatsApp notifications are disabled');
        return { remindersSent: 0, message: 'WhatsApp notifications disabled' };
      }

      const numberOfInstallments = parseInt(config.Number_of_Installments || 3);
      const installmentDates = [];
      
      for (let i = 1; i <= numberOfInstallments; i++) {
        const dateKey = `Installment_${i}_Date`;
        if (config[dateKey]) {
          installmentDates.push({
            number: i,
            date: moment(config[dateKey]),
            dateString: config[dateKey]
          });
        }
      }

      const students = await googleSheets.getSheetData('Master_Students');
      if (students.length <= 1) {
        return { remindersSent: 0 };
      }

      const headers = students[0];
      const today = moment();
      let remindersSent = 0;

      for (let i = 1; i < students.length; i++) {
        const row = students[i];
        const student = {};
        headers.forEach((header, index) => {
          student[header] = row[index] || '';
        });

        if (student.Status === 'Paid' || student.Status === 'Inactive') {
          continue;
        }

        const netAmount = parseFloat(student.Net_Amount || 0);
        const totalPaid = parseFloat(student.Total_Paid || 0);
        const remainingBalance = parseFloat(student.Remaining_Balance || 0);

        if (remainingBalance <= 0) continue;

        const installmentAmount = netAmount / numberOfInstallments;

        for (const installment of installmentDates) {
          const daysUntilDue = installment.date.diff(today, 'days');

          if (daysUntilDue > 0 && daysUntilDue <= daysBeforeDue) {
            const expectedPaidByThisDate = installmentAmount * installment.number;
            
            if (totalPaid < expectedPaidByThisDate) {
              const amountDue = Math.min(
                expectedPaidByThisDate - totalPaid,
                remainingBalance
              );

              const message = this.createReminderMessage(
                student.Name,
                amountDue,
                installment.dateString,
                installment.number,
                daysUntilDue
              );

              try {
                await whatsappService.sendMessage(student.Phone_Number, message);
                remindersSent++;
                console.log(`Reminder sent to ${student.Name} (${student.Phone_Number})`);
              } catch (error) {
                console.error(`Failed to send reminder to ${student.Name}:`, error.message);
              }

              break;
            }
          }
        }
      }

      return {
        remindersSent,
        sentAt: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    } catch (error) {
      console.error('Error sending payment reminders:', error);
      throw error;
    }
  }

  createReminderMessage(studentName, amountDue, dueDate, installmentNumber, daysUntilDue) {
    return `Dear Parent of ${studentName},

This is a payment reminder from ${process.env.SCHOOL_NAME || 'RAJAC Language School'}.

*Installment ${installmentNumber}* is due on *${dueDate}* (${daysUntilDue} days remaining).

Amount Due: *${amountDue.toFixed(2)} EGP*

Please ensure payment is made before the due date to avoid any inconvenience.

Thank you for your cooperation.`;
  }

  async getUpcomingDueDates() {
    try {
      const config = await googleSheets.getConfig();
      const numberOfInstallments = parseInt(config.Number_of_Installments || 3);
      
      const installmentDates = [];
      for (let i = 1; i <= numberOfInstallments; i++) {
        const dateKey = `Installment_${i}_Date`;
        if (config[dateKey]) {
          const date = moment(config[dateKey]);
          installmentDates.push({
            number: i,
            date: date.format('YYYY-MM-DD'),
            daysUntil: date.diff(moment(), 'days'),
            isPast: date.isBefore(moment())
          });
        }
      }

      return installmentDates;
    } catch (error) {
      console.error('Error getting upcoming due dates:', error);
      throw error;
    }
  }

  async updateInstallmentDates(installments) {
    try {
      for (const installment of installments) {
        const key = `Installment_${installment.number}_Date`;
        await googleSheets.updateConfig(key, installment.date);
      }

      await googleSheets.updateConfig(
        'Number_of_Installments',
        installments.length.toString()
      );

      return {
        success: true,
        message: 'Installment dates updated successfully',
        installments
      };
    } catch (error) {
      console.error('Error updating installment dates:', error);
      throw error;
    }
  }

  async getOverdueStudents() {
    try {
      const data = await googleSheets.getSheetData('Overdue_Payments');
      if (data.length <= 1) return [];

      const headers = data[0];
      const overdueStudents = data.slice(1).map(row => {
        const student = {};
        headers.forEach((header, index) => {
          student[header] = row[index] || '';
        });
        return student;
      });

      return overdueStudents;
    } catch (error) {
      console.error('Error getting overdue students:', error);
      throw error;
    }
  }
}

module.exports = new PaymentDueService();