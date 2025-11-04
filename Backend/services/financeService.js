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

      // Log action for undo capability
      try {
        const actionId = uuidv4();
        const ts = date;
        await googleSheets.appendRows('Actions_Log', [[actionId, ts, 'transaction', transactionId, processedBy, JSON.stringify({ transactionRow })]]);
      } catch (err) {
        console.error('Warning: failed to log action for transaction:', err && err.message ? err.message : err);
      }

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

      // Log action
      try {
        const actionId = uuidv4();
        const ts = date;
        await googleSheets.appendRows('Actions_Log', [[actionId, ts, 'bank_deposit', depositId, depositedBy, JSON.stringify({ depositRow })]]);
      } catch (err) {
        console.error('Warning: failed to log action for bank deposit:', err && err.message ? err.message : err);
      }

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

  async recordBankWithdrawal(amount, bankName, withdrawnBy = 'System', notes = '') {
    try {
      const withdrawalId = this.generateDepositId();
      const date = moment().format('YYYY-MM-DD HH:mm:ss');
      const normalizedAmount = -Math.abs(amount);

      const withdrawalRow = [
        withdrawalId,
        date,
        normalizedAmount,
        bankName,
        withdrawnBy,
        notes || 'Withdrawal to cash'
      ];

      await googleSheets.appendRows('Bank_Deposits', [withdrawalRow]);

      // Log action
      try {
        const actionId = uuidv4();
        const ts = date;
        await googleSheets.appendRows('Actions_Log', [[actionId, ts, 'bank_withdrawal', withdrawalId, withdrawnBy, JSON.stringify({ withdrawalRow })]]);
      } catch (err) {
        console.error('Warning: failed to log action for bank withdrawal:', err && err.message ? err.message : err);
      }

      try {
        const summary = await this.getFinancialSummary();
        await googleSheets.writeAnalytics(summary);
      } catch (err) {
        console.error('Warning: failed to update analytics after bank withdrawal:', err && err.message ? err.message : err);
      }

      return {
        success: true,
        withdrawal: {
          withdrawalId,
          date,
          amount: normalizedAmount,
          bankName,
          withdrawnBy,
          notes
        }
      };
    } catch (error) {
      console.error('Error recording bank withdrawal:', error);
      throw error;
    }
  }

  // Revert the last `count` actions recorded in Actions_Log. Best-effort: will remove rows that match logged details.
  async revertLastActions(count = 1) {
    try {
      // Read Actions_Log
      const actionsSheet = await googleSheets.getSheetData('Actions_Log');
      if (actionsSheet.length <= 1) return { success: true, reverted: 0, message: 'No actions logged' };

      const actions = actionsSheet.slice(1).map(row => ({
        actionId: row[0], ts: row[1], actionType: row[2], refId: row[3], performedBy: row[4], details: row[5]
      })).reverse(); // latest first

      const toRevert = actions.slice(0, count);
      let reverted = 0;

      for (const a of toRevert) {
        try {
          const ok = await this.revertActionById(a.actionId);
          if (ok) reverted++;
        } catch (innerErr) {
          console.error('Error reverting action', a, innerErr);
        }
      }

      // Refresh analytics after revert
      try {
        const summary = await this.getFinancialSummary();
        await googleSheets.writeAnalytics(summary);
      } catch (e) {
        console.error('Warning: failed to update analytics after revert:', e && e.message ? e.message : e);
      }

      return { success: true, reverted };
    } catch (error) {
      console.error('Error reverting actions:', error);
      throw error;
    }
  }

  // Revert a single action by its actionId. Returns true if an action was reverted.
  async revertActionById(actionId) {
    try {
      if (!actionId) return false;
      const allActions = await googleSheets.getSheetData('Actions_Log');
      if (allActions.length <= 1) return false;

      // Find the action row and its index
      let actionRow = null;
      let actionRowIndex = -1;
      for (let i = 1; i < allActions.length; i++) {
        if ((allActions[i][0] || '') === actionId) {
          actionRow = allActions[i];
          actionRowIndex = i + 1; // 1-based in Sheets
          break;
        }
      }

      if (!actionRow) return false;

      const a = {
        actionId: actionRow[0],
        ts: actionRow[1],
        actionType: actionRow[2],
        refId: actionRow[3],
        performedBy: actionRow[4],
        details: actionRow[5]
      };

      const details = a.details ? JSON.parse(a.details) : {};

      // Handle student fee update revert
      if (a.actionType === 'update_fees' && details.before) {
        const studentId = a.refId;
        const before = details.before;
        const master = await googleSheets.getSheetData('Master_Students');
        if (master.length > 1) {
          const headers = master[0];
          const idIndex = headers.indexOf('Student_ID');
          for (let i = 1; i < master.length; i++) {
            if ((master[i][idIndex] || '') === studentId) {
              const r = {};
              headers.forEach((h, idx) => { r[h] = master[i][idx] || ''; });
              const updatedRow = [
                r.Student_ID || '',
                r.Name || '',
                r.Year || '',
                r.Number_of_Subjects || 0,
                before.totalFees || before.Total_Fees || 0,
                r.Discount_Percent || 0,
                r.Discount_Amount || 0,
                before.netAmount || before.Net_Amount || 0,
                r.Total_Paid || 0,
                before.remainingBalance || before.Remaining_Balance || 0,
                r.Phone_Number || '',
                r.Enrollment_Date || '',
                (before.remainingBalance || before.Remaining_Balance || 0) <= 0 ? 'Paid' : (r.Status || 'Active'),
                r.Last_Payment_Date || ''
              ];
              await googleSheets.updateRow('Master_Students', i + 1, updatedRow);
              // Remove action log row
              await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `Actions_Log!A${actionRowIndex}:F${actionRowIndex}` });
              return true;
            }
          }
        }
      }

      // Handle student payment revert
      if (a.actionType === 'student_payment' && details.paymentRow) {
        const paymentId = a.refId;
        const payments = await googleSheets.getSheetData('Payments_Log');
        if (payments.length > 1) {
          const headers = payments[0];
          const idIndex = headers.indexOf('Payment_ID');
          for (let i = 1; i < payments.length; i++) {
            if ((payments[i][idIndex] || '') === paymentId) {
              await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `Payments_Log!A${i+1}:L${i+1}` });
              // Attempt to restore Master_Students totals from before snapshot if present
              if (details.before && details.paymentRow) {
                const studentId = details.paymentRow[1];
                const master = await googleSheets.getSheetData('Master_Students');
                if (master.length > 1) {
                  const mHeaders = master[0];
                  const idIdx = mHeaders.indexOf('Student_ID');
                  for (let j = 1; j < master.length; j++) {
                    if ((master[j][idIdx] || '') === studentId) {
                      const r = {};
                      mHeaders.forEach((h, idx) => { r[h] = master[j][idx] || ''; });
                      const updatedRow = [
                        r.Student_ID || '',
                        r.Name || '',
                        r.Year || '',
                        r.Number_of_Subjects || 0,
                        r.Total_Fees || 0,
                        r.Discount_Percent || 0,
                        r.Discount_Amount || 0,
                        r.Net_Amount || 0,
                        details.before.totalPaid || r.Total_Paid || 0,
                        details.before.remainingBalance || r.Remaining_Balance || 0,
                        r.Phone_Number || '',
                        r.Enrollment_Date || '',
                        (details.before.remainingBalance || r.Remaining_Balance || 0) <= 0 ? 'Paid' : (r.Status || 'Active'),
                        r.Last_Payment_Date || ''
                      ];
                      await googleSheets.updateRow('Master_Students', j + 1, updatedRow);
                      break;
                    }
                  }
                }
              }
              // Remove action log row
              await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `Actions_Log!A${actionRowIndex}:F${actionRowIndex}` });
              return true;
            }
          }
        }
      }

      // Handle apply_discount revert
      if (a.actionType === 'apply_discount' && details.before) {
        const studentId = a.refId;
        const master = await googleSheets.getSheetData('Master_Students');
        if (master.length > 1) {
          const headers = master[0];
          const idIndex = headers.indexOf('Student_ID');
          for (let i = 1; i < master.length; i++) {
            if ((master[i][idIndex] || '') === studentId) {
              const r = {};
              headers.forEach((h, idx) => { r[h] = master[i][idx] || ''; });
              const updatedRow = [
                r.Student_ID || '',
                r.Name || '',
                r.Year || '',
                r.Number_of_Subjects || 0,
                details.before.totalFees || r.Total_Fees || 0,
                details.before.discountPercent || r.Discount_Percent || 0,
                details.before.discountAmount || r.Discount_Amount || 0,
                details.before.netAmount || r.Net_Amount || 0,
                r.Total_Paid || 0,
                details.before.remainingBalance || r.Remaining_Balance || 0,
                r.Phone_Number || '',
                r.Enrollment_Date || '',
                (details.before.remainingBalance || r.Remaining_Balance || 0) <= 0 ? 'Paid' : (r.Status || 'Active'),
                r.Last_Payment_Date || ''
              ];
              await googleSheets.updateRow('Master_Students', i + 1, updatedRow);
              await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `Actions_Log!A${actionRowIndex}:F${actionRowIndex}` });
              return true;
            }
          }
        }
      }

      // Transaction handling
      if (a.actionType === 'transaction' && details.transactionRow) {
        const txId = a.refId;
        const data = await googleSheets.getSheetData('In_Out_Transactions');
        if (data.length > 1) {
          const headers = data[0];
          const idIndex = headers.indexOf('Transaction_ID');
          for (let i = 1; i < data.length; i++) {
            if ((data[i][idIndex] || '') === txId) {
              await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `In_Out_Transactions!A${i+1}:I${i+1}` });
              await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `Actions_Log!A${actionRowIndex}:F${actionRowIndex}` });
              return true;
            }
          }
        }
      }

      if ((a.actionType === 'bank_deposit' || a.actionType === 'bank_withdrawal') && (details.depositRow || details.withdrawalRow)) {
        const depId = a.refId;
        const data = await googleSheets.getSheetData('Bank_Deposits');
        if (data.length > 1) {
          const headers = data[0];
          const idIndex = headers.indexOf('Deposit_ID');
          for (let i = 1; i < data.length; i++) {
            if ((data[i][idIndex] || '') === depId) {
              await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `Bank_Deposits!A${i+1}:F${i+1}` });
              await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `Actions_Log!A${actionRowIndex}:F${actionRowIndex}` });
              return true;
            }
          }
        }
      }

      // If nothing matched, just clear the action log row to avoid repeating
      await googleSheets.sheets.spreadsheets.values.clear({ spreadsheetId: googleSheets.spreadsheetId, range: `Actions_Log!A${actionRowIndex}:F${actionRowIndex}` });
      return true;
    } catch (error) {
      console.error('Error reverting single action:', error);
      return false;
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

  const normalize = (value) => String(value || '').trim().toLowerCase();

      // For richer analytics
  const paymentsByMonth = {};
  const paymentsByDay = {};
  const transactionsByMonth = {};
  const transactionsByDay = {};
  const depositsByMonth = {};
  const depositsByDay = {};
      const recent = [];

  let cashFromStudentPayments = 0;
  let bankFromStudentPayments = 0;
  let cashIncomeTransactions = 0;
  let bankIncomeTransactions = 0;
  let cashExpenseTransactions = 0;
  let bankExpenseTransactions = 0;
  let depositsIntoBank = 0;
  let withdrawalsFromBank = 0;

      if (payments.length > 1) {
        const paymentHeaders = payments[0];
        const amountIndex = paymentHeaders.indexOf('Amount_Paid');
        const methodIndex = paymentHeaders.indexOf('Payment_Method');
        const dateIndex = paymentHeaders.indexOf('Payment_Date');

        // Treat Payments_Log as the canonical record of student payments.
        // Bank_Deposits represent transfers (usually cash->bank) and other bank movements.
        const isCashMethod = (m) => normalize(m) === 'cash';

        payments.slice(1).forEach(row => {
          const amount = parseFloat(row[amountIndex] || 0) || 0;
          const methodRaw = row[methodIndex] || '';
          const method = normalize(methodRaw);
          const dateStr = row[dateIndex] || '';
          totalStudentPayments += amount;

          if (isCashMethod(method)) {
            cashFromStudentPayments += amount;
          } else {
            bankFromStudentPayments += amount;
          }

          // monthly aggregation
          const paymentMoment = moment(dateStr || undefined);
          const month = paymentMoment.isValid() ? paymentMoment.format('YYYY-MM') : 'Unknown';
          const day = paymentMoment.isValid() ? paymentMoment.format('YYYY-MM-DD') : 'Unknown';
          paymentsByMonth[month] = (paymentsByMonth[month] || 0) + amount;
          paymentsByDay[day] = (paymentsByDay[day] || 0) + amount;

          recent.push({ kind: 'payment', date: dateStr, amount, method: methodRaw, raw: row });
        });
      }

      if (transactions.length > 1) {
        const txnHeaders = transactions[0];
        const typeIndex = txnHeaders.indexOf('Type');
        const amountIndex = txnHeaders.indexOf('Amount');
        const methodIndex = txnHeaders.indexOf('Payment_Method');
        const dateIndex = txnHeaders.indexOf('Date');

        transactions.slice(1).forEach(row => {
          const typeRaw = row[typeIndex] || '';
          const typeNormalized = normalize(typeRaw);
          const type = typeNormalized.includes('expense') || typeNormalized.startsWith('out')
            ? 'expense'
            : (typeNormalized.includes('income') || typeNormalized.startsWith('in') ? 'income' : typeNormalized);
          const amount = parseFloat(row[amountIndex] || 0) || 0;
          const methodRaw = row[methodIndex] || '';
          const method = normalize(methodRaw);
          const dateStr = row[dateIndex] || '';

          const isCash = method === 'cash';

          if (type === 'in' || type === 'income') {
            totalIncome += amount;
            if (isCash) {
              cashIncomeTransactions += amount;
            } else {
              bankIncomeTransactions += amount;
            }
          } else if (type === 'out' || type === 'expense') {
            totalExpenses += amount;
            if (isCash) {
              cashExpenseTransactions += amount;
            } else {
              bankExpenseTransactions += amount;
            }
          }

          const txnMoment = moment(dateStr || undefined);
          const month = txnMoment.isValid() ? txnMoment.format('YYYY-MM') : 'Unknown';
          const day = txnMoment.isValid() ? txnMoment.format('YYYY-MM-DD') : 'Unknown';
          transactionsByMonth[month] = transactionsByMonth[month] || { income: 0, expenses: 0 };
          transactionsByDay[day] = transactionsByDay[day] || { income: 0, expenses: 0 };
          if (type === 'in' || type === 'income') {
            transactionsByMonth[month].income += amount;
            transactionsByDay[day].income += amount;
          }
          if (type === 'out' || type === 'expense') {
            transactionsByMonth[month].expenses += amount;
            transactionsByDay[day].expenses += amount;
          }

          recent.push({ kind: 'transaction', date: dateStr, type: typeRaw, amount, method: methodRaw, raw: row });
        });
      }

      if (deposits.length > 1) {
        const depHeaders = deposits[0];
        const amountIndex = depHeaders.indexOf('Amount');
        const dateIndex = depHeaders.indexOf('Date');

        deposits.slice(1).forEach(row => {
          const amount = parseFloat(row[amountIndex] || 0) || 0;
          const dateStr = row[dateIndex] || '';
          if (amount >= 0) {
            depositsIntoBank += amount;
          } else {
            // Negative amount represents withdrawal from bank back to cash
            withdrawalsFromBank += Math.abs(amount);
          }

          const depositMoment = moment(dateStr || undefined);
          const month = depositMoment.isValid() ? depositMoment.format('YYYY-MM') : 'Unknown';
          const day = depositMoment.isValid() ? depositMoment.format('YYYY-MM-DD') : 'Unknown';
          depositsByMonth[month] = (depositsByMonth[month] || 0) + amount;
          depositsByDay[day] = (depositsByDay[day] || 0) + amount;

          recent.push({ kind: 'deposit', date: dateStr, amount, raw: row });
        });
      }

      totalCashInHand =
        cashFromStudentPayments +
        cashIncomeTransactions -
        cashExpenseTransactions -
        depositsIntoBank +
        withdrawalsFromBank;

      totalInBank =
        bankFromStudentPayments +
        bankIncomeTransactions -
        bankExpenseTransactions +
        depositsIntoBank -
        withdrawalsFromBank;

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
        const depositsAmt = depositsByMonth[m] || 0; // Deposits are transfers, not income
        // Net = (income from transactions + student fees) - expenses
        const net = (incomeFromTx + feesCollected) - expensesFromTx;
        return { month: m, income: incomeFromTx, expenses: expensesFromTx, feesCollected, deposits: depositsAmt, net };
      });

      const daysSet = new Set([
        ...Object.keys(paymentsByDay),
        ...Object.keys(transactionsByDay),
        ...Object.keys(depositsByDay)
      ]);

      const sortedDays = Array.from(daysSet)
        .filter(day => day && day !== 'Unknown' && day !== 'Invalid date')
        .sort();

      const last30Days = sortedDays.slice(-30);
      const daily = last30Days.map(d => {
        const incomeFromTx = (transactionsByDay[d] && transactionsByDay[d].income) || 0;
        const expensesFromTx = (transactionsByDay[d] && transactionsByDay[d].expenses) || 0;
        const feesCollected = paymentsByDay[d] || 0;
        const depositsAmt = depositsByDay[d] || 0;
        const net = (incomeFromTx + feesCollected) - expensesFromTx;
        return { day: d, income: incomeFromTx, expenses: expensesFromTx, feesCollected, deposits: depositsAmt, net };
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

      // Calculate total available balance (cash + bank)
      const totalBalance = Math.round((totalCashInHand + totalInBank) * 100) / 100;
      
      // Calculate actual total income (student fees + other income, excluding deposits which are transfers)
      const actualTotalIncome = Math.round((totalStudentPayments + totalIncome) * 100) / 100;
      
      // Calculate actual total expenses (other expenses + teacher payments)
      const actualTotalExpenses = Math.round((totalExpenses + totalTeacherPayments) * 100) / 100;

      return {
        cash: {
          totalCashInHand: Math.round(totalCashInHand * 100) / 100,
          description: 'Current cash available'
        },
        bank: {
          totalInBank: Math.round(totalInBank * 100) / 100,
          description: 'Total amount deposited in bank'
        },
        balance: {
          totalBalance: totalBalance,
          description: 'Total available balance (cash + bank)'
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
          totalIncome: actualTotalIncome, // Student fees + other income (excluding bank deposits)
          totalExpenses: actualTotalExpenses, // Other expenses + teacher payments
          netProfit: Math.round((actualTotalIncome - actualTotalExpenses) * 100) / 100
        },
        monthly,
        daily,
        recent: recentItems,
        generatedAt: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    } catch (error) {
      console.error('Error getting financial summary:', error);
      throw error;
    }
  }

  /**
   * Clean up duplicate bank deposits created by electronic student payments
   * This should be run once to fix the double-counting issue
   */
  async cleanupDuplicateBankDeposits() {
    try {
      console.log('Starting cleanup of duplicate bank deposits...');
      
      // Get all bank deposits
      const deposits = await googleSheets.getSheetData('Bank_Deposits');
      if (deposits.length <= 1) {
        console.log('No bank deposits found');
        return { success: true, message: 'No deposits to clean up', removed: 0 };
      }

      // Get all student payments
      const payments = await googleSheets.getSheetData('Payments_Log');
      if (payments.length <= 1) {
        console.log('No student payments found');
        return { success: true, message: 'No payments to check against', removed: 0 };
      }

      const paymentHeaders = payments[0];
      const paymentDateIndex = paymentHeaders.indexOf('Payment_Date');
      const paymentAmountIndex = paymentHeaders.indexOf('Amount_Paid');
      const paymentMethodIndex = paymentHeaders.indexOf('Payment_Method');
      const paymentStudentIndex = paymentHeaders.indexOf('Student_ID');

      const depositHeaders = deposits[0];
      const depositDateIndex = depositHeaders.indexOf('Date');
      const depositAmountIndex = depositHeaders.indexOf('Amount');
      const depositNotesIndex = depositHeaders.indexOf('Notes');

      let duplicatesFound = [];

      // Check each bank deposit to see if it matches a student payment
      for (let i = 1; i < deposits.length; i++) {
        const depositRow = deposits[i];
        const depositAmount = parseFloat(depositRow[depositAmountIndex] || 0);
        const depositNotes = depositRow[depositNotesIndex] || '';
        const depositDate = depositRow[depositDateIndex] || '';

        // Check if this looks like an auto-generated student payment deposit
        if (depositNotes.includes('Auto: student payment')) {
          const studentId = depositNotes.match(/Auto: student payment (\w+)/)?.[1];
          
          // Look for matching payment
          const matchingPayment = payments.slice(1).find(paymentRow => {
            const paymentAmount = parseFloat(paymentRow[paymentAmountIndex] || 0);
            const paymentStudent = paymentRow[paymentStudentIndex];
            const paymentMethod = paymentRow[paymentMethodIndex];
            const paymentDate = paymentRow[paymentDateIndex];
            
            return (
              Math.abs(paymentAmount - depositAmount) < 0.01 && // Same amount
              paymentStudent === studentId && // Same student
              paymentMethod !== 'Cash' && // Non-cash payment
              Math.abs(new Date(paymentDate) - new Date(depositDate)) < 86400000 // Within 24 hours
            );
          });

          if (matchingPayment) {
            duplicatesFound.push({
              rowIndex: i + 1, // Google Sheets is 1-indexed
              amount: depositAmount,
              studentId: studentId,
              notes: depositNotes
            });
          }
        }
      }

      console.log(`Found ${duplicatesFound.length} duplicate bank deposits to remove`);

      if (duplicatesFound.length > 0) {
        // Remove duplicates by clearing their rows (we'll keep the structure)
        const rangesToClear = duplicatesFound.map(dup => `Bank_Deposits!A${dup.rowIndex}:F${dup.rowIndex}`);
        
        for (const range of rangesToClear) {
          await googleSheets.sheets.spreadsheets.values.clear({
            spreadsheetId: googleSheets.spreadsheetId,
            range: range
          });
        }

        console.log(`Removed ${duplicatesFound.length} duplicate bank deposits`);
        
        // Calculate total amount corrected
        const totalCorrected = duplicatesFound.reduce((sum, dup) => sum + dup.amount, 0);
        
        return {
          success: true,
          message: `Cleaned up ${duplicatesFound.length} duplicate bank deposits`,
          removed: duplicatesFound.length,
          totalAmountCorrected: totalCorrected,
          duplicatesRemoved: duplicatesFound
        };
      }

      return {
        success: true,
        message: 'No duplicate bank deposits found',
        removed: 0
      };

    } catch (error) {
      console.error('Error cleaning up duplicate bank deposits:', error);
      throw error;
    }
  }
}

module.exports = new FinanceService();