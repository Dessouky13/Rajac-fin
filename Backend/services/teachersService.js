const googleSheets = require('./googleSheets');

class TeachersService {
  /**
   * Get all teachers from the Teachers sheet
   */
  async getAllTeachers() {
    try {
      const teachers = await googleSheets.getTeachers();
      return teachers;
    } catch (error) {
      console.error('Error fetching teachers:', error);
      throw error;
    }
  }

  /**
   * Add a new teacher
   */
  async addTeacher(teacherData) {
    try {
      const teacher = {
        id: this.generateId(),
        name: teacherData.name,
        subject: teacherData.subject,
        numberOfClasses: teacherData.numberOfClasses,
        totalAmount: teacherData.totalAmount,
        totalPaid: 0,
        remainingBalance: teacherData.totalAmount,
        createdAt: new Date().toISOString()
      };

      await googleSheets.addTeacher(teacher);
      return { success: true, teacher };
    } catch (error) {
      console.error('Error adding teacher:', error);
      throw error;
    }
  }

  /**
   * Pay a teacher
   */
  async payTeacher(paymentData) {
    try {
      // Find teacher by name
      const teachers = await this.getAllTeachers();
      const teacher = teachers.find(t => t.name === paymentData.teacherName);
      if (!teacher) {
        throw new Error('Teacher not found');
      }

      // Update teacher's totalPaid and remainingBalance
      const paymentAmount = Number(paymentData.amount);
      const newTotalPaid = teacher.totalPaid + paymentAmount;
      const newRemainingBalance = teacher.totalAmount - newTotalPaid;

      await googleSheets.updateTeacherPayment(teacher.id, newTotalPaid, newRemainingBalance);

      // Add to transactions
      const transaction = {
        type: 'Teacher Payment',
        teacherName: teacher.name,
        amount: paymentAmount,
        method: paymentData.method,
        date: new Date().toISOString(),
        description: `Payment to ${teacher.name} for ${teacher.subject}`
      };

      await googleSheets.addTransaction(transaction);

      return { success: true, teacher: { ...teacher, totalPaid: newTotalPaid, remainingBalance: newRemainingBalance } };
    } catch (error) {
      console.error('Error paying teacher:', error);
      throw error;
    }
  }

  generateId() {
    return 'T' + Date.now() + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = new TeachersService();