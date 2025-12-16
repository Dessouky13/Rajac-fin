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
import { savePayment, updateStudentDiscount, getStudentByIdentifier, updateStudentTotalFees } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Search,
  User,
  DollarSign,
  CreditCard,
  Calendar,
  Percent,
  Save,
  Edit2
} from "lucide-react";

interface Student {
  studentID?: string;
  name: string;
  grade: string;
  baseFees: number;
  discountPct?: number;
  netFees: number;
  totalPaid: number;
  unpaid: number;
  // Legacy fields for backward compatibility
  id?: string;
  fees?: number;
  discount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  paid?: number;
  remaining?: number;
  // additional possible shapes from backend
  netAmount?: number;
  Net_Amount?: number;
  remainingBalance?: number;
  Remaining_Balance?: number;
}

export function Fees() {
  const { isArabic, t } = useLanguage();
  const [searchName, setSearchName] = useState("");
  const [grades] = useState(["All","Grade_9","Grade_10","Grade_11","Grade_12","Unknown"]);
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [studentsByGrade, setStudentsByGrade] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [previousStudentState, setPreviousStudentState] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    discountPct: "",
    amount: "",
    method: "",
    date: new Date().toISOString().split('T')[0]
  });
  const [canEditDiscount, setCanEditDiscount] = useState(false);
  const { toast } = useToast();

  // Edit Total Fees dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTotalFeesValue, setEditTotalFeesValue] = useState("");

  const handleSearch = async () => {
    if (!searchName.trim()) {
      toast({
        title: t("خطأ", "Error"),
        description: t("يرجى إدخال اسم الطالب", "Please enter student name"),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
  const response = await getStudentByIdentifier(searchName);
      if (response.ok && response.data) {
  const student: any = response.data;
        // Use backend-provided authoritative fields
        const normalizedStudent = {
          ...student,
          baseFees: student.baseFees || student.fees || 0,
          discountPct: student.discountPct || student.discount || 0,
          netFees: student.netFees || student.netAmount || student.Net_Amount || 0,
          totalPaid: student.totalPaid || student.paidAmount || 0,
          unpaid: student.unpaid || student.remainingAmount || student.remaining || student.remainingBalance || 0
        };

        setSelectedStudent(normalizedStudent);
        setCanEditDiscount(!normalizedStudent.discountPct || normalizedStudent.discountPct === 0);
        setPaymentForm(prev => ({
          ...prev,
          discountPct: String(normalizedStudent.discountPct || '')
        }));
        
        toast({
          title: t("تم العثور على الطالب", "Student Found"),
          description: t(`تم العثور على ${student.name}`, `Found ${student.name}`),
        });
      } else {
        setSelectedStudent(null);
        toast({
          title: t("لم يتم العثور على الطالب", "Student Not Found"),
          description: t("تأكد من صحة الاسم", "Please check the name spelling"),
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "خطأ في البحث",
        description: "حدث خطأ أثناء البحث عن الطالب",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // load students for the selected grade (client-side filter of /api/students)
    const load = async () => {
      if (!selectedGrade || selectedGrade === 'All') {
        setStudentsByGrade([]);
        return;
      }

      try {
        const res = await fetch('http://localhost:3000/api/students');
        const data = await res.json();
        const raw = data.students || [];
        const filtered = raw.filter((s: any) => {
          const year = (s.Year || s.year || '').toString();
          if (!year) return selectedGrade === 'Unknown';
          const num = year.match(/(\d{1,3})/);
          if (num && selectedGrade.startsWith('Grade_')) {
            return (`Grade_${num[1]}`) === selectedGrade;
          }
          return (`Grade_${year.replace(/\s+/g,'_')}`) === selectedGrade;
        }).map((s: any) => ({ id: s.Student_ID || s.studentId || s.id, name: s.Name || s.name }));
        setStudentsByGrade(filtered);
      } catch (err) {
        console.error('Failed to load students for grade', err);
        setStudentsByGrade([]);
      }
    };
    load();
  }, [selectedGrade]);

  const handleSelectStudentFromGrade = async (id: string) => {
    const s = studentsByGrade.find(st => st.id === id);
    if (s) {
      // Search directly with the student name (don't wait for state update)
      try {
        const response = await getStudentByIdentifier(s.name);
        if (response.ok && response.data) {
          const student: any = response.data;
          const normalizedStudent = {
            ...student,
            baseFees: student.baseFees || student.fees || 0,
            discountPct: student.discountPct || student.discount || 0,
            netFees: student.netFees || student.netAmount || student.Net_Amount || 0,
            totalPaid: student.totalPaid || student.paidAmount || 0,
            unpaid: student.unpaid || student.remainingAmount || student.remaining || student.remainingBalance || 0
          };

          setSearchName(s.name);
          setSelectedStudent(normalizedStudent);
          setCanEditDiscount(!normalizedStudent.discountPct || normalizedStudent.discountPct === 0);
          setPaymentForm(prev => ({
            ...prev,
            discountPct: String(normalizedStudent.discountPct || '')
          }));
          // Keep the grade and student list visible after selection
        }
      } catch (error) {
        console.error('Error selecting student from grade dropdown:', error);
      }
    }
  };

  const handleUpdateDiscount = async () => {
    if (!selectedStudent || !paymentForm.discountPct) return;
    
    // Save previous state for undo
    setPreviousStudentState(JSON.parse(JSON.stringify(selectedStudent)));
    
    setLoading(true);
    try {
      const response = await updateStudentDiscount({
        studentId: selectedStudent.studentID || selectedStudent.id,
        discountPercent: parseFloat(paymentForm.discountPct)
      });
      
      if (response.ok) {
        toast({
          title: "تم تحديث الخصم",
          description: `تم تطبيق خصم ${paymentForm.discountPct}%`,
        });
        setCanEditDiscount(false);
        // Refresh student data
        handleSearch();
      }
    } catch (error) {
      toast({
        title: "خطأ في تحديث الخصم",
        description: "حدث خطأ أثناء تحديث الخصم",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (previousStudentState) {
      setSelectedStudent(previousStudentState);
      setPaymentForm(prev => ({
        ...prev,
        discountPct: String(previousStudentState.discountPct || '')
      }));
      setPreviousStudentState(null);
      toast({
        title: t("تم التراجع عن الإجراء", "Action Undone"),
        description: t("تم استعادة بيانات الطالب السابقة", "Student data restored to previous state"),
      });
    }
  };

  const handleSavePayment = async () => {
    if (!selectedStudent) {
      toast({
        title: "خطأ",
        description: "يرجى البحث عن طالب أولاً",
        variant: "destructive"
      });
      return;
    }

    if (!paymentForm.amount || !paymentForm.method) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    // Check if payment amount exceeds remaining amount
    const paymentAmount = parseFloat(paymentForm.amount);
    const unpaidAmount = selectedStudent.unpaid || selectedStudent.remainingAmount || selectedStudent.remaining || 0;
    if (paymentAmount > unpaidAmount) {
      toast({
        title: "خطأ في المبلغ",
        description: `المبلغ أكبر من المبلغ المتبقي (${unpaidAmount} جنيه)`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Save previous state for undo
      setPreviousStudentState(JSON.parse(JSON.stringify(selectedStudent)));

      // Include discount if updated
      const discountPct = paymentForm.discountPct ? parseFloat(paymentForm.discountPct) : undefined;

      const response = await savePayment({
        studentId: selectedStudent.studentID || selectedStudent.id,
        amountPaid: paymentAmount,
        paymentMethod: paymentForm.method,
        discountPercent: paymentForm.discountPct ? parseFloat(paymentForm.discountPct) : undefined,
        processedBy: 'Frontend User'
      });

      if (response.ok) {
        toast({
          title: "تم حفظ الدفع بنجاح",
          description: `تم تسجيل دفع ${paymentForm.amount} جنيه للطالب ${selectedStudent.name}`,
        });

        // Update student data with response from backend - use the student object from response
        // Backend may return the updated student in several shapes. Prefer explicit student object,
        // otherwise fall back to the top-level data payload. If not available, re-fetch the student
        // from the server to ensure authoritative values (Net_Amount, Remaining_Balance).
        const returnedStudent = (response.data && (response.data.student || response.data)) || (response.student || null);
        if (returnedStudent) {
          const upd = returnedStudent;
          setSelectedStudent({
            ...upd,
            name: upd.name || upd.Name || selectedStudent.name,
            studentID: upd.id || upd.studentID || upd.Student_ID || selectedStudent.studentID,
            grade: upd.grade || upd.year || upd.Year || selectedStudent.grade,
            baseFees: upd.baseFees || upd.fees || Number(upd.Total_Fees) || selectedStudent.baseFees,
            discountPct: upd.discountPct || upd.discount || 0,
            netFees: upd.netFees || upd.netAmount || Number(upd.Net_Amount) || selectedStudent.netFees,
            totalPaid: upd.totalPaid || upd.paidAmount || Number(upd.Total_Paid) || selectedStudent.totalPaid,
            unpaid: upd.unpaid || upd.remainingAmount || Number(upd.Remaining_Balance) || selectedStudent.unpaid
          });
        } else {
          // If backend didn't return student data, re-run the search to fetch authoritative record
          await handleSearch();
        }

        // Notify other parts of the UI (Dashboard, Balances, Transactions) to refresh analytics
        try {
          window.dispatchEvent(new CustomEvent('finance.updated'));
        } catch (e) {
          // ignore if dispatching fails in non-browser contexts
        }

        // Reset form but keep discount
        setPaymentForm(prev => ({
          discountPct: prev.discountPct,
          amount: "",
          method: "",
          date: new Date().toISOString().split('T')[0]
        }));
        // Reset grade filter to default 'All' after successful payment
        setSelectedGrade('All');
        setStudentsByGrade([]);
      } else {
        toast({
          title: "فشل في حفظ الدفع",
          description: response.message || "حدث خطأ أثناء حفظ الدفع",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "خطأ في الحفظ",
        description: "حدث خطأ أثناء حفظ الدفع",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle opening the edit total fees dialog
  const handleOpenEditDialog = () => {
    if (!selectedStudent) return;
    setEditTotalFeesValue(String(selectedStudent.baseFees || selectedStudent.fees || 0));
    setIsEditDialogOpen(true);
  };

  // Handle saving the updated total fees
  const handleSaveTotalFees = async () => {
    if (!selectedStudent) return;

    // Validation
    const newTotalFees = parseFloat(editTotalFeesValue);

    if (isNaN(newTotalFees)) {
      toast({
        title: t("خطأ في الإدخال", "Invalid Input"),
        description: t("يجب إدخال رقم صحيح", "Please enter a valid number"),
        variant: "destructive"
      });
      return;
    }

    if (newTotalFees < 0) {
      toast({
        title: t("خطأ في الإدخال", "Invalid Input"),
        description: t("لا يمكن أن تكون الرسوم سالبة", "Total fees cannot be negative"),
        variant: "destructive"
      });
      return;
    }

    if (newTotalFees > 1000000) {
      toast({
        title: t("خطأ في الإدخال", "Invalid Input"),
        description: t("الرسوم تتجاوز الحد الأقصى المسموح (1,000,000 جنيه)", "Total fees exceed maximum allowed (1,000,000 EGP)"),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Save previous state for undo
      setPreviousStudentState(JSON.parse(JSON.stringify(selectedStudent)));

      const response = await updateStudentTotalFees({
        studentId: selectedStudent.studentID || selectedStudent.id || '',
        totalFees: newTotalFees,
        updatedBy: 'Frontend User'
      });

      if (response.ok && response.data) {
        toast({
          title: t("تم تحديث الرسوم بنجاح", "Fees Updated Successfully"),
          description: t(
            `تم تحديث إجمالي الرسوم إلى ${newTotalFees.toLocaleString()} جنيه`,
            `Total fees updated to ${newTotalFees.toLocaleString()} EGP`
          ),
        });

        // Update local student state with new values from backend
        const updatedData = response.data.student || response.data;
        setSelectedStudent({
          ...selectedStudent,
          baseFees: updatedData.totalFees || newTotalFees,
          fees: updatedData.totalFees || newTotalFees,
          discountPct: updatedData.discountPercent || selectedStudent.discountPct,
          netFees: updatedData.netAmount || 0,
          netAmount: updatedData.netAmount || 0,
          unpaid: updatedData.remainingBalance || 0,
          remainingAmount: updatedData.remainingBalance || 0,
          remaining: updatedData.remainingBalance || 0
        });

        // Close dialog
        setIsEditDialogOpen(false);

        // Notify other parts of the UI to refresh
        try {
          window.dispatchEvent(new CustomEvent('finance.updated'));
        } catch (e) {
          // ignore if dispatching fails
        }
      } else {
        toast({
          title: t("فشل في تحديث الرسوم", "Failed to Update Fees"),
          description: response.message || t("حدث خطأ أثناء تحديث الرسوم", "An error occurred while updating fees"),
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: t("خطأ في التحديث", "Update Error"),
        description: t("حدث خطأ أثناء تحديث الرسوم", "An error occurred while updating fees"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 fade-in" dir={isArabic ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t("إدارة الرسوم", "Fee Management")}
        </h1>
        <p className="text-muted-foreground">
          {t("البحث عن الطلاب وتسجيل المدفوعات", "Search students and record payments")}
        </p>
      </div>

      {/* Search Section */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle className={`flex items-center space-x-2 ${isArabic ? 'space-x-reverse' : ''}`}>
            <Search className="h-5 w-5 text-primary" />
            <span>{t("البحث عن طالب", "Search Student")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-2">
                <Label htmlFor="gradeSelect">{t("الصف", "Grade")}</Label>
                <select
                  id="gradeSelect"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {grades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <Label htmlFor="studentPicker">{t("اختر طالبًا", "Select Student")}</Label>
                <select
                  id="studentPicker"
                  value={selectedStudent?.studentID || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) handleSelectStudentFromGrade(val);
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {studentsByGrade.length === 0 ? (
                    <option value="">{t("اختر صفًا لرؤية الطلاب", "Select a grade to see students")}</option>
                  ) : (
                    studentsByGrade.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="md:col-span-5">
                <Label htmlFor="studentName">
                  {t("الاسم الكامل للطالب", "Student Full Name")}
                </Label>
                <Input
                  id="studentName"
                  placeholder={t("أدخل الاسم الكامل للطالب", "Enter student full name")}
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <Button onClick={handleSearch} disabled={loading} className="bg-primary hover:bg-primary/90 w-full">
                  <Search className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
                  {t("بحث", "Search")}
                </Button>
              </div>
            </div>
          </CardContent>
      </Card>

      {/* Student Details */}
      {selectedStudent && (
        <Card className="bg-gradient-card border-primary/20 scale-in">
          <CardHeader>
            <div className={`flex items-center justify-between ${isArabic ? 'flex-row-reverse' : ''}`}>
              <CardTitle className={`flex items-center space-x-2 ${isArabic ? 'space-x-reverse' : ''}`}>
                <User className="h-5 w-5 text-primary" />
                <span>{t("بيانات الطالب", "Student Details")}</span>
              </CardTitle>
              {previousStudentState && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleUndo}
                  className="gap-2"
                >
                  ↶ {t("تراجع", "Undo")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("الاسم", "Name")}</p>
                <p className="text-lg font-semibold">{selectedStudent.name}</p>
              </div>
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("الصف", "Grade")}</p>
                <p className="text-lg font-semibold">{selectedStudent.grade}</p>
              </div>
              <div className="text-center p-4 bg-background/50 rounded-lg relative">
                <p className="text-sm text-muted-foreground">{t("إجمالي الرسوم", "Total Fees")}</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-lg font-semibold text-primary">
                    {(selectedStudent.baseFees || selectedStudent.fees || 0).toLocaleString()} {t("جنيه", "EGP")}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleOpenEditDialog}
                    title={t("تعديل إجمالي الرسوم", "Edit Total Fees")}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("المبلغ بعد الخصم", "Net Amount")}</p>
                <p className="text-lg font-semibold text-accent">
                  {selectedStudent.netFees?.toLocaleString()} {t("جنيه", "EGP")}
                </p>
                {(selectedStudent.discountPct || selectedStudent.discount) && (selectedStudent.discountPct || selectedStudent.discount)! > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("خصم", "Discount")} {selectedStudent.discountPct || selectedStudent.discount}%
                  </p>
                )}
              </div>
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("المبلغ المدفوع", "Amount Paid")}</p>
                <p className="text-lg font-semibold text-success">
                  {(selectedStudent.totalPaid || 0).toLocaleString()} {t("جنيه", "EGP")}
                </p>
              </div>
              <div className="text-center p-4 bg-background/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("المبلغ المتبقي", "Remaining Amount")}</p>
                <p className="text-lg font-semibold text-warning">
                  {(selectedStudent.unpaid || 0).toLocaleString()} {t("جنيه", "EGP")}
                </p>
              </div>
            </div>

            {/* Payment Form */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">
                {t("تسجيل دفع جديد", "Record New Payment")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountPct">{t("الخصم (%)", "Discount (%)")}</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="discountPct"
                        type="number"
                        placeholder="0"
                        value={paymentForm.discountPct}
                        onChange={(e) => setPaymentForm({...paymentForm, discountPct: e.target.value})}
                        className="pr-10"
                        disabled={!canEditDiscount}
                      />
                    </div>
                    {canEditDiscount && paymentForm.discountPct && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleUpdateDiscount}
                        disabled={loading}
                      >
                        {t("تطبيق", "Apply")}
                      </Button>
                    )}
                  </div>
                  {!canEditDiscount && selectedStudent?.discount && (
                    <p className="text-xs text-muted-foreground">
                      {t("الخصم مطبق بالفعل:", "Discount already applied:")} {selectedStudent.discount}%
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">{t("مبلغ الدفع *", "Payment Amount *")}</Label>
                  <div className="relative">
                    <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      placeholder={t("المبلغ", "Amount")}
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                      className="pr-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("طريقة الدفع *", "Payment Method *")}</Label>
                  <Select value={paymentForm.method} onValueChange={(value) => setPaymentForm({...paymentForm, method: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("اختر طريقة الدفع", "Choose payment method")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">{t("نقدي", "Cash")}</SelectItem>
                      <SelectItem value="Visa">{t("فيزا", "Visa")}</SelectItem>
                      <SelectItem value="Instapay">{t("إنستاباي", "InstaPay")}</SelectItem>
                      <SelectItem value="Check">{t("شيك", "Check")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payDate">{t("تاريخ الدفع", "Payment Date")}</Label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="payDate"
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})}
                      className="pr-10"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleSavePayment} 
                  disabled={loading}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Save className="h-4 w-4 ml-2" />
                  حفظ الدفع
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Total Fees Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
              <Edit2 className="h-5 w-5" />
              <span>{t("تعديل إجمالي الرسوم", "Edit Total Fees")}</span>
            </DialogTitle>
            <DialogDescription>
              {t(
                "قم بتعديل إجمالي الرسوم للطالب. سيتم إعادة حساب جميع المبالغ تلقائياً.",
                "Edit the student's total fees. All amounts will be automatically recalculated."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editTotalFees">
                {t("إجمالي الرسوم (جنيه مصري)", "Total Fees (EGP)")}
              </Label>
              <Input
                id="editTotalFees"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={editTotalFeesValue}
                onChange={(e) => setEditTotalFeesValue(e.target.value)}
                placeholder={t("أدخل إجمالي الرسوم", "Enter total fees")}
                className="text-lg"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveTotalFees();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  "سيتم إعادة حساب: الخصم، المبلغ الصافي، المبلغ المتبقي",
                  "Will recalculate: Discount, Net Amount, Remaining Balance"
                )}
              </p>
            </div>
            {selectedStudent && (
              <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("الطالب:", "Student:")}</span>
                  <span className="font-medium">{selectedStudent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("الرسوم الحالية:", "Current Fees:")}</span>
                  <span className="font-medium">{(selectedStudent.baseFees || 0).toLocaleString()} {t("جنيه", "EGP")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("الرسوم الجديدة:", "New Fees:")}</span>
                  <span className="font-medium text-primary">
                    {editTotalFeesValue ? parseFloat(editTotalFeesValue).toLocaleString() : '0'} {t("جنيه", "EGP")}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className={isArabic ? "flex-row-reverse" : ""}>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={loading}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button onClick={handleSaveTotalFees} disabled={loading}>
              {loading ? t("جاري الحفظ...", "Saving...") : t("حفظ", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}