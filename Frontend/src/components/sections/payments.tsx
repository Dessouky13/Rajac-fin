import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Plus, 
  Search, 
  DollarSign,
  Calendar,
  User,
  Receipt
} from "lucide-react";
import { getCashSummary, savePayment, API_CF } from "@/lib/api";

// Mock payment data
const mockPayments = [
  { id: 1, student: "Alice Johnson", amount: 150, method: "Cash", date: "2024-01-15", status: "completed" },
  { id: 2, student: "Bob Smith", amount: 175, method: "Bank", date: "2024-01-14", status: "completed" },
  { id: 3, student: "Carol Davis", amount: 200, method: "Cash", date: "2024-01-13", status: "pending" },
  { id: 4, student: "David Wilson", amount: 175, method: "Bank", date: "2024-01-12", status: "completed" },
];

export function Payments() {
  const [payments] = useState(mockPayments);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [grades] = useState(["Grade_9","Grade_10","Grade_11","Grade_12","Unknown"]);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [studentsByGrade, setStudentsByGrade] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: '', date: new Date().toISOString().split('T')[0] });

  const filteredPayments = payments.filter(payment =>
    payment.student.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMethodColor = (method: string) => {
    return method === "Cash" ? "warning" : "default";
  };

  const getStatusColor = (status: string) => {
    return status === "completed" ? "success" : "warning";
  };

  useEffect(() => {
    // when grade changes, fetch students for that grade from backend
    const loadStudents = async () => {
      if (!selectedGrade) return;
      try {
        // backend provides /api/students which returns all students; we filter by Year/Grade on frontend for simplicity
        const res = await fetch(`${API_CF}/students`);
        const data = await res.json();
        const raw = data.students || [];
        const filtered = raw.filter((s: any) => {
          const year = (s.Year || s.year || '').toString();
          // normalize grade sheet names: Grade_5 etc.
          if (!year) return selectedGrade === 'Unknown';
          const num = year.match(/(\d{1,3})/);
          if (num && selectedGrade.startsWith('Grade_')) {
            return (`Grade_${num[1]}`) === selectedGrade;
          }
          // fallback to comparing cleaned strings
          return (`Grade_${year.replace(/\s+/g,'_')}`) === selectedGrade;
        }).map((s: any) => ({
          id: s.Student_ID || s.studentId || s.id,
          name: s.Name || s.name,
          remaining: Number(s.Remaining_Balance || s.remainingBalance || s.unpaid || 0)
        }));
        setStudentsByGrade(filtered);
      } catch (err) {
        console.error('Failed to load students for grade', err);
      }
    };
    loadStudents();
  }, [selectedGrade]);

  const handleSelectStudent = (id: string) => {
    const s = studentsByGrade.find(st => st.id === id) || null;
    setSelectedStudent(s);
    setPaymentForm(prev => ({ ...prev, amount: s ? String(s.remaining) : '' }));
  };

  const handleSubmitPayment = async () => {
    if (!selectedStudent || !paymentForm.amount || !paymentForm.method) return;
    try {
      const payload = {
        studentId: selectedStudent.id,
        amountPaid: parseFloat(paymentForm.amount),
        paymentMethod: paymentForm.method,
        processedBy: 'Frontend User'
      };
      const res = await savePayment(payload);
      if (res.ok) {
        // dispatch finance updated so dashboard/balances refresh
        window.dispatchEvent(new CustomEvent('finance.updated'));
        setShowAddForm(false);
      } else {
        console.error('Failed to save payment', res.message);
      }
    } catch (err) {
      console.error('Error saving payment', err);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">Track and manage student payments</p>
        </div>
        <Button 
          variant="hero" 
          onClick={() => setShowAddForm(!showAddForm)}
          className="hover:scale-110"
        >
          <Plus className="h-5 w-5 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-gradient-card">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search payments by student name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add Payment Form */}
      {showAddForm && (
        <Card className="bg-gradient-card border-primary/20 scale-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <span>Record New Payment</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gradeSelect">Grade</Label>
                <Select value={selectedGrade || ''} onValueChange={(v) => setSelectedGrade(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map(g => <SelectItem value={g} key={g}>{g.replace('Grade_','Grade ')}</SelectItem>)}
                    <SelectItem value={'Unknown'} key={'Unknown'}>Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="studentSelect">Student</Label>
                <Select value={selectedStudent?.id || ''} onValueChange={(v) => handleSelectStudent(v || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentsByGrade.map(s => <SelectItem value={s.id} key={s.id}>{s.name} - {(s.remaining || 0).toLocaleString()} EGP</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" placeholder="150.00" value={paymentForm.amount} onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Payment Method</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm(prev => ({ ...prev, method: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Instapay">Instapay</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Visa">Visa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payDate">Payment Date</Label>
                <Input id="payDate" type="date" />
              </div>
            </div>
              <div className="flex space-x-3 pt-4">
              <Button variant="success" onClick={handleSubmitPayment}>
                <Receipt className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments List */}
      <div className="grid gap-4">
        {filteredPayments.map((payment, index) => (
          <Card 
            key={payment.id} 
            className="card-hover bg-gradient-card slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold text-foreground">{payment.student}</h3>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{payment.date}</span>
                      </div>
                      <Badge variant={getMethodColor(payment.method) as any}>
                        {payment.method}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2 mb-1">
                    <DollarSign className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold text-success">
                      ${payment.amount}
                    </span>
                  </div>
                  <Badge variant={getStatusColor(payment.status) as any}>
                    {payment.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPayments.length === 0 && (
        <Card className="bg-gradient-card">
          <CardContent className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No payments found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "Try adjusting your search terms" : "Start by recording your first payment"}
            </p>
            <Button variant="hero" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record First Payment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}