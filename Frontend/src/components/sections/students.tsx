import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  GraduationCap,
  Mail,
  Phone
} from "lucide-react";

import { getStudentByIdentifier, API_CF } from "@/lib/api";
import { ProcessDriveStudentsButton } from "./process-drive-students-btn";
import { useToast } from "@/hooks/use-toast";


export function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", grade: "", price: "", email: "" });
  const [addLoading, setAddLoading] = useState(false);
  const { toast } = useToast();

  // Fetch all students from backend
  const fetchStudents = () => {
    setLoading(true);
    fetch(`${API_CF}/students`)
      .then(res => res.json())
      .then(data => {
        const raw = data.students || [];
        // normalize backend sheet-based fields into frontend-friendly fields
        const normalized = raw.map((s: any) => {
          const base = Number(s.Total_Fees || s.totalFees || s.Fees || 0) || 0;
            const discount = Number(s.Discount_Percent || s.discountPercent || s.discount || 0) || 0;
            const net = Number(s.Net_Amount || s.netAmount || 0) || 0;
            const totalPaid = Number(s.Total_Paid || s.totalPaid || s.paidAmount || 0) || 0;
            const remaining = Number(s.Remaining_Balance || s.remainingBalance || s.unpaid || 0) || 0;

          return {
            id: s.Student_ID || s.studentId || s.studentID || s.id,
            name: s.Name || s.name,
            grade: s.Year || s.year || s.grade,
            baseFees: base,
            netFees: net,
            totalPaid: totalPaid,
            unpaid: remaining,
            discount: discount,
            status: (s.Status || s.status || 'Active'),
            phone: s.Phone_Number || s.phoneNumber || s.phone || ''
          };
        });
        setStudents(normalized);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  // initial fetch and polling for live updates
  useEffect(() => {
    fetchStudents();
    const id = setInterval(fetchStudents, 5000); // refresh every 5s
    return () => clearInterval(id);
  }, []);

  // Search students by name or ID
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    const res = await getStudentByIdentifier(searchTerm.trim());
    if (res.ok && res.data) {
      // normalize single student result
      const s = res.data as any;
      const normalized = {
        id: s.studentId || s.Student_ID || s.studentID || s.id,
        name: s.name || s.Name,
        grade: s.year || s.Year || s.grade,
        baseFees: Number(s.totalFees || s.Total_Fees || s.fees || 0) || 0,
        netFees: Number(s.netAmount || s.Net_Amount || 0) || 0,
        totalPaid: Number(s.totalPaid || s.Total_Paid || 0) || 0,
        unpaid: Number(s.remainingBalance || s.Remaining_Balance || s.unpaid || 0) || 0,
        discount: Number(s.discountPercent || s.Discount_Percent || s.discount || 0) || 0,
        status: s.status || s.Status || 'Active',
        phone: s.phoneNumber || s.Phone_Number || ''
      };
      setStudents([normalized]);
    } else {
      setStudents([]);
    }
    setLoading(false);
  };

  // Add student handler
  const handleAddStudent = async () => {
    if (!addForm.name || !addForm.grade || !addForm.price) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(`${API_CF}/students/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          grade: addForm.grade,
          price: addForm.price,
          email: addForm.email
        })
      });
      if (res.ok) {
        toast({ title: "Student added", description: `${addForm.name} added successfully!`, variant: "default" });
        setShowAddForm(false);
        setAddForm({ name: "", grade: "", price: "", email: "" });
        fetchStudents();
      } else {
        toast({ title: "Error", description: "Failed to add student", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to add student", variant: "destructive" });
    }
    setAddLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "success";
      case "pending": return "warning";
      case "inactive": return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Removed import button from here, now in header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Students</h1>
          <p className="text-muted-foreground">Manage your student records</p>
        </div>
        <Button 
          variant="hero" 
          onClick={() => setShowAddForm(!showAddForm)}
          className="hover:scale-110"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="bg-gradient-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              />
            </div>
            <Button variant="outline" className="hover:scale-105" onClick={handleSearch}>
              <Filter className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Student Form */}
      {showAddForm && (
        <Card className="bg-gradient-card border-primary/20 scale-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Add New Student</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" placeholder="Enter student's full name" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade/Level</Label>
                <Input id="grade" placeholder="e.g., Grade 1, Beginner" value={addForm.grade} onChange={e => setAddForm(f => ({ ...f, grade: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Course Price</Label>
                <Input id="price" type="number" placeholder="150" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input id="email" type="email" placeholder="student@example.com" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="flex space-x-3 pt-4">
              <Button variant="success" onClick={handleAddStudent} disabled={addLoading}>
                <Plus className="h-4 w-4 mr-2" />
                {addLoading ? "Adding..." : "Add Student"}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students List */}
      {loading ? (
        <div className="text-center py-8">Loading students...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((student, index) => (
            <Card 
              key={student.id || student.studentID || index} 
              className="card-hover bg-gradient-card slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground truncate">{student.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{student.grade}</p>
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Net Amount</span>
                    <span className="font-semibold text-foreground">{(student.netFees || student.baseFees || 0).toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Paid</span>
                    <span className="font-medium text-primary">{(student.totalPaid || 0).toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Remaining</span>
                    { (student.unpaid || 0) < 0 ? (
                      <span className="font-semibold text-emerald-600">{Math.abs(student.unpaid || 0).toLocaleString()} EGP (Credit)</span>
                    ) : (
                      <span className="font-semibold text-destructive">{(student.unpaid || 0).toLocaleString()} EGP</span>
                    ) }
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Mail className="h-4 w-4 mr-1" />
                      Contact
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1">
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {students.length === 0 && !loading && (
        <Card className="bg-gradient-card">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No students found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "Try adjusting your search terms" : "Start by adding your first student"}
            </p>
            <Button variant="hero" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Student
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}