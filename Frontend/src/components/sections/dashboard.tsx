import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  CreditCard
} from "lucide-react";
import { useEffect, useState } from 'react';
import { getAnalytics, getRecentTransactions } from '@/lib/api';

export function Dashboard() {
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getAnalytics();
        if (res.ok && res.data) setAnalytics(res.data.analytics || res.data);
        // load recent transactions
        const tx = await getRecentTransactions();
        if (tx.ok) {
          const payload = tx.data || [];
          // payload may be { transactions: [...] } or an array
          const anyPayload: any = payload;
          const list = Array.isArray(payload) ? payload : (anyPayload.transactions || anyPayload);
          setTransactions(list || []);
        }
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const onUpdate = () => { load(); };
    window.addEventListener('finance.updated', onUpdate as EventListener);
    return () => { window.removeEventListener('finance.updated', onUpdate as EventListener); };
  }, []);

  const totalStudents = analytics?.students?.totalStudents || 0;
  const monthlyRevenue = analytics?.transactions?.totalIncome || 0;
  const overduePayments = analytics?.overduePayments?.totalOverdue || 0;
  const totalBalance = (analytics?.cash?.totalCashInHand || 0) + (analytics?.bank?.totalInBank || 0);
  const cashBalance = analytics?.cash?.totalCashInHand || 0;
  const bankBalance = analytics?.bank?.totalInBank || 0;

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your school overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Total Students"
          value={totalStudents}
          icon={Users}
          trend={{ value: 8, label: "vs last month" }}
          variant="default"
          className="slide-up"
        />
        <StatsCard
          title="Monthly Revenue"
          value={`$${monthlyRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 12, label: "vs last month" }}
          variant="success"
          className="slide-up"
        />
        {/* Overdue Payments card intentionally removed from dashboard per request */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-hover bg-gradient-card scale-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Financial Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-background/50 rounded-lg">
              <span className="text-sm font-medium">Total Balance</span>
              <span className="text-lg font-bold text-success">
                ${totalBalance.toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-accent/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Cash Balance</p>
                <p className="text-lg font-semibold">${cashBalance.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Bank Balance</p>
                <p className="text-lg font-semibold">${bankBalance.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover bg-gradient-card scale-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.length > 0 ? (
                transactions.slice(0, 6).map((tx, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background/50 rounded-lg hover:bg-background/80 transition-colors">
                    <div className="flex items-center space-x-3">
                      {tx.Type && tx.Type.toLowerCase() === 'in' ? (
                        <CreditCard className="h-4 w-4 text-success" />
                      ) : (
                        <Users className="h-4 w-4 text-primary" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{tx.Payer_Receiver_Name || tx.Payer_Receiver || tx.Payer || tx.Subject || tx.Name || 'Transaction'}</p>
                        <p className="text-xs text-muted-foreground">{tx.Type ? `${tx.Type} ${tx.Amount || tx.Amount}` : `Amount ${tx.Amount || tx.Amount}`}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{tx.Date || tx.date || ''}</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center space-x-4 fade-in">
        <Button variant="hero" size="lg" className="hover:scale-110">
          <Users className="h-5 w-5 mr-2" />
          Quick Add Student
        </Button>
        <Button variant="outline" size="lg" className="hover:scale-105">
          <CreditCard className="h-5 w-5 mr-2" />
          Record Payment
        </Button>
      </div>
    </div>
  );
}