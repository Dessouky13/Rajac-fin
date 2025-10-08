const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const googleSheets = require('./googleSheets');

class FinanceService {
  async recordTransaction(type, amount, subject, payerReceiverName, paymentMethod, notes = '', processedBy = 'System') {
    try {
      const transactionId = this.generateTransactionId();
      const date = moment().format('YYYY-MM-DD HH:mm:ss');

      const transactionRow = [
        transactionId,
        date,
        type,
        amount,
        subject,
        payerReceiverName,
        paymentMethod,
        notes,
        processedBy
      ];

      await googleSheets.appendRows('In_Out_Transactions', [transactionRow]);

      // Update analytics after recording a transaction (best-effort)
      try {
        const summary = await this.getFinancialSummary();
        await googleSheets.writeAnalytics(summary);
      } catch (err) {
        console.error('Warning: failed to update analytics after transaction:', err && err.message ? err.message : err);
      }

      return {
        success: true,
        transaction: {
          transactionId,
          date,
          type,
          amount,
          subject,
          payerReceiverName,
          paymentMethod,
          notes,
          processedBy
        }
      };
    } catch (error) {
      console.error('Error recording transaction:', error);
      throw error;
    }
  }

  async recordBankDeposit(amount, bankName, depositedBy = 'System', notes = '') {
    try {
      const depositId = this.generateDepositId();
      const date = moment().format('YYYY-MM-DD HH:mm:ss');

      const depositRow = [
        depositId,
        date,
        amount,
        bankName,
        depositedBy,
        notes
      ];

      await googleSheets.appendRows('Bank_Deposits', [depositRow]);

      // Update analytics after recording a bank deposit (best-effort)
      try {
        const summary = await this.getFinancialSummary();
        await googleSheets.writeAnalytics(summary);
      } catch (err) {
        console.error('Warning: failed to update analytics after bank deposit:', err && err.message ? err.message : err);
      }

      return {
        success: true,
        deposit: {
          depositId,
          date,
          amount,
          bankName,
          depositedBy,
          notes
        }
      };
    } catch (error) {
      console.error('Error recording bank deposit:', error);
      throw error;
    }
  }

