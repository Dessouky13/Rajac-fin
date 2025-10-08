import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveInOut, getRecentTransactions } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Calendar,
  FileText,
  DollarSign,
  CreditCard
} from "lucide-react";

interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  name: string;
  amount: number;
  method: 'Cash' | 'Other';
  date: string;
  note?: string;
}

export function Transactions() {
  const { isArabic, t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: '',
    name: '',
    amount: '',
    method: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  const { toast } = useToast();

  const loadTransactions = async () => {
    try {
      const response = await getRecentTransactions();
      if (response.ok) {
        const raw = response.data || [];
        // Normalize possible backend shapes (headers from sheet)
        const normalized = (raw || []).map((r: any) => {
          return {
            id: r.Transaction_ID || r.id || r.TransactionId || r.transactionId || '',
            type: (r.Type || r.type || '').toUpperCase(),
            name: r.Subject || r.Payer_Receiver_Name || r.Payer_Receiver || r.Payer || r.Subject || r.Name || '',
            amount: Number(r.Amount || r.amount || 0) || 0,
            method: (r.Payment_Method || r.paymentMethod || r.method || 'Other'),
            date: r.Date || r.date || '',
            note: r.Notes || r.notes || ''
          };
        });
        setTransactions(normalized);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleSaveTransaction = async () => {
    if (!form.type || !form.name || !form.amount || !form.method) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await saveInOut({
        type: form.type,
        amount: parseFloat(form.amount),
        subject: form.name,
        payerReceiverName: form.name,
        paymentMethod: form.method,
        notes: form.note || undefined,
        processedBy: 'Frontend User'
      });

      if (response.ok) {
        toast({
          title: t('تم حفظ المعاملة بنجاح', 'Transaction saved'),
          description: t(
            `تم تسجيل ${form.type === 'IN' ? 'إيراد' : 'مصروف'} بقيمة ${form.amount} جنيه`,
            `${form.type === 'IN' ? 'Recorded revenue' : 'Recorded expense'} of ${form.amount} EGP`
          )
        });
        
        // Reset form
        setForm({
          type: '',
          name: '',
          amount: '',
          method: '',
          date: new Date().toISOString().split('T')[0],
          note: ''
        });
        setShowForm(false);
        
        // Reload transactions
        loadTransactions();
        // Notify other parts of the app to refresh analytics/balances
        try { window.dispatchEvent(new CustomEvent('finance.updated')); } catch(e) {}
      } else {
        toast({
          title: "فشل في حفظ المعاملة",
          description: response.message || "حدث خطأ أثناء حفظ المعاملة",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "خطأ في الحفظ",
        description: "حدث خطأ أثناء حفظ المعاملة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'IN' ? 'success' : 'destructive';
  };

  const getMethodColor = (method: string) => {
    return method === 'Cash' ? 'warning' : 'default';
  };

  return (
    <div className="space-y-6 fade-in" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("المعاملات المالية", "Financial Transactions")}
          </h1>
          <p className="text-muted-foreground">
            {t("إدارة الإيرادات والمصروفات", "Manage revenue and expenses")}
          </p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className={`h-5 w-5 ${isArabic ? 'ml-2' : 'mr-2'}`} />
          {t("معاملة جديدة", "New Transaction")}
        </Button>
      </div>

      {/* Transaction Form */}
      {showForm && (
        <Card className="bg-gradient-card border-primary/20 scale-in">
          <CardHeader>
            <CardTitle className={`flex items-center space-x-2 ${isArabic ? 'space-x-reverse' : ''}`}>
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>{t("معاملة مالية جديدة", "New Financial Transaction")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("نوع المعاملة *", "Transaction Type *")}</Label>
                <Select value={form.type} onValueChange={(value) => setForm({...form, type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("اختر نوع المعاملة", "Choose transaction type")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">{t("إيراد", "Revenue")}</SelectItem>
                    <SelectItem value="OUT">{t("مصروف", "Expense")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transactionName">{t("اسم المعاملة / الملاحظة *", "Transaction Name / Note *")}</Label>
                <Input
                  id="transactionName"
                  placeholder={t("وصف المعاملة", "Transaction description")}
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transactionAmount">{t("المبلغ *", "Amount *")}</Label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="transactionAmount"
                    type="number"
                    placeholder={t("المبلغ", "Amount")}
                    value={form.amount}
                    onChange={(e) => setForm({...form, amount: e.target.value})}
                    className="pr-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("طريقة الدفع *", "Payment Method *")}</Label>
                <Select value={form.method} onValueChange={(value) => setForm({...form, method: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("اختر طريقة الدفع", "Choose payment method")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">{t("نقدي", "Cash")}</SelectItem>
                    <SelectItem value="Other">{t("أخرى", "Other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transactionDate">{t("التاريخ", "Date")}</Label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="transactionDate"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({...form, date: e.target.value})}
                    className="pr-10"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="transactionNote">{t("ملاحظات إضافية", "Additional Notes")}</Label>
                <Textarea
                  id="transactionNote"
                  placeholder={t("ملاحظات اختيارية", "Optional notes")}
                  value={form.note}
                  onChange={(e) => setForm({...form, note: e.target.value})}
                />
              </div>
            </div>
            <div className={`flex gap-3 pt-4 ${isArabic ? 'space-x-reverse' : ''}`}>
              <Button 
                onClick={handleSaveTransaction} 
                disabled={loading}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
                {t("حفظ المعاملة", "Save Transaction")}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                {t("إلغاء", "Cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <div className="grid gap-4">
        {transactions.map((transaction, index) => (
          <Card 
            key={transaction.id} 
            className="card-hover bg-gradient-card slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 space-x-reverse">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    {transaction.type === 'IN' ? (
                      <TrendingUp className="h-6 w-6 text-success" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-destructive" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 space-x-reverse mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold text-foreground">{transaction.name}</h3>
                    </div>
                    <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1 space-x-reverse">
                        <Calendar className="h-3 w-3" />
                        <span>{transaction.date}</span>
                      </div>
                      <Badge variant={getMethodColor(transaction.method) as any}>
                        {transaction.method === 'Cash' ? t('نقدي', 'Cash') : t('أخرى', 'Other')}
                      </Badge>
                    </div>
                    {transaction.note && (
                      <p className="text-xs text-muted-foreground mt-1">{transaction.note}</p>
                    )}
                  </div>
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-2 space-x-reverse mb-1">
                    <DollarSign className={`h-4 w-4 ${transaction.type === 'IN' ? 'text-success' : 'text-destructive'}`} />
                    <span className={`text-2xl font-bold ${transaction.type === 'IN' ? 'text-success' : 'text-destructive'}`}>
                      {transaction.type === 'IN' ? '+' : '-'}{transaction.amount.toLocaleString()} {t('جنيه', 'EGP')}
                    </span>
                  </div>
                  <Badge variant={getTypeColor(transaction.type) as any}>
                    {transaction.type === 'IN' ? t('إيراد', 'Revenue') : t('مصروف', 'Expense')}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {transactions.length === 0 && (
        <Card className="bg-gradient-card">
          <CardContent className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("لا توجد معاملات", "No Transactions")}</h3>
            <p className="text-muted-foreground mb-4">
              {t("ابدأ بتسجيل أول معاملة مالية", "Start by recording your first financial transaction")}
            </p>
            <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90">
              <Plus className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
              {t("معاملة جديدة", "New Transaction")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}