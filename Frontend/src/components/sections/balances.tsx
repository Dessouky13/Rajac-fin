import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatsCard } from "@/components/ui/stats-card";
import { useToast } from "@/hooks/use-toast";
import { getCashSummary, getOverdueList, saveBankDeposit } from "@/lib/api";
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
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositForm, setDepositForm] = useState({
    amount: "",
    date: new Date().toISOString().split('T')[0],
    note: ""
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

  const handleBankDeposit = async () => {
    if (!depositForm.amount) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ الإيداع",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await saveBankDeposit({
        amount: parseFloat(depositForm.amount),
        bankName: 'Default Bank',
        depositedBy: 'Frontend User',
        notes: depositForm.note || undefined
      });

      if (response.ok) {
        toast({
          title: "تم الإيداع بنجاح",
          description: `تم إيداع ${depositForm.amount} جنيه في البنك`,
        });
        
        // Optimistically update cashSummary locally
        const amt = parseFloat(depositForm.amount || '0') || 0;
        setCashSummary(prev => ({
          availableCash: Math.max(0, prev.availableCash - amt),
          availableBank: prev.availableBank + amt
        }));

        // Reset form
        setDepositForm({
          amount: "",
          date: new Date().toISOString().split('T')[0],
          note: ""
        });
        setShowDepositForm(false);
        
        // Refresh data in background to ensure authoritative values
        setTimeout(() => loadData(), 500);
        try { window.dispatchEvent(new CustomEvent('finance.updated')); } catch(e) {}
      } else {
        toast({
          title: "فشل في الإيداع",
          description: response.message || "حدث خطأ أثناء الإيداع",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "خطأ في الإيداع",
        description: "حدث خطأ أثناء إيداع المبلغ",
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
            {t("النقد والبنك والودائع والمدفوعات المتأخرة", "Cash, bank, deposits and overdue payments")}
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
        {/* Financial Summary & Bank Deposit */}
        <Card className="card-hover bg-gradient-card scale-in">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>{t("ملخص مالي", "Financial Summary")}</span>
              </div>
              <Button
                size="sm"
                onClick={() => setShowDepositForm(!showDepositForm)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
                {t("إيداع بنكي", "Bank Deposit")}
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

            {/* Bank Deposit Form */}
            {showDepositForm && (
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center">
                  <ArrowUpDown className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
                  {t("إيداع من النقد إلى البنك", "Transfer from Cash to Bank")}
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="depositAmount">{t("مبلغ الإيداع", "Deposit Amount")}</Label>
                    <Input
                      id="depositAmount"
                      type="number"
                      placeholder={t("المبلغ", "Amount")}
                      value={depositForm.amount}
                      onChange={(e) => setDepositForm({...depositForm, amount: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="depositDate">{t("تاريخ الإيداع", "Deposit Date")}</Label>
                    <Input
                      id="depositDate"
                      type="date"
                      value={depositForm.date}
                      onChange={(e) => setDepositForm({...depositForm, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="depositNote">{t("ملاحظة (اختياري)", "Note (Optional)")}</Label>
                    <Textarea
                      id="depositNote"
                      placeholder={t("ملاحظة...", "Note...")}
                      value={depositForm.note}
                      onChange={(e) => setDepositForm({...depositForm, note: e.target.value})}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleBankDeposit} 
                      disabled={loading}
                      size="sm"
                      className="flex-1"
                    >
                      {t("إيداع", "Deposit")}
                    </Button>
                    <Button 
                      onClick={() => setShowDepositForm(false)} 
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