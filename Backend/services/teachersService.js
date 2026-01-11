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

  /**
   * Delete a teacher by ID
   */
  async deleteTeacher(teacherId) {
    try {
      const result = await googleSheets.deleteTeacher(teacherId);
      return result;
    } catch (error) {
      console.error('Error deleting teacher:', error);
      throw error;
    }
  }

  /**
   * Update teacher information
   */
  async updateTeacher(teacherId, updates) {
    try {
      const teachers = await this.getAllTeachers();
      const teacher = teachers.find(t => t.id === teacherId);
      if (!teacher) {
        throw new Error('Teacher not found');
      }

      // Calculate new remaining balance if totalAmount changed
      const newTotalAmount = updates.totalAmount !== undefined ? updates.totalAmount : teacher.totalAmount;
      const newRemainingBalance = newTotalAmount - teacher.totalPaid;

      const updatedTeacher = {
        id: teacher.id,
        name: updates.name !== undefined ? updates.name : teacher.name,
        subject: updates.subject !== undefined ? updates.subject : teacher.subject,
        numberOfClasses: updates.numberOfClasses !== undefined ? updates.numberOfClasses : teacher.numberOfClasses,
        totalAmount: newTotalAmount,
        totalPaid: teacher.totalPaid,
        remainingBalance: newRemainingBalance,
        createdAt: teacher.createdAt
      };

      await googleSheets.updateTeacher(teacherId, updatedTeacher);
      return { success: true, teacher: updatedTeacher };
    } catch (error) {
      console.error('Error updating teacher:', error);
      throw error;
    }
  }

  generateId() {
    return 'T' + Date.now() + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = new TeachersService();