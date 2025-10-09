// API base URL is injected at build time via Vite environment variables
// Set VITE_API_BASE_URL to the backend root (e.g. https://your-backend.run.app)
// If the env var wasn't set at build-time (common on Vercel), fall back to the
// deployed backend URL so the site doesn't attempt to call localhost from the
// user's browser. This fallback is intentionally explicit so you can change it.
const BUILD_API_BASE = (import.meta.env?.VITE_API_BASE_URL as string) || '';
const DEPLOYED_FALLBACK = 'https://rajac-finance-backend-dzcp5vj26q-uc.a.run.app';
const API_BASE = BUILD_API_BASE || DEPLOYED_FALLBACK;
if (!BUILD_API_BASE) {
  // Helpful debug message in browser console when a client-side build used default
  // (so you can tell why requests are not going to localhost)
  // eslint-disable-next-line no-console
  console.warn('[rajac] VITE_API_BASE_URL not set at build time — using fallback:', API_BASE);
}
const API_BASE_URL = API_BASE.endsWith('/') ? API_BASE + 'api' : API_BASE + '/api';

// Exported constant for other parts of the app that still use fetch directly.
// This value already includes the trailing '/api' segment (e.g. https://.../api)
export const API_CF = API_BASE_URL;

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  student?: T;
  transactions?: T;
  summary?: T;
  overdueList?: T;
  paid?: number;
  remaining?: number;
  message?: string;
  error?: string;
}

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
  payment1Due?: string;
  payment2Due?: string;
  paidAmount?: number;
  remainingAmount?: number;
}

interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  name: string;
  amount: number;
  method: 'Cash' | 'Other';
  date: string;
  note?: string;
}

interface CashSummary {
  availableCash: number;
  availableBank: number;
}

interface OverdueStudent {
  FullName: string;
  DueDate: string;
}

