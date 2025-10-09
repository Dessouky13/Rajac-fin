import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getOverdueList } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, AlertTriangle, DollarSign } from "lucide-react";

interface OverdueStudent {
  studentId?: string;
  fullName: string;
  phone?: string;
  dueDate?: string;
  amountDue?: number;
  remaining?: number;
  installmentNumber?: number | null;
}

export function DueReport() {
  const { isArabic, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [overdueStudents, setOverdueStudents] = useState<OverdueStudent[]>([]);
  const [filters, setFilters] = useState({
    installmentNumber: 1
  });
  const { toast } = useToast();

  const loadOverdueList = async () => {
    setLoading(true);
    try {
      const response = await getOverdueList();
      if (response.ok && response.data) {
        // Filter returned overdue entries to only the selected installment
        const inst = filters.installmentNumber;
        const filtered = (response.data || []).filter((s: any) => {
          // prefer normalized _installmentNumber_, fall back to raw fields
          let sn: any = null;
          if (s.installmentNumber !== undefined && s.installmentNumber !== null) sn = s.installmentNumber;
          else if (s.paymentNo !== undefined && s.paymentNo !== null) sn = s.paymentNo;
          else if (s.raw) {
            sn = s.raw.installmentNumber || s.raw.Installment_Number || s.raw.paymentNo || s.raw.installment;
          }
          return Number(sn) === Number(inst);
        });
        setOverdueStudents(filtered);
        toast({
          title: t("تم تحميل التقرير", "Report Loaded"),
          description: t(`تم العثور على ${filtered.length} طالب متأخر`, `Found ${filtered.length} overdue students`),
        });
      } else {
        toast({
          title: t("خطأ في تحميل التقرير", "Error Loading Report"),
          description: response.message || t("حدث خطأ أثناء تحميل التقرير", "Error occurred while loading report"),
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: t("خطأ في تحميل التقرير", "Error Loading Report"),
        description: t("حدث خطأ أثناء تحميل التقرير", "Error occurred while loading report"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverdueList();
  }, [filters.installmentNumber]);

  const overdueCount = overdueStudents.length;

  return (
    <div className="space-y-6 fade-in" dir={isArabic ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t("تقرير المدفوعات المستحقة", "Due Payments Report")}
        </h1>
        <p className="text-muted-foreground">
          {t("", "View students with overdue payments")}
        </p>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle className={`flex items-center space-x-2 ${isArabic ? 'space-x-reverse' : ''}`}>
            <Calendar className="h-5 w-5 text-primary" />
            <span>{t("فلاتر التقرير", "Report Filters")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("رقم الدفعة", "Payment Number")}</label>
                <Select
                value={filters.installmentNumber.toString()}
                onValueChange={(value) => setFilters(prev => ({ ...prev, installmentNumber: parseInt(value) }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("الدفعة 1", "Installment 1")}</SelectItem>
                  <SelectItem value="2">{t("الدفعة 2", "Installment 2")}</SelectItem>
                  <SelectItem value="3">{t("الدفعة 3", "Installment 3")}</SelectItem>
                  <SelectItem value="4">{t("الدفعة 4", "Installment 4")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadOverdueList} disabled={loading} className="bg-primary hover:bg-primary/90">
              {t("تحديث التقرير", "Refresh Report")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">{t("طلاب متأخرون", "Overdue Students")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-accent" />
              <div>
                <p className="text-2xl font-bold">{filters.installmentNumber}</p>
                <p className="text-xs text-muted-foreground">{t("رقم الدفعة", "Payment Number")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Students Table */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle>{t("الطلاب المتأخرون في السداد", "Overdue Students")}</CardTitle>
        </CardHeader>
        <CardContent>
          {overdueStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("اسم الطالب", "Student Name")}</TableHead>
                  <TableHead>{t("الهاتف", "Phone")}</TableHead>
                  <TableHead>{t("تاريخ الاستحقاق", "Due Date")}</TableHead>
                  <TableHead>{t("المبلغ المطلوب", "Amount Due")}</TableHead>
                  <TableHead>{t("الحالة", "Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueStudents.map((student, index) => (
                  <TableRow
                    key={index}
                    className="bg-destructive/10 border-destructive/20"
                  >
                    <TableCell className="font-medium">{student.fullName}</TableCell>
                    <TableCell>{student.phone || '-'}</TableCell>
                    <TableCell>{student.dueDate || '-'}</TableCell>
                    <TableCell className="font-semibold">{(student.amountDue || 0).toLocaleString()} EGP</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <AlertTriangle className="h-3 w-3" />
                        {t("متأخر", "Overdue")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {loading 
                  ? t("جاري تحميل التقرير...", "Loading report...") 
                  : t("لا توجد مدفوعات متأخرة", "No overdue payments")
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}