  generateTransactionId() {
    const date = moment().format('YYYYMMDD');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TXN${date}${random}`;
  }

  generateDepositId() {
    const date = moment().format('YYYYMMDD');
    const random = Math.floor(100 + Math.random() * 900);
    return `DEP${date}${random}`;
  }

  async getTransactions(startDate = null, endDate = null, type = null) {
    try {
      const data = await googleSheets.getSheetData('In_Out_Transactions');
      if (data.length <= 1) return [];

      const headers = data[0];
      let transactions = data.slice(1).map(row => {
        const transaction = {};
        headers.forEach((header, index) => {
          transaction[header] = row[index] || '';
        });
        return transaction;
      });

      if (type) {
        transactions = transactions.filter(t => t.Type === type);
      }

      if (startDate && endDate) {
        transactions = transactions.filter(t => {
          const txnDate = moment(t.Date);
          return txnDate.isBetween(moment(startDate), moment(endDate), null, '[]');
        });
      }

      return transactions;
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  async getBankDeposits(startDate = null, endDate = null) {
    try {
      const data = await googleSheets.getSheetData('Bank_Deposits');
      if (data.length <= 1) return [];

      const headers = data[0];
      let deposits = data.slice(1).map(row => {
        const deposit = {};
        headers.forEach((header, index) => {
          deposit[header] = row[index] || '';
        });
        return deposit;
      });

      if (startDate && endDate) {
        deposits = deposits.filter(d => {
          const depDate = moment(d.Date);
          return depDate.isBetween(moment(startDate), moment(endDate), null, '[]');
        });
      }

      return deposits;
    } catch (error) {
      console.error('Error getting bank deposits:', error);
      throw error;
    }
  }

  async getFinancialSummary() {
    try {
      const [students, transactions, deposits, payments, teachers] = await Promise.all([
        googleSheets.getSheetData('Master_Students'),
        googleSheets.getSheetData('In_Out_Transactions'),
        googleSheets.getSheetData('Bank_Deposits'),
        googleSheets.getSheetData('Payments_Log'),
        googleSheets.getTeachers()
      ]);

      let totalCashInHand = 0;
      let totalInBank = 0;
      let totalStudentPayments = 0;
      let totalExpenses = 0;
      let totalIncome = 0;

      // For richer analytics
      const paymentsByMonth = {};
      const transactionsByMonth = {};
      const depositsByMonth = {};
      const recent = [];

      if (payments.length > 1) {
        const paymentHeaders = payments[0];
        const amountIndex = paymentHeaders.indexOf('Amount_Paid');
        const methodIndex = paymentHeaders.indexOf('Payment_Method');
        const dateIndex = paymentHeaders.indexOf('Payment_Date');

        // Treat Payments_Log as the canonical record of student payments.
        // Bank_Deposits represent transfers (usually cash->bank) and other bank movements.
        const isCashMethod = (m) => String(m || '').toLowerCase() === 'cash';

        payments.slice(1).forEach(row => {
          const amount = parseFloat(row[amountIndex] || 0) || 0;
          const method = row[methodIndex] || '';
          const dateStr = row[dateIndex] || '';
          totalStudentPayments += amount;

          if (isCashMethod(method)) {
            totalCashInHand += amount;
          } else {
            // For non-cash student payments we'll consider the payment recorded here but
            // only count bank increase when there is an explicit Bank_Deposits record.
            // So do not add to totalInBank here to avoid double-counting.
          }

          // monthly aggregation
          const month = require('moment')(dateStr || undefined).format('YYYY-MM');
          paymentsByMonth[month] = (paymentsByMonth[month] || 0) + amount;

          recent.push({ kind: 'payment', date: dateStr, amount, method, raw: row });
        });
      }

      if (transactions.length > 1) {
        const txnHeaders = transactions[0];
        const typeIndex = txnHeaders.indexOf('Type');
        const amountIndex = txnHeaders.indexOf('Amount');
        const methodIndex = txnHeaders.indexOf('Payment_Method');
        const dateIndex = txnHeaders.indexOf('Date');

        transactions.slice(1).forEach(row => {
          const type = (row[typeIndex] || '').toString().toLowerCase();
          const amount = parseFloat(row[amountIndex] || 0) || 0;
          const method = row[methodIndex] || '';
          const dateStr = row[dateIndex] || '';

          const isCash = String(method || '').toLowerCase() === 'cash';

          if (type === 'in' || type === 'income') {
            totalIncome += amount;
            if (isCash) {
              totalCashInHand += amount;
            } else {
              totalInBank += amount;
            }
          } else if (type === 'out' || type === 'expense') {
            totalExpenses += amount;
            if (isCash) {
              totalCashInHand -= amount;
            } else {
              totalInBank -= amount;
            }
          }

          const month = require('moment')(dateStr || undefined).format('YYYY-MM');
          transactionsByMonth[month] = transactionsByMonth[month] || { income: 0, expenses: 0 };
          if (type === 'in' || type === 'income') transactionsByMonth[month].income += amount;
          if (type === 'out' || type === 'expense') transactionsByMonth[month].expenses += amount;

          recent.push({ kind: 'transaction', date: dateStr, type, amount, method, raw: row });
        });
      }

      if (deposits.length > 1) {
        const depHeaders = deposits[0];
        const amountIndex = depHeaders.indexOf('Amount');
        const dateIndex = depHeaders.indexOf('Date');

        deposits.slice(1).forEach(row => {
          const amount = parseFloat(row[amountIndex] || 0) || 0;
          const dateStr = row[dateIndex] || '';
          // Bank deposits move cash into bank (typically cash collected deposited into bank)
          totalInBank += amount;
          totalCashInHand -= amount;

          const month = require('moment')(dateStr || undefined).format('YYYY-MM');
          depositsByMonth[month] = (depositsByMonth[month] || 0) + amount;

          recent.push({ kind: 'deposit', date: dateStr, amount, raw: row });
        });
      }

      let totalStudents = 0;
      let activeStudents = 0;
      let totalFeesExpected = 0;
      let totalFeesCollected = 0;
      let totalOutstanding = 0;

      if (students.length > 1) {
        const stuHeaders = students[0];
        const netAmountIndex = stuHeaders.indexOf('Net_Amount');
        const totalPaidIndex = stuHeaders.indexOf('Total_Paid');
        const remainingIndex = stuHeaders.indexOf('Remaining_Balance');
        const statusIndex = stuHeaders.indexOf('Status');

        students.slice(1).forEach(row => {
          totalStudents++;
          const status = row[statusIndex] || '';
          if (status.toLowerCase() === 'active') activeStudents++;

          totalFeesExpected += parseFloat(row[netAmountIndex] || 0);
          totalFeesCollected += parseFloat(row[totalPaidIndex] || 0);
          totalOutstanding += parseFloat(row[remainingIndex] || 0);
        });
      }

      // Build monthly summary for last 12 months (or available months)
      const monthsSet = new Set([
        ...Object.keys(paymentsByMonth),
        ...Object.keys(transactionsByMonth),
        ...Object.keys(depositsByMonth)
      ]);

      const months = Array.from(monthsSet).sort();
      const monthly = months.map(m => {
        const incomeFromTx = (transactionsByMonth[m] && transactionsByMonth[m].income) || 0;
        const expensesFromTx = (transactionsByMonth[m] && transactionsByMonth[m].expenses) || 0;
        const feesCollected = paymentsByMonth[m] || 0;
        const depositsAmt = depositsByMonth[m] || 0;
        const net = (incomeFromTx + feesCollected + depositsAmt) - expensesFromTx;
        return { month: m, income: incomeFromTx, expenses: expensesFromTx, feesCollected, deposits: depositsAmt, net };
      });

      // Recent items (latest 20)
      recent.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const recentItems = recent.slice(0, 20);

      let totalTeachers = 0;
      let totalTeacherPayments = 0;
      let totalTeacherOutstanding = 0;

      teachers.forEach(teacher => {
        totalTeachers++;
        totalTeacherPayments += teacher.totalPaid || 0;
        totalTeacherOutstanding += teacher.remainingBalance || 0;
      });

      return {
        cash: {
          totalCashInHand: Math.max(0, Math.round(totalCashInHand * 100) / 100),
          description: 'Current cash available'
        },
        bank: {
          totalInBank: Math.round(totalInBank * 100) / 100,
          description: 'Total amount deposited in bank'
        },
        students: {
          totalStudents,
          activeStudents,
          totalFeesExpected: Math.round(totalFeesExpected * 100) / 100,
          totalFeesCollected: Math.round(totalFeesCollected * 100) / 100,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          collectionRate: totalFeesExpected > 0
            ? ((totalFeesCollected / totalFeesExpected) * 100).toFixed(2) + '%'
            : '0%'
        },
        teachers: {
          totalTeachers,
          totalPayments: Math.round(totalTeacherPayments * 100) / 100,
          totalOutstanding: Math.round(totalTeacherOutstanding * 100) / 100
        },
        transactions: {
          totalIncome: Math.round((totalIncome + totalStudentPayments) * 100) / 100,
          totalExpenses: Math.round((totalExpenses + totalTeacherPayments) * 100) / 100, // Include teacher payments as expenses
          netProfit: Math.round(((totalIncome + totalStudentPayments) - (totalExpenses + totalTeacherPayments)) * 100) / 100
        },
        monthly,
        recent: recentItems
      };
    } catch (error) {
      console.error('Error getting financial summary:', error);
      throw error;
    }
  }
}

module.exports = new FinanceService();