// Helper for GET requests
async function apiGet<T>(endpoint: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
  try {
  const url = new URL(API_BASE_URL + endpoint);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    return { ok: data.success, ...data, data: data.students || data.student || data.teachers || data.data || data.analytics || data.transactions || data.installments || data.config || data.deposits };
  } catch (error) {
    return { ok: false, data: null as T, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper for POST/PUT requests
async function apiSend<T>(endpoint: string, payload: Record<string, any>, method: 'POST' | 'PUT' = 'POST'): Promise<ApiResponse<T>> {
  try {
  const url = new URL(API_BASE_URL + endpoint);
    const response = await fetch(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return { ok: data.success, ...data, data: data.data || data.student || data.students || data.analytics || data.transactions || data.installments || data.config || data.deposits };
  } catch (error) {
    return { ok: false, data: null as T, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// POST API call for form submissions
async function apiPost<T>(action: string, payload: Record<string, any>): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${action}`;

    console.log('API POST Call:', url, payload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(payload),
    });

    console.log('API POST Response Status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('API POST Response Data:', result);
    
    // Backend returns: {success: true, ...} or {success: false, ...}
    if (result && result.success) {
      return {
        ok: true,
        data: result.data || result.teacher || result,
        message: result.msg || result.message
      };
    } else {
      return {
        ok: false,
        data: null as T,
        message: (result && (result.error || result.msg || result.message)) || 'خطأ في إرسال البيانات'
      };
    }
    
  } catch (error) {
    console.error('API POST failed:', error);
    
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return {
        ok: false,
        data: null as T,
        message: 'خطأ في الاتصال: يرجى التأكد من نشر الخادم بشكل صحيح'
      };
    }
    
    return {
      ok: false,
      data: null as T,
      message: `خطأ في إرسال البيانات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`
    };
  }
}

// Student API calls
// Get student by identifier (ID or name)
export async function getStudentByIdentifier(identifier: string): Promise<ApiResponse<Student>> {
  // Call backend then normalize returned student shape into frontend model
  const res = await apiGet<any>(`/students/search/${encodeURIComponent(identifier)}`);
  if (!res.ok || !res.data) return res as ApiResponse<Student>;

  const s = res.data;
  const baseFees = Number(s.totalFees || s.Total_Fees || s.fees || s.baseFees || 0) || 0;
  const discountPct = Number(s.discountPercent || s.Discount_Percent || s.discount || s.discountPct || 0) || 0;
  // Trust backend Net_Amount/netAmount; do not compute locally
  const netFees = Number(s.netAmount || s.Net_Amount || s.netFees || 0) || 0;
  const totalPaid = Number(s.totalPaid || s.Total_Paid || s.paidAmount || 0) || 0;
  // Trust backend Remaining_Balance/remainingBalance
  const unpaid = Number(s.remainingBalance || s.Remaining_Balance || s.unpaid || s.remaining || 0) || 0;

  const normalized: Student = {
    studentID: s.studentId || s.Student_ID || s.id || s.studentID,
    name: s.name || s.Name || '',
    grade: s.year || s.Year || s.grade || '',
    baseFees,
    discountPct,
    netFees,
    totalPaid,
    unpaid,
    // legacy/backwards compatibility
    id: s.studentId || s.Student_ID || s.id,
    fees: baseFees,
    discount: discountPct,
    paidAmount: totalPaid,
    remainingAmount: unpaid
  };

  return { ok: true, data: normalized };
}

// Payment API calls
export async function savePayment(data: {
  studentId: string;
  amountPaid: number;
  paymentMethod: string;
  discountPercent?: number;
  processedBy?: string;
}): Promise<ApiResponse<any>> {
  return apiSend('/payments/process', data, 'POST');
}

// Update student discount
export async function updateStudentDiscount(data: {
  studentId: string;
  discountPercent: number;
}): Promise<ApiResponse<any>> {
  return apiSend('/payments/apply-discount', data, 'POST');
}

// Bank deposit API calls
export async function saveBankDeposit(data: {
  amount: number;
  bankName: string;
  depositedBy?: string;
  notes?: string;
}): Promise<ApiResponse<any>> {
  return apiSend('/bank/deposit', data, 'POST');
}

// In/Out transaction API calls
export async function saveInOut(data: {
  type: string;
  amount: number;
  subject: string;
  payerReceiverName: string;
  paymentMethod: string;
  notes?: string;
  processedBy?: string;
}): Promise<ApiResponse<any>> {
  return apiSend('/finance/transaction', data, 'POST');
}

export async function getRecentTransactions(): Promise<ApiResponse<Transaction[]>> {
  return apiGet<Transaction[]>('/finance/transactions');
}

// Full analytics (returns backend analytics object)
export async function getAnalytics(): Promise<ApiResponse<any>> {
  const res = await apiGet<any>('/analytics');
  if (!res.ok) return res as ApiResponse<any>;
  // apiGet places the raw body into res.data or nested analytics; normalize to analytics object
  const analytics = res.data?.analytics || res.data || res;
  return { ok: true, data: analytics };
}

// Balance API calls
export async function getCashSummary(): Promise<ApiResponse<CashSummary>> {
  const res = await apiGet<any>('/analytics');
  if (!res.ok || !res.data) return res as ApiResponse<CashSummary>;

  // Backend returns analytics: { cash: { totalCashInHand }, bank: { totalInBank } }
  const analytics = res.data.analytics || res.data;
  const availableCash = Number(analytics?.cash?.totalCashInHand || analytics?.cash?.totalCash || analytics?.totalCashInHand || 0) || 0;
  const availableBank = Number(analytics?.bank?.totalInBank || analytics?.bank?.totalInBank || analytics?.bank?.totalInBank || 0) || 0;

  const normalized: CashSummary = {
    availableCash,
    availableBank
  };

  return { ok: true, data: normalized };
}

// Due dates API calls
export async function getOverdueList(): Promise<ApiResponse<OverdueStudent[]>> {
  const res = await apiGet<any>('/payments/overdue');
  if (!res.ok) return res as ApiResponse<OverdueStudent[]>;

  // Backend returns { overdueStudents: [...], totalOverdue, checkedAt }
  const payload = res.data || {};
  const rawList = payload.overdueStudents || payload.data || payload || [];

  // Normalize each overdue entry to a predictable frontend shape
  const list = (rawList || []).map((r: any) => {
    // backend may use different keys: name or Name, phoneNumber or Phone_Number
    const fullName = r.name || r.Name || r.FullName || r.Student_Name || r.studentName || '';
    const phone = r.phoneNumber || r.Phone_Number || r.phone || r.Phone || '';
    const dueDate = r.dueDate || r.DueDate || r.due_date || r.date || '';
    const amountDue = Number(r.amountDue || r.Amount_Due || r.dueAmount || r.Amount || r.amount || 0) || 0;
    const remaining = Number(r.remainingBalance || r.Remaining_Balance || r.balance || 0) || 0;
    const installmentNumber = r.installmentNumber || r.Installment_Number || r.installment || r.paymentNo || null;
    const daysOverdue = r.daysOverdue || r.Days_Overdue || 0;
    const studentId = r.studentId || r.Student_ID || r.id || r.StudentID || null;

    return {
      studentId,
      fullName,
      phone,
      dueDate,
      amountDue,
      remaining,
      installmentNumber,
      daysOverdue,
      raw: r
    };
  });

  return { ok: true, data: list };
}

// Admin helpers
export async function downloadMasterSheet(): Promise<ApiResponse<any>> {
  try {
    const url = API_BASE_URL + '/admin/master-sheet';
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('Failed to download');
    // Create blob and trigger download
    const blob = await res.blob();
    const a = document.createElement('a');
    const urlObj = window.URL.createObjectURL(blob);
    a.href = urlObj;
    a.download = 'master_students.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(urlObj);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Error' };
  }
}

export async function deleteAllData(): Promise<ApiResponse<any>> {
  return apiSend('/admin/delete-all', {}, 'POST');
}

export async function updateInstallments(data: Array<{ number: number; date: string }>): Promise<ApiResponse<any>> {
  return apiSend('/admin/installments', { installments: data }, 'POST');
}

interface DueReportItem {
  StudentID: string;
  FullName: string;
  paymentNo: number;
  dueAmount: number;
  paid: number;
  balance: number;
  dueDate: string;
  overdue: boolean;
}

// Teachers API
export async function getTeachers(): Promise<ApiResponse<any[]>> {
  return apiGet('/teachers');
}

export async function addTeacher(teacher: {
  name: string;
  subject: string;
  numberOfClasses: number;
  totalAmount: number;
}): Promise<ApiResponse<any>> {
  return apiPost('/teachers', teacher);
}

export async function payTeacher(payment: {
  teacherName: string;
  amount: number;
  method: string;
}): Promise<ApiResponse<any>> {
  return apiPost('/teachers/payment', payment);
}

// Implement as needed based on backend endpoint
// export async function getDueReport(year: number, quarter: number): Promise<ApiResponse<DueReportItem[]>> {
//   return apiGet<DueReportItem[]>('/due-report', { year, quarter });
// }