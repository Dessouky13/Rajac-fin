import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getTeachers, addTeacher, payTeacher, deleteTeacher, updateTeacher } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  User,
  DollarSign,
  BookOpen,
  Hash,
  Save,
  CreditCard,
  Edit2,
  Trash2
} from "lucide-react";

interface Teacher {
  id: string;
  name: string;
  subject: string;
  numberOfClasses: number;
  totalAmount: number;
  totalPaid: number;
  remainingBalance: number;
  createdAt: string;
}

export function Teachers() {
  const { isArabic, t } = useLanguage();
  const { toast } = useToast();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Add teacher form
  const [newTeacher, setNewTeacher] = useState({
    name: "",
    subject: "",
    numberOfClasses: "",
    totalAmount: ""
  });

  // Pay teacher form
  const [payment, setPayment] = useState({
    teacherName: "",
    amount: "",
    method: ""
  });

  // Edit teacher state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    subject: "",
    numberOfClasses: "",
    totalAmount: ""
  });

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const response = await getTeachers();
      if (response.ok && response.data) {
        setTeachers(response.data);
      }
    } catch (error) {
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "فشل في تحميل المعلمين" : "Failed to load teachers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await addTeacher({
        name: newTeacher.name,
        subject: newTeacher.subject,
        numberOfClasses: parseInt(newTeacher.numberOfClasses),
        totalAmount: parseFloat(newTeacher.totalAmount)
      });

      if (response.ok) {
        toast({
          title: isArabic ? "نجح" : "Success",
          description: isArabic ? "تم إضافة المعلم بنجاح" : "Teacher added successfully"
        });
        setNewTeacher({ name: "", subject: "", numberOfClasses: "", totalAmount: "" });
        await loadTeachers(); // Reload to show new teacher immediately
      } else {
        throw new Error(response.message || "Failed to add teacher");
      }
    } catch (error) {
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "فشل في إضافة المعلم" : "Failed to add teacher",
        variant: "destructive"
      });
    }
  };

  const handlePayTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await payTeacher({
        teacherName: payment.teacherName,
        amount: parseFloat(payment.amount),
        method: payment.method
      });

      if (response.ok) {
        toast({
          title: isArabic ? "نجح" : "Success",
          description: isArabic ? "تم تسجيل الدفعة بنجاح" : "Payment recorded successfully"
        });
        setPayment({ teacherName: "", amount: "", method: "" });
        await loadTeachers(); // Reload to show updated payment status immediately
      } else {
        throw new Error(response.message || "Failed to record payment");
      }
    } catch (error) {
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "فشل في تسجيل الدفعة" : "Failed to record payment",
        variant: "destructive"
      });
    }
  };

  const handleOpenEditDialog = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditForm({
      name: teacher.name,
      subject: teacher.subject,
      numberOfClasses: String(teacher.numberOfClasses),
      totalAmount: String(teacher.totalAmount)
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTeacher = async () => {
    if (!editingTeacher) return;

    try {
      const response = await updateTeacher(editingTeacher.id, {
        name: editForm.name,
        subject: editForm.subject,
        numberOfClasses: parseInt(editForm.numberOfClasses),
        totalAmount: parseFloat(editForm.totalAmount)
      });

      if (response.ok) {
        toast({
          title: isArabic ? "نجح" : "Success",
          description: isArabic ? "تم تحديث المعلم بنجاح" : "Teacher updated successfully"
        });
        setIsEditDialogOpen(false);
        setEditingTeacher(null);
        await loadTeachers();
      } else {
        throw new Error(response.message || "Failed to update teacher");
      }
    } catch (error) {
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "فشل في تحديث المعلم" : "Failed to update teacher",
        variant: "destructive"
      });
    }
  };

  const handleOpenDeleteConfirm = (teacher: Teacher) => {
    setTeacherToDelete(teacher);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;

    try {
      const response = await deleteTeacher(teacherToDelete.id);

      if (response.ok) {
        toast({
          title: isArabic ? "نجح" : "Success",
          description: isArabic ? "تم حذف المعلم بنجاح" : "Teacher deleted successfully"
        });
        setDeleteConfirmOpen(false);
        setTeacherToDelete(null);
        await loadTeachers();
      } else {
        throw new Error(response.message || "Failed to delete teacher");
      }
    } catch (error) {
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "فشل في حذف المعلم" : "Failed to delete teacher",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{isArabic ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Teacher Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {isArabic ? "إضافة معلم جديد" : "Add New Teacher"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTeacher} className="space-y-4">
              <div>
                <Label htmlFor="name">{isArabic ? "الاسم" : "Name"}</Label>
                <Input
                  id="name"
                  value={newTeacher.name}
                  onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                  placeholder={isArabic ? "أدخل اسم المعلم" : "Enter teacher name"}
                  required
                />
              </div>

              <div>
                <Label htmlFor="subject">{isArabic ? "المادة" : "Subject"}</Label>
                <Input
                  id="subject"
                  value={newTeacher.subject}
                  onChange={(e) => setNewTeacher({ ...newTeacher, subject: e.target.value })}
                  placeholder={isArabic ? "أدخل المادة" : "Enter subject"}
                  required
                />
              </div>

              <div>
                <Label htmlFor="classes">{isArabic ? "عدد الطلاب" : "Number of Students"}</Label>
                <Input
                  id="classes"
                  type="number"
                  value={newTeacher.numberOfClasses}
                  onChange={(e) => setNewTeacher({ ...newTeacher, numberOfClasses: e.target.value })}
                  placeholder="10"
                  required
                />
              </div>

              <div>
                <Label htmlFor="amount">{isArabic ? "إجمالي المبلغ" : "Total Amount"}</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={newTeacher.totalAmount}
                  onChange={(e) => setNewTeacher({ ...newTeacher, totalAmount: e.target.value })}
                  placeholder="1000.00"
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {isArabic ? "إضافة المعلم" : "Add Teacher"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Pay Teacher Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {isArabic ? "دفع للمعلم" : "Pay Teacher"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePayTeacher} className="space-y-4">
              <div>
                <Label htmlFor="teacher">{isArabic ? "المعلم" : "Teacher"}</Label>
                <Select value={payment.teacherName} onValueChange={(value) => setPayment({ ...payment, teacherName: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={isArabic ? "اختر المعلم" : "Select teacher"} />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.name}>
                        {teacher.name} - {teacher.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payAmount">{isArabic ? "المبلغ" : "Amount"}</Label>
                <Input
                  id="payAmount"
                  type="number"
                  step="0.01"
                  value={payment.amount}
                  onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                  placeholder="500.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="method">{isArabic ? "طريقة الدفع" : "Payment Method"}</Label>
                <Select value={payment.method} onValueChange={(value) => setPayment({ ...payment, method: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={isArabic ? "اختر طريقة الدفع" : "Select payment method"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">{isArabic ? "نقدي" : "Cash"}</SelectItem>
                    <SelectItem value="Bank Transfer">{isArabic ? "تحويل بنكي" : "Bank Transfer"}</SelectItem>
                    <SelectItem value="Check">{isArabic ? "شيك" : "Check"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full">
                <DollarSign className="h-4 w-4 mr-2" />
                {isArabic ? "تسجيل الدفعة" : "Record Payment"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Teachers List */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "قائمة المعلمين" : "Teachers List"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((teacher) => (
              <Card key={teacher.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{teacher.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpenEditDialog(teacher)}
                        title={isArabic ? "تعديل" : "Edit"}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleOpenDeleteConfirm(teacher)}
                        title={isArabic ? "حذف" : "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>{teacher.subject}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    <span>{teacher.numberOfClasses} {isArabic ? "طالب" : "students"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>{isArabic ? "المجموع:" : "Total:"} ${teacher.totalAmount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>{isArabic ? "مدفوع:" : "Paid:"} ${teacher.totalPaid}</span>
                  </div>
                  <Badge variant={teacher.remainingBalance > 0 ? "destructive" : "default"}>
                    {isArabic ? "متبقي:" : "Remaining:"} ${teacher.remainingBalance}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
          {teachers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {isArabic ? "لا يوجد معلمون مسجلون" : "No teachers registered yet"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Teacher Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
              <Edit2 className="h-5 w-5" />
              <span>{isArabic ? "تعديل بيانات المعلم" : "Edit Teacher"}</span>
            </DialogTitle>
            <DialogDescription>
              {isArabic ? "قم بتعديل بيانات المعلم" : "Update teacher information"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editName">{isArabic ? "الاسم" : "Name"}</Label>
              <Input
                id="editName"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder={isArabic ? "أدخل اسم المعلم" : "Enter teacher name"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editSubject">{isArabic ? "المادة" : "Subject"}</Label>
              <Input
                id="editSubject"
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                placeholder={isArabic ? "أدخل المادة" : "Enter subject"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editClasses">{isArabic ? "عدد الطلاب" : "Number of Students"}</Label>
              <Input
                id="editClasses"
                type="number"
                value={editForm.numberOfClasses}
                onChange={(e) => setEditForm({ ...editForm, numberOfClasses: e.target.value })}
                placeholder="10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editAmount">{isArabic ? "إجمالي المبلغ" : "Total Amount"}</Label>
              <Input
                id="editAmount"
                type="number"
                step="0.01"
                value={editForm.totalAmount}
                onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
                placeholder="1000.00"
              />
            </div>
          </div>
          <DialogFooter className={isArabic ? "flex-row-reverse" : ""}>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleUpdateTeacher}>
              {isArabic ? "حفظ التعديلات" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir={isArabic ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isArabic ? "text-right" : ""}>
              {isArabic ? "تأكيد الحذف" : "Confirm Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription className={isArabic ? "text-right" : ""}>
              {isArabic
                ? `هل أنت متأكد من حذف المعلم "${teacherToDelete?.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`
                : `Are you sure you want to delete teacher "${teacherToDelete?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isArabic ? "flex-row-reverse" : ""}>
            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isArabic ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}