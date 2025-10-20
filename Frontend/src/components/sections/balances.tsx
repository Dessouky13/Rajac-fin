import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatsCard } from "@/components/ui/stats-card";
import { useToast } from "@/hooks/use-toast";
import { getCashSummary, getOverdueList, saveBankDeposit, saveBankWithdrawal } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  DollarSign, 
  PiggyBank, 
  CreditCard,
  AlertTriangle,
  Calendar,
  RefreshCw,
  TrendingUp,
  Banknote,
  ArrowUpDown,
  Plus
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CashSummary {
  availableCash: number;
  availableBank: number;
}

interface OverdueStudent {
  FullName: string;
  DueDate: string;
}

export function Balances() {
  const { isArabic, t } = useLanguage();
  const [cashSummary, setCashSummary] = useState<CashSummary>({
    availableCash: 0,
    availableBank: 0
  });
  const [activePaymentNo, setActivePaymentNo] = useState<number>(1);
  const [overdueStudents, setOverdueStudents] = useState<OverdueStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferForm, setTransferForm] = useState({
    amount: "",
    date: new Date().toISOString().split('T')[0],
    note: "",
    direction: "deposit" as "deposit" | "withdraw"
  });
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      // Load cash summary
      const cashResponse = await getCashSummary();
      if (cashResponse.ok) {
        setCashSummary(cashResponse.data);
      }

      // Load overdue payments
  const overdueResponse = await getOverdueList();
      if (overdueResponse.ok) {
        setOverdueStudents(overdueResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to load balance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverdueData = async (paymentNo: number) => {
    setActivePaymentNo(paymentNo);
    try {
  const overdueResponse = await getOverdueList();
      if (overdueResponse.ok) {
        setOverdueStudents(overdueResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to load overdue data:', error);
    }
  };

  const handleBankTransfer = async () => {
    if (!transferForm.amount) {
      toast({
        title: t("خطأ", "Error"),
        description: t("يرجى إدخال مبلغ التحويل", "Please enter a transfer amount"),
        variant: "destructive"
      });
      return;
    }

    const parsedAmount = parseFloat(transferForm.amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({
        title: t("خطأ", "Error"),
        description: t("المبلغ يجب أن يكون أكبر من صفر", "Amount must be greater than zero"),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const isDeposit = transferForm.direction === "deposit";
      const response = isDeposit
        ? await saveBankDeposit({
            amount: parsedAmount,
            bankName: 'Default Bank',
            depositedBy: 'Frontend User',
            notes: transferForm.note || undefined
          })
        : await saveBankWithdrawal({
            amount: parsedAmount,
            bankName: 'Default Bank',
            withdrawnBy: 'Frontend User',
            notes: transferForm.note || undefined
          });

      if (!response.ok) {
        throw new Error(response.message || 'transfer failed');
      }

      const successMessage = isDeposit
        ? t("تم تحويل المبلغ إلى البنك", "Cash moved to bank successfully")
        : t("تم سحب المبلغ من البنك", "Bank funds moved to cash successfully");

      toast({
        title: t("نجاح", "Success"),
        description: successMessage
      });

      setCashSummary(prev => ({
        availableCash: isDeposit ? prev.availableCash - parsedAmount : prev.availableCash + parsedAmount,
        availableBank: isDeposit ? prev.availableBank + parsedAmount : prev.availableBank - parsedAmount
      }));

      setTransferForm({
        amount: "",
        date: new Date().toISOString().split('T')[0],
        note: "",
        direction: "deposit"
      });
      setShowTransferForm(false);

      setTimeout(() => loadData(), 500);
      try { window.dispatchEvent(new CustomEvent('finance.updated')); } catch (e) {}
    } catch (error) {
      toast({
        title: t("خطأ", "Error"),
        description: t("فشل في تسجيل التحويل", "Failed to record transfer"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const onUpdate = () => loadData();
    window.addEventListener('finance.updated', onUpdate as EventListener);
    return () => window.removeEventListener('finance.updated', onUpdate as EventListener);
  }, []);

  const totalBalance = cashSummary.availableCash + cashSummary.availableBank;

  return (
    <div className="space-y-6 fade-in" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("لوحة الأرصدة", "Balance Dashboard")}
          </h1>
          <p className="text-muted-foreground">
            {t("", "Cash, bank, deposits and overdue payments")}
          </p>
        </div>
        <Button 
          onClick={loadData} 
          disabled={loading}
          variant="outline"
          className="hover:scale-105"
        >
          <RefreshCw className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'} ${loading ? 'animate-spin' : ''}`} />
          {t("تحديث البيانات", "Refresh Data")}
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title={t("إجمالي الرصيد", "Total Balance")}
          value={`${totalBalance.toLocaleString()} ${t("جنيه", "EGP")}`}
          icon={DollarSign}
          variant="success"
          className="slide-up"
        />
        <StatsCard
          title={t("النقد المتاح", "Available Cash")}
          value={`${cashSummary.availableCash.toLocaleString()} ${t("جنيه", "EGP")}`}
          icon={Banknote}
          variant="warning"
          className="slide-up"
        />
        <StatsCard
          title={t("رصيد البنك", "Bank Balance")}
          value={`${cashSummary.availableBank.toLocaleString()} ${t("جنيه", "EGP")}`}
          icon={CreditCard}
          variant="default"
          className="slide-up"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Summary & Bank Transfer */}
        <Card className="card-hover bg-gradient-card scale-in">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>{t("ملخص مالي", "Financial Summary")}</span>
              </div>
              <Button
                size="sm"
                onClick={() => setShowTransferForm(!showTransferForm)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
                {t("تحويل بنكي", "Bank Transfer")}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-success/10 rounded-lg border border-success/20">
                <Banknote className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("النقد", "Cash")}</p>
                <p className="text-xl font-bold text-success">
                  {cashSummary.availableCash.toLocaleString()} {t("جنيه", "EGP")}
                </p>
              </div>
              <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                <CreditCard className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("البنك", "Bank")}</p>
                <p className="text-xl font-bold text-primary">
                  {cashSummary.availableBank.toLocaleString()} {t("جنيه", "EGP")}
                </p>
              </div>
            </div>

            {/* Bank Transfer Form */}
            {showTransferForm && (
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center">
                  <ArrowUpDown className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
                  {transferForm.direction === 'deposit'
                    ? t("تحويل من النقد إلى البنك", "Transfer from cash to bank")
                    : t("تحويل من البنك إلى النقد", "Transfer from bank to cash")}
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="transferType">{t("نوع التحويل", "Transfer type")}</Label>
                    <Select
                      value={transferForm.direction}
                      onValueChange={(value: "deposit" | "withdraw") =>
                        setTransferForm({ ...transferForm, direction: value })
                      }
                    >
                      <SelectTrigger id="transferType">
                        <SelectValue placeholder={t("اختيار النوع", "Select type")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">{t("من النقد إلى البنك", "Cash to bank")}</SelectItem>
                        <SelectItem value="withdraw">{t("من البنك إلى النقد", "Bank to cash")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="transferAmount">{t("المبلغ", "Amount")}</Label>
                    <Input
                      id="transferAmount"
                      type="number"
                      placeholder={t("المبلغ", "Amount")}
                      value={transferForm.amount}
                      onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transferDate">{t("تاريخ العملية", "Transfer date")}</Label>
                    <Input
                      id="transferDate"
                      type="date"
                      value={transferForm.date}
                      onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transferNote">{t("ملاحظة (اختياري)", "Note (optional)")}</Label>
                    <Textarea
                      id="transferNote"
                      placeholder={t("ملاحظة...", "Note...")}
                      value={transferForm.note}
                      onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleBankTransfer}
                      disabled={loading}
                      size="sm"
                      className="flex-1"
                    >
                      {transferForm.direction === 'deposit'
                        ? t("تنفيذ الإيداع", "Deposit")
                        : t("تنفيذ السحب", "Withdraw")}
                    </Button>
                    <Button 
                      onClick={() => setShowTransferForm(false)} 
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {t("إلغاء", "Cancel")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Payments intentionally removed */}
      </div>
    </div>
  );
}