"use client";

import { useState, useRef } from "react";
import Sidebar from "@/app/components/Sidebar";
import UserHeader from "@/app/components/UserHeader";

// --- STATUS TYPES & COLORS (Pending > Approved > Rejected > Disbursed > Received) ---
// "Submitted" is NOT a status - it's the total count of all claims submitted
const STATUSES = [
  { key: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", headerBg: "bg-yellow-50 border-yellow-200", count: "text-yellow-600" },
  { key: "approved", label: "Approved", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", headerBg: "bg-green-50 border-green-200", count: "text-green-600" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", headerBg: "bg-red-50 border-red-200", count: "text-red-600" },
  { key: "disbursed", label: "Disbursed", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500", headerBg: "bg-purple-50 border-purple-200", count: "text-purple-600" },
  { key: "received", label: "Received", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", headerBg: "bg-emerald-50 border-emerald-200", count: "text-emerald-600" },
] as const;

type StatusKey = typeof STATUSES[number]["key"];

// --- MONTHLY DEADLINE CYCLE ---
const DEADLINES = [
  { date: "2nd", day: 2, label: "Submission", description: "Claims must be submitted by this date", dotColor: "bg-blue-400", textColor: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  { date: "12th", day: 12, label: "Approval", description: "Finance reviews and approves/rejects claims", dotColor: "bg-yellow-400", textColor: "text-yellow-600", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
  { date: "14th", day: 14, label: "Resubmission", description: "Rejected claims can be resubmitted", dotColor: "bg-red-400", textColor: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
  { date: "17th", day: 17, label: "Final Review", description: "Finance finalizes resubmitted claims", dotColor: "bg-purple-400", textColor: "text-purple-600", bgColor: "bg-purple-50", borderColor: "border-purple-200" },
  { date: "22nd", day: 22, label: "Disbursement", description: "Approved claims are disbursed", dotColor: "bg-emerald-400", textColor: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
];

// --- REGIONS & HQ DEPARTMENTS ---
const REGIONS = [
  {
    value: "region-a", label: "Region A",
    branches: [
      { value: "RBY", label: "Rimbayu" },
      { value: "KLG", label: "Klang" },
      { value: "SHA", label: "Shah Alam" },
      { value: "SA", label: "Setia Alam" },
      { value: "DA", label: "Denai Alam" },
      { value: "EGR", label: "Eco Grandeur" },
      { value: "ST", label: "Subang Taipan" },
    ],
  },
  {
    value: "region-b", label: "Region B",
    branches: [
      { value: "DK", label: "Danau Kota" },
      { value: "KD", label: "Kota Damansara" },
      { value: "AMP", label: "Ampang" },
      { value: "SP", label: "Sri Petaling" },
      { value: "BTHO", label: "Bandar Tun Hussein Onn" },
      { value: "KTG", label: "Kajang TTDI Groove" },
      { value: "TSG", label: "Taman Sri Gombak" },
    ],
  },
  {
    value: "region-c", label: "Region C",
    branches: [
      { value: "PJY", label: "Putrajaya" },
      { value: "KW", label: "Kota Warisan" },
      { value: "BBB", label: "Bandar Baru Bangi" },
      { value: "CJY", label: "Cyberjaya" },
      { value: "BSP", label: "Bandar Seri Putra" },
      { value: "DPU", label: "Dataran Puchong Utama" },
      { value: "ONL", label: "Online" },
    ],
  },
  {
    value: "HQ", label: "HQ",
    branches: [],
  },
] as const;

const HQ_DEPARTMENTS = [
  { value: "OD", label: "OD" },
  { value: "MKT", label: "MKT" },
  { value: "FNC", label: "Finance" },
  { value: "HR", label: "HR" },
  { value: "ACD", label: "Academy" },
  { value: "OPS", label: "Operations" },
  { value: "IOP", label: "IOP" },
];

// --- CLAIM TYPE DEFINITIONS ---
const CLAIM_TYPES = [
  { id: "sales", title: "Sales Claim", icon: "📈", color: "bg-gradient-to-br from-blue-500 to-blue-700", hex: "#2563eb" },
  { id: "health", title: "Health Claim", icon: "🏥", color: "bg-gradient-to-br from-emerald-500 to-emerald-700", hex: "#059669" },
  { id: "transport", title: "Transport", icon: "🚗", color: "bg-gradient-to-br from-orange-400 to-orange-600", hex: "#ea580c" },
];

// --- MOCK DATA ---
interface Attachment {
  name: string;
  type: "pdf" | "image";
  url: string;
  size: string;
}

interface ClaimRecord {
  id: string;
  employeeName: string;
  branch: string;
  department?: string;
  claimType: string;
  amount: number;
  dateSubmitted: string;
  status: StatusKey;
  description?: string;
  remarks?: string;
  approvedAmount?: number;
  rejectionReason?: string;
  resubmitCount?: number;
  attachments?: Attachment[];
}

const getBranchesForRegion = (regionValue: string): string[] => {
  const region = REGIONS.find((r) => r.value === regionValue);
  if (!region) return [];
  if (regionValue === "HQ") return ["HQ"];
  return region.branches.map((b) => b.value);
};

const MOCK_CLAIMS: ClaimRecord[] = [
  { id: "CLM-001", employeeName: "Ahmad Razif", branch: "HQ", department: "FNC", claimType: "Sales Claim", amount: 450.00, dateSubmitted: "2026-04-01", status: "pending", description: "Client entertainment for Q2 sales meeting at Marriott Hotel", attachments: [{ name: "receipt_marriott.pdf", type: "pdf", url: "/attachments/receipt_marriott.pdf", size: "245 KB" }] },
  { id: "CLM-002", employeeName: "Siti Nurhaliza", branch: "KLG", claimType: "Transport", amount: 42.00, dateSubmitted: "2026-04-02", status: "pending", description: "Distance: 30 km (one way) x RM0.70 x 2 = RM42.00", attachments: [{ name: "grab_receipt.jpg", type: "image", url: "/attachments/grab_receipt.jpg", size: "128 KB" }, { name: "grab_receipt_2.jpg", type: "image", url: "/attachments/grab_receipt_2.jpg", size: "96 KB" }] },
  { id: "CLM-003", employeeName: "Muhammad Faris", branch: "DK", claimType: "Health Claim", amount: 300.00, dateSubmitted: "2026-03-28", status: "pending", description: "Dental checkup and cleaning at KPJ Damansara", attachments: [{ name: "dental_invoice.pdf", type: "pdf", url: "/attachments/dental_invoice.pdf", size: "312 KB" }] },
  { id: "CLM-004", employeeName: "Nur Aisyah", branch: "PJY", claimType: "Health Claim", amount: 150.00, dateSubmitted: "2026-03-25", status: "pending", description: "GP consultation and medication for fever and flu", attachments: [{ name: "clinic_receipt.jpg", type: "image", url: "/attachments/clinic_receipt.jpg", size: "180 KB" }] },
  { id: "CLM-005", employeeName: "Lim Wei Jie", branch: "HQ", department: "HR", claimType: "Sales Claim", amount: 780.00, dateSubmitted: "2026-03-20", status: "approved", description: "Team building lunch with new recruits", approvedAmount: 780.00, remarks: "Approved. Receipts verified.", attachments: [{ name: "lunch_receipt.pdf", type: "pdf", url: "/attachments/lunch_receipt.pdf", size: "198 KB" }] },
  { id: "CLM-006", employeeName: "Tan Mei Ling", branch: "SA", claimType: "Transport", amount: 25.20, dateSubmitted: "2026-03-18", status: "approved", description: "Distance: 18 km (one way) x RM0.70 x 2 = RM25.20", approvedAmount: 25.20, remarks: "Distance verified.", attachments: [{ name: "fuel_receipt.jpg", type: "image", url: "/attachments/fuel_receipt.jpg", size: "88 KB" }] },
  { id: "CLM-007", employeeName: "Rajesh Kumar", branch: "AMP", claimType: "Health Claim", amount: 550.00, dateSubmitted: "2026-03-15", status: "approved", description: "Annual health screening at Gleneagles", approvedAmount: 500.00, remarks: "Approved up to coverage limit of RM500.", attachments: [{ name: "health_screening_report.pdf", type: "pdf", url: "/attachments/health_screening_report.pdf", size: "456 KB" }] },
  { id: "CLM-008", employeeName: "Nurul Huda", branch: "HQ", department: "MKT", claimType: "Sales Claim", amount: 200.00, dateSubmitted: "2026-03-10", status: "rejected", description: "Marketing materials printing", rejectionReason: "Missing original receipts. Please resubmit with proper documentation.", resubmitCount: 0 },
  { id: "CLM-009", employeeName: "Amirul Hakim", branch: "BBB", claimType: "Transport", amount: 35.00, dateSubmitted: "2026-03-05", status: "disbursed", description: "Distance: 25 km (one way) x RM0.70 x 2 = RM35.00", approvedAmount: 35.00, remarks: "Disbursed on 22 Mar 2026.", attachments: [{ name: "fuel_claims_mar.pdf", type: "pdf", url: "/attachments/fuel_claims_mar.pdf", size: "220 KB" }] },
  { id: "CLM-010", employeeName: "Farah Diana", branch: "SP", claimType: "Health Claim", amount: 420.00, dateSubmitted: "2026-03-01", status: "received", description: "Specialist consultation at PPUM", approvedAmount: 420.00, remarks: "Payment received by employee.", attachments: [{ name: "specialist_bill.pdf", type: "pdf", url: "/attachments/specialist_bill.pdf", size: "340 KB" }] },
  { id: "CLM-011", employeeName: "Zulkifli Ismail", branch: "HQ", department: "IOP", claimType: "Health Claim", amount: 280.00, dateSubmitted: "2026-04-05", status: "pending", description: "Physiotherapy for back pain - 2 sessions", attachments: [{ name: "physio_receipt.jpg", type: "image", url: "/attachments/physio_receipt.jpg", size: "156 KB" }] },
  { id: "CLM-012", employeeName: "Priya Sharma", branch: "RBY", claimType: "Sales Claim", amount: 615.00, dateSubmitted: "2026-04-03", status: "pending", description: "Client dinner and transport for Rimbayu launch event", attachments: [{ name: "dinner_receipt.jpg", type: "image", url: "/attachments/dinner_receipt.jpg", size: "210 KB" }, { name: "transport_receipt.pdf", type: "pdf", url: "/attachments/transport_receipt.pdf", size: "145 KB" }] },
];

// --- EMPLOYEE CLAIMS MOCK DATA ---
interface EmployeeClaim {
  id: string;
  claimType: string;
  amount: number;
  approvedAmount: number;
  dateSubmitted: string;
  period: string;
  status: StatusKey;
  description?: string;
  remarks?: string;
  rejectionReason?: string;
  resubmitCount?: number;
  attachments?: Attachment[];
}

const MOCK_EMPLOYEE_CLAIMS: EmployeeClaim[] = [
  { id: "MYC-001", claimType: "Transport", amount: 33.60, approvedAmount: 33.60, dateSubmitted: "2026-04-08", period: "April 2026", status: "received", description: "Distance: 24 km (one way) x RM0.70 x 2 = RM33.60", remarks: "Payment confirmed.", attachments: [{ name: "grab_apr_receipt.jpg", type: "image", url: "/attachments/grab_apr_receipt.jpg", size: "142 KB" }] },
  { id: "MYC-002", claimType: "Sales Claim", amount: 1250.00, approvedAmount: 0, dateSubmitted: "2026-04-02", period: "April 2026", status: "pending", description: "Client entertainment for quarterly sales review", attachments: [{ name: "sales_dinner.pdf", type: "pdf", url: "/attachments/sales_dinner.pdf", size: "280 KB" }] },
  { id: "MYC-003", claimType: "Health Claim", amount: 120.00, approvedAmount: 120.00, dateSubmitted: "2026-03-25", period: "March 2026", status: "approved", description: "Dental treatment at KPJ", remarks: "Approved. Within coverage limit.", attachments: [{ name: "dental_kpj.pdf", type: "pdf", url: "/attachments/dental_kpj.pdf", size: "198 KB" }] },
  { id: "MYC-004", claimType: "Transport", amount: 28.00, approvedAmount: 28.00, dateSubmitted: "2026-03-18", period: "March 2026", status: "disbursed", description: "Distance: 20 km (one way) x RM0.70 x 2 = RM28.00", remarks: "Disbursed on 22 Mar.", attachments: [{ name: "grab_mar.jpg", type: "image", url: "/attachments/grab_mar.jpg", size: "105 KB" }] },
  { id: "MYC-005", claimType: "Sales Claim", amount: 475.00, approvedAmount: 0, dateSubmitted: "2026-03-10", period: "March 2026", status: "rejected", description: "Team lunch at Pavilion", rejectionReason: "Receipt date does not match claim period. Please resubmit with correct documentation.", resubmitCount: 0 },
  { id: "MYC-006", claimType: "Health Claim", amount: 85.00, approvedAmount: 85.00, dateSubmitted: "2026-02-28", period: "February 2026", status: "approved", description: "GP consultation for food poisoning", remarks: "Approved. Within coverage limit.", attachments: [{ name: "gp_receipt.jpg", type: "image", url: "/attachments/gp_receipt.jpg", size: "170 KB" }] },
  { id: "MYC-007", claimType: "Transport", amount: 22.40, approvedAmount: 22.40, dateSubmitted: "2026-02-15", period: "February 2026", status: "disbursed", description: "Distance: 16 km (one way) x RM0.70 x 2 = RM22.40", remarks: "Disbursed on 22 Feb.", attachments: [{ name: "parking_feb.pdf", type: "pdf", url: "/attachments/parking_feb.pdf", size: "95 KB" }] },
  { id: "MYC-008", claimType: "Health Claim", amount: 150.00, approvedAmount: 150.00, dateSubmitted: "2026-01-30", period: "January 2026", status: "received", description: "Annual health screening package", remarks: "Full amount received.", attachments: [{ name: "health_screening.pdf", type: "pdf", url: "/attachments/health_screening.pdf", size: "512 KB" }] },
];

// --- ATTACHMENT VIEWER COMPONENT ---
const AttachmentViewer = ({ attachments }: { attachments?: Attachment[] }) => {
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attachments ({attachments.length})</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {attachments.map((file, i) => (
          <button
            key={i}
            onClick={() => setPreviewFile(previewFile?.name === file.name ? null : file)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left w-full ${
              previewFile?.name === file.name
                ? "bg-blue-50 border-blue-300 shadow-sm"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${
              file.type === "pdf" ? "bg-red-100" : "bg-blue-100"
            }`}>
              {file.type === "pdf" ? (
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-700 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{file.size}</p>
            </div>
            <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${previewFile?.name === file.name ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Preview panel */}
      {previewFile && (
        <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">{previewFile.name}</span>
                <span className="text-xs text-slate-400">{previewFile.size}</span>
              </div>
              <button onClick={() => setPreviewFile(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-slate-50/50 min-h-[200px]">
              {previewFile.type === "image" ? (
                <div className="relative w-full max-w-md">
                  <div className="bg-white rounded-xl shadow-md border border-slate-200 p-2 overflow-hidden">
                    <div className="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium text-slate-400">{previewFile.name}</p>
                        <p className="text-xs text-slate-300 mt-1">{previewFile.size} - Image</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <a href={previewFile.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open Image
                    </a>
                    <a href={previewFile.url} download={previewFile.name} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-20 h-24 bg-white rounded-lg shadow-md border border-slate-200 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">{previewFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{previewFile.size} - PDF Document</p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <a href={previewFile.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open PDF
                    </a>
                    <a href={previewFile.url} download={previewFile.name} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- PROGRESS BAR COMPONENT ---
interface ClaimProgressBarProps {
  status: StatusKey;
  resubmitCount?: number;
}

const ClaimProgressBar = ({ status, resubmitCount = 0 }: ClaimProgressBarProps) => {
  const hasRejection = status === "rejected" || resubmitCount > 0;

  let steps: { key: string; label: string; deadline: string; stepNum: number }[];

  if (hasRejection && status === "rejected") {
    steps = [
      { key: "pending", label: "Submitted", deadline: "2nd", stepNum: 1 },
      { key: "review", label: "Under Review", deadline: "12th", stepNum: 2 },
      { key: "rejected", label: "Rejected", deadline: "", stepNum: 3 },
      { key: "resubmit", label: "Resubmit", deadline: "14th", stepNum: 4 },
    ];
  } else if (resubmitCount > 0) {
    steps = [
      { key: "pending", label: "Submitted", deadline: "2nd", stepNum: 1 },
      { key: "rejected", label: "Rejected", deadline: "", stepNum: 2 },
      { key: "resubmit", label: "Resubmitted", deadline: "14th", stepNum: 3 },
      { key: "approved", label: "Approved", deadline: "17th", stepNum: 4 },
      { key: "disbursed", label: "Disbursed", deadline: "22nd", stepNum: 5 },
      { key: "received", label: "Received", deadline: "", stepNum: 6 },
    ];
  } else {
    steps = [
      { key: "pending", label: "Submitted", deadline: "2nd", stepNum: 1 },
      { key: "review", label: "Under Review", deadline: "12th", stepNum: 2 },
      { key: "approved", label: "Approved", deadline: "12th", stepNum: 3 },
      { key: "disbursed", label: "Disbursed", deadline: "22nd", stepNum: 4 },
      { key: "received", label: "Received", deadline: "", stepNum: 5 },
    ];
  }

  const statusOrder: StatusKey[] = ["pending", "approved", "disbursed", "received"];
  const currentIndex = statusOrder.indexOf(status);

  const getStepState = (stepKey: string): "completed" | "current" | "upcoming" | "rejected" => {
    if (stepKey === "rejected" && status === "rejected") return "rejected";
    if (stepKey === "rejected" && resubmitCount > 0) return "completed";
    if (stepKey === "resubmit" && resubmitCount > 0 && status !== "rejected") return "completed";
    if (stepKey === "resubmit" && status === "rejected") return "upcoming";
    if (stepKey === "review") {
      if (status === "pending") return "current";
      return currentIndex > 0 ? "completed" : "upcoming";
    }

    const stepIndex = statusOrder.indexOf(stepKey as StatusKey);
    if (stepIndex === -1) return "upcoming";
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  };

  return (
    <div className="w-full py-8 px-4">
      <div className="flex items-start justify-between relative">
        {steps.map((step, i) => {
          const state = getStepState(step.key);
          const nextState = i < steps.length - 1 ? getStepState(steps[i + 1].key) : "upcoming";
          const lineActive = state === "completed" || (state === "current" && (nextState === "current" || nextState === "completed"));

          return (
            <div key={step.key} className="flex flex-col items-center relative flex-1" style={{ zIndex: 1 }}>
              {/* Connector line to next step */}
              {i < steps.length - 1 && (
                <div className="absolute top-6 left-1/2 w-full h-1 z-0">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    lineActive ? "bg-blue-500" :
                    state === "rejected" ? "bg-red-300" : "bg-slate-200"
                  }`}></div>
                  {/* Arrow at end of line */}
                  <div className={`absolute -right-1 top-1/2 -translate-y-1/2 ${
                    lineActive ? "text-blue-500" :
                    state === "rejected" ? "text-red-300" : "text-slate-200"
                  }`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Step circle */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
                state === "completed"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                  : state === "current"
                  ? "bg-white border-[3px] border-blue-500 text-blue-600 shadow-xl shadow-blue-500/20 ring-4 ring-blue-100"
                  : state === "rejected"
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : "bg-slate-200 text-slate-400"
              }`}>
                {state === "completed" ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : state === "rejected" ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <span className="text-sm font-black">{step.stepNum}</span>
                )}
              </div>

              {/* Label */}
              <p className={`text-xs font-bold mt-3 text-center leading-tight ${
                state === "completed" ? "text-blue-600" :
                state === "current" ? "text-blue-700 font-black" :
                state === "rejected" ? "text-red-600" :
                "text-slate-400"
              }`}>{step.label}</p>

              {/* Deadline */}
              {step.deadline && (
                <p className={`text-[10px] mt-1 font-medium ${
                  state === "completed" || state === "current" ? "text-blue-400" :
                  state === "rejected" ? "text-red-400" : "text-slate-300"
                }`}>by {step.deadline}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- DEADLINE BANNER (Transparent, centered, matching status colors) ---
const DeadlineBanner = () => {
  const today = new Date();
  const currentDay = today.getDate();
  const monthName = today.toLocaleString("en-US", { month: "long", year: "numeric" });

  const deadlineDays = DEADLINES.map(d => d.day);
  const nextDeadlineIdx = deadlineDays.findIndex(d => d >= currentDay);
  const nextDeadlineDay = nextDeadlineIdx !== -1 ? deadlineDays[nextDeadlineIdx] : deadlineDays[0];
  const daysUntil = nextDeadlineDay >= currentDay ? nextDeadlineDay - currentDay : (30 - currentDay) + deadlineDays[0];

  return (
    <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-5 mb-6 overflow-hidden relative">
      <div className="relative">
        <div className="flex items-center justify-center flex-wrap gap-2 mb-4">
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Monthly Claim Cycle</h3>
          <span className="text-xs text-slate-400">-</span>
          <span className="text-sm font-bold text-slate-800">{monthName}</span>
          {daysUntil === 0 ? (
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">Deadline today!</span>
          ) : daysUntil <= 3 ? (
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">{daysUntil} day{daysUntil > 1 ? "s" : ""} left</span>
          ) : null}
        </div>

        {/* Centered deadline timeline */}
        <div className="flex items-center justify-center gap-0">
          {DEADLINES.map((d, i) => {
            const isPast = currentDay > d.day;
            const isCurrent = d.day === nextDeadlineDay && nextDeadlineDay >= currentDay;

            return (
              <div key={i} className="flex items-center">
                {i > 0 && (
                  <div className={`w-8 sm:w-12 lg:w-16 h-0.5 ${isPast ? "bg-blue-400" : "bg-slate-200"}`}>
                    <div className="relative w-full h-full">
                      <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent ${
                        isPast ? "border-l-[5px] border-l-blue-400" : "border-l-[5px] border-l-slate-200"
                      }`}></div>
                    </div>
                  </div>
                )}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isCurrent
                    ? `${d.bgColor} ${d.textColor} ${d.borderColor} shadow-md ring-2 ring-offset-1 ring-blue-200`
                    : isPast
                    ? "bg-slate-100 text-slate-400 border-slate-200"
                    : `${d.bgColor} ${d.textColor} ${d.borderColor}`
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isCurrent ? d.dotColor : isPast ? "bg-slate-300" : d.dotColor}`}></span>
                  <span>{d.date}</span>
                  <span className="hidden md:inline">- {d.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- EMPLOYEE CLAIM VIEW PAGE ---
interface EmployeeClaimViewProps {
  claim: EmployeeClaim;
  onBack: () => void;
}

const EmployeeClaimView = ({ claim, onBack }: EmployeeClaimViewProps) => {
  const claimTypeInfo = CLAIM_TYPES.find(ct => ct.title === claim.claimType || ct.id === claim.claimType);

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className={`relative p-8 text-white ${claimTypeInfo?.color || "bg-gradient-to-br from-slate-600 to-slate-800"}`}>
          <div className="absolute top-0 right-0 p-6 opacity-10 text-8xl pointer-events-none uppercase font-black">
            {claim.id}
          </div>
          <div className="relative flex items-center gap-5">
            <span className="text-4xl bg-white/20 backdrop-blur-md p-3 rounded-2xl shadow-inner">
              {claimTypeInfo?.icon || "📄"}
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{claim.claimType}</h2>
              <p className="text-white/70 font-medium text-sm">{claim.id} | {claim.period}</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-8 pt-4 pb-0 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0">Claim Progress</h3>
          <ClaimProgressBar status={claim.status} resubmitCount={claim.resubmitCount} />
        </div>

        {/* Claim Details */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Submitted</p>
              <p className="text-sm font-semibold text-slate-800">{claim.dateSubmitted}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${STATUSES.find(s => s.key === claim.status)!.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUSES.find(s => s.key === claim.status)!.dot}`}></span>
                {STATUSES.find(s => s.key === claim.status)!.label}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount Claimed</p>
              <p className="text-sm font-bold text-slate-800">{claim.amount > 0 ? `RM ${claim.amount.toFixed(2)}` : "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Amount</p>
              <p className={`text-sm font-bold ${claim.approvedAmount > 0 ? "text-green-600" : "text-slate-400"}`}>
                {claim.approvedAmount > 0 ? `RM ${claim.approvedAmount.toFixed(2)}` : "Pending"}
              </p>
            </div>
          </div>

          {claim.description && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4">{claim.description}</p>
            </div>
          )}

          {/* Attachments */}
          <AttachmentViewer attachments={claim.attachments} />

          {/* Finance Remarks */}
          {claim.remarks && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Finance Remarks</p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">{claim.remarks}</p>
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          {claim.rejectionReason && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Rejection Reason</p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700">{claim.rejectionReason}</p>
              </div>
            </div>
          )}

          {/* Resubmit button for rejected claims */}
          {claim.status === "rejected" && (
            <div className="pt-2">
              <button className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resubmit Claim
              </button>
              <p className="text-center text-xs text-slate-400 mt-2">Resubmission deadline: 14th of each month</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8">
          <button
            onClick={onBack}
            className="w-full py-3 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
          >
            Back to Claims
          </button>
        </div>
      </div>
    </div>
  );
};

// --- FINANCE CLAIM VIEW PAGE ---
interface FinanceClaimViewProps {
  claim: ClaimRecord;
  onBack: () => void;
  onUpdateClaim: (id: string, updates: Partial<ClaimRecord>) => void;
}

const FinanceClaimView = ({ claim, onBack, onUpdateClaim }: FinanceClaimViewProps) => {
  const [remarks, setRemarks] = useState(claim.remarks || "");
  const [approvedAmount, setApprovedAmount] = useState(claim.approvedAmount ?? claim.amount);
  const [showConfirm, setShowConfirm] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState(claim.rejectionReason || "");
  const [actionDone, setActionDone] = useState(false);

  const claimTypeInfo = CLAIM_TYPES.find(ct => ct.title === claim.claimType);
  const canTakeAction = claim.status === "pending";

  const handleApprove = () => {
    onUpdateClaim(claim.id, {
      status: "approved",
      approvedAmount,
      remarks,
    });
    setActionDone(true);
  };

  const handleReject = () => {
    onUpdateClaim(claim.id, {
      status: "rejected",
      rejectionReason,
      remarks,
    });
    setActionDone(true);
  };

  if (actionDone) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md w-full border border-gray-100 animate-in zoom-in duration-300">
          <div className={`w-24 h-24 ${showConfirm === "reject" ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"} rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-inner border ${showConfirm === "reject" ? "border-red-100" : "border-green-100"}`}>
            {showConfirm === "reject" ? "!" : "✓"}
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">
            {showConfirm === "reject" ? "Claim Rejected" : "Claim Approved"}
          </h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Claim <strong>{claim.id}</strong> by <strong>{claim.employeeName}</strong> has been {showConfirm === "reject" ? "rejected" : "approved"}.
          </p>
          <button
            onClick={onBack}
            className="w-full bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all active:scale-95"
          >
            Back to Claims
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className={`relative p-8 text-white ${claimTypeInfo?.color || "bg-gradient-to-br from-slate-600 to-slate-800"}`}>
          <div className="absolute top-0 right-0 p-6 opacity-10 text-8xl pointer-events-none uppercase font-black">
            {claim.id}
          </div>
          <div className="relative flex items-center gap-5">
            <span className="text-4xl bg-white/20 backdrop-blur-md p-3 rounded-2xl shadow-inner">
              {claimTypeInfo?.icon || "📄"}
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{claim.claimType}</h2>
              <p className="text-white/70 font-medium text-sm">{claim.id} | Finance Review</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-8 pt-4 pb-0 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0">Claim Progress</h3>
          <ClaimProgressBar status={claim.status} resubmitCount={claim.resubmitCount} />
        </div>

        {/* Employee & Claim Details */}
        <div className="p-8 space-y-6">
          {/* Employee Info */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
              {claim.employeeName.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <p className="font-bold text-slate-800">{claim.employeeName}</p>
              <p className="text-xs text-slate-500">{claim.branch}{claim.department ? ` - ${claim.department}` : ""}</p>
            </div>
            <span className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${STATUSES.find(s => s.key === claim.status)!.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUSES.find(s => s.key === claim.status)!.dot}`}></span>
              {STATUSES.find(s => s.key === claim.status)!.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Submitted</p>
              <p className="text-sm font-semibold text-slate-800">{claim.dateSubmitted}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Claim Type</p>
              <p className="text-sm font-semibold text-slate-800">{claim.claimType}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount Claimed</p>
              <p className="text-lg font-black text-slate-800">{claim.amount > 0 ? `RM ${claim.amount.toFixed(2)}` : "-"}</p>
            </div>
            {claim.approvedAmount !== undefined && claim.approvedAmount > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Amount</p>
                <p className="text-lg font-black text-green-600">RM {claim.approvedAmount.toFixed(2)}</p>
              </div>
            )}
          </div>

          {claim.description && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4">{claim.description}</p>
            </div>
          )}

          {/* Attachments */}
          <AttachmentViewer attachments={claim.attachments} />

          {/* Existing remarks (for already processed claims) */}
          {claim.remarks && !canTakeAction && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Finance Remarks</p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">{claim.remarks}</p>
              </div>
            </div>
          )}

          {claim.rejectionReason && !canTakeAction && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Rejection Reason</p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700">{claim.rejectionReason}</p>
              </div>
            </div>
          )}

          {/* Finance Action Section - only for pending claims */}
          {canTakeAction && !showConfirm && (
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Finance Action</h3>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">RM</span>
                  <input
                    type="number"
                    step="0.01"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(Number(e.target.value))}
                    className="w-full pl-14 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all font-bold text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Remarks / Notes</label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add your review notes here..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all resize-none text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirm("approve")}
                  className="flex-1 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
                <button
                  onClick={() => setShowConfirm("reject")}
                  className="flex-1 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Confirmation dialog */}
          {showConfirm && !actionDone && (
            <div className="border-t border-slate-200 pt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className={`p-6 rounded-2xl border-2 ${showConfirm === "approve" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <h4 className={`font-black text-lg mb-2 ${showConfirm === "approve" ? "text-green-800" : "text-red-800"}`}>
                  {showConfirm === "approve" ? "Confirm Approval" : "Confirm Rejection"}
                </h4>
                <p className={`text-sm mb-4 ${showConfirm === "approve" ? "text-green-700" : "text-red-700"}`}>
                  {showConfirm === "approve"
                    ? `You are approving RM ${approvedAmount.toFixed(2)} for ${claim.employeeName}.`
                    : `You are rejecting the claim from ${claim.employeeName}. Please provide a reason.`
                  }
                </p>

                {showConfirm === "reject" && (
                  <textarea
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reason for rejection (required)..."
                    className="w-full px-4 py-3 bg-white border border-red-200 rounded-xl focus:ring-4 focus:ring-red-500/10 focus:border-red-400 outline-none transition-all resize-none text-sm mb-4"
                  />
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(null)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={showConfirm === "approve" ? handleApprove : handleReject}
                    disabled={showConfirm === "reject" && !rejectionReason.trim()}
                    className={`flex-1 py-3 text-white rounded-xl font-bold text-sm transition-all ${
                      showConfirm === "approve"
                        ? "bg-green-600 hover:bg-green-700"
                        : rejectionReason.trim()
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-red-300 cursor-not-allowed"
                    }`}
                  >
                    {showConfirm === "approve" ? "Yes, Approve" : "Yes, Reject"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showConfirm && (
          <div className="px-8 pb-8">
            <button
              onClick={onBack}
              className="w-full py-3 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
            >
              Back to Claims
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- EMPLOYEE SIDE VIEW ---
interface EmployeeSideViewProps {
  onAddNew: () => void;
  onViewClaim: (claim: EmployeeClaim) => void;
}

const EmployeeSideView = ({ onAddNew, onViewClaim }: EmployeeSideViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [empStatusFilter, setEmpStatusFilter] = useState<StatusKey | "all">("all");
  const [monthFilter, setMonthFilter] = useState("");

  const availableMonths = Array.from(new Set(MOCK_EMPLOYEE_CLAIMS.map((c) => c.period))).sort((a, b) => {
    const toDate = (p: string) => new Date(p.split(" ").reverse().join("-") + "-01");
    return toDate(b).getTime() - toDate(a).getTime();
  });

  const filteredClaims = MOCK_EMPLOYEE_CLAIMS.filter((c) => {
    const matchesStatus = empStatusFilter === "all" || c.status === empStatusFilter;
    const matchesSearch = c.claimType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.period.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMonth = !monthFilter || c.period === monthFilter;
    return matchesStatus && matchesSearch && matchesMonth;
  });

  const getEmpCountByStatus = (status: StatusKey) => MOCK_EMPLOYEE_CLAIMS.filter((c) => c.status === status).length;
  const totalSubmitted = MOCK_EMPLOYEE_CLAIMS.length;

  const getStatusBadge = (status: StatusKey) => {
    const s = STATUSES.find((st) => st.key === status)!;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${s.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
        {s.label}
      </span>
    );
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Deadline Banner */}
      <DeadlineBanner />

      {/* Summary Cards Row - includes "Submitted" as total count card */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {/* Submitted total card */}
        <div className="rounded-2xl p-5 border bg-blue-50 border-blue-200 text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submitted</span>
          </div>
          <p className="text-3xl font-black text-blue-600">{totalSubmitted}</p>
        </div>
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setEmpStatusFilter(empStatusFilter === s.key ? "all" : s.key)}
            className={`rounded-2xl p-5 border transition-all text-left ${
              empStatusFilter === s.key
                ? `${s.headerBg} border-2 shadow-md scale-[1.02]`
                : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`}></span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className={`text-3xl font-black ${s.count}`}>{getEmpCountByStatus(s.key)}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by ID, type, period..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
            />
          </div>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all appearance-none cursor-pointer min-w-[160px]"
          >
            <option value="">All Months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onAddNew}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20 whitespace-nowrap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add New Claim
        </button>
      </div>

      {/* Filter indicator */}
      {(empStatusFilter !== "all" || monthFilter) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-slate-500">Filters:</span>
          {empStatusFilter !== "all" && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${STATUSES.find((s) => s.key === empStatusFilter)!.color}`}>
              {STATUSES.find((s) => s.key === empStatusFilter)!.label}
            </span>
          )}
          {monthFilter && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200">
              {monthFilter}
            </span>
          )}
          <button
            onClick={() => { setEmpStatusFilter("all"); setMonthFilter(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Claims Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Claim ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Submitted</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Approved Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <p className="text-slate-400 font-medium text-lg">No claims found</p>
                    <p className="text-slate-300 text-sm mt-1">Try adjusting your search or filter.</p>
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-blue-600">{claim.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700 font-medium">{claim.claimType}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{claim.period}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">{claim.dateSubmitted}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-800">
                        {claim.amount > 0 ? `RM ${claim.amount.toFixed(2)}` : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-800">
                        {claim.approvedAmount > 0 ? `RM ${claim.approvedAmount.toFixed(2)}` : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(claim.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          title="View"
                          onClick={() => onViewClaim(claim)}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="font-bold text-slate-700">{filteredClaims.length}</span> of <span className="font-bold text-slate-700">{MOCK_EMPLOYEE_CLAIMS.length}</span> claims
          </p>
          <p className="text-xs text-slate-400">
            {STATUSES.map(s => `${s.label} (${getEmpCountByStatus(s.key)})`).join(" | ")}
          </p>
        </div>
      </div>
    </div>
  );
};

// --- CLAIM FORM SUB-COMPONENT ---
interface ClaimFormProps {
  claim: { id: string; title: string; icon: string; color: string; hex: string };
  onBack: () => void;
}

const HEALTH_CLAIM_YEARLY_CAP = 500; // RM per year
const TRANSPORT_RATE_PER_KM = 0.70; // RM per km
const TRANSPORT_MULTIPLIER = 2; // round trip (to work + go home)

// Calculate how much health claim has been used this year (from employee claims data)
// In production, this would be an API call: GET /api/claims?type=health&year=2026&employeeId=xxx
const getHealthClaimUsedThisYear = (): number => {
  const currentYear = new Date().getFullYear();
  return MOCK_EMPLOYEE_CLAIMS
    .filter((c) =>
      c.claimType === "Health Claim" &&
      c.status !== "rejected" &&
      c.dateSubmitted.startsWith(String(currentYear))
    )
    .reduce((sum, c) => sum + c.amount, 0);
};

const ClaimForm = ({ claim, onBack }: ClaimFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [claimAmount, setClaimAmount] = useState("");
  const [transportDistance, setTransportDistance] = useState("");

  const isHealthClaim = claim.id === "health";
  const isTransportClaim = claim.id === "transport";

  // Health claim: track yearly usage
  const healthUsedThisYear = isHealthClaim ? getHealthClaimUsedThisYear() : 0;
  const healthRemaining = HEALTH_CLAIM_YEARLY_CAP - healthUsedThisYear;
  const healthWouldExceed = isHealthClaim && (healthUsedThisYear + Number(claimAmount || 0)) > HEALTH_CLAIM_YEARLY_CAP;

  // Transport auto-calculation
  const transportTotal = isTransportClaim
    ? Number(transportDistance || 0) * TRANSPORT_RATE_PER_KM * TRANSPORT_MULTIPLIER
    : 0;

  // Date restriction: current month or one month before only
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const minDate = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
  const lastDayCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const maxDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(lastDayCurrentMonth).padStart(2, "0")}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isHealthClaim && healthWouldExceed) return;
    if (isTransportClaim && Number(transportDistance) <= 0) return;
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md w-full border border-gray-100 animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-inner border border-green-100">
            ✓
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Success!</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Your <strong>{claim.title}</strong> has been submitted. Finance will review it by the <strong>12th</strong> of this month.
          </p>
          <button
            onClick={onBack}
            className="w-full bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
        <div className={`relative p-10 text-white ${claim.color}`}>
          <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl pointer-events-none uppercase font-black">
            {claim.id}
          </div>
          <div className="relative flex justify-between items-start">
            <div className="flex items-center gap-6">
              <span className="text-5xl bg-white/20 backdrop-blur-md p-4 rounded-2xl shadow-inner">{claim.icon}</span>
              <div>
                <h2 className="text-3xl font-black tracking-tight">{claim.title}</h2>
                <p className="text-white/80 font-medium">New Application</p>
              </div>
            </div>
            <button onClick={onBack} className="bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors text-white">
              ✕
            </button>
          </div>
        </div>

        <form className="p-10 space-y-8" onSubmit={handleSubmit}>
          {/* Transport: special distance-based form */}
          {isTransportClaim ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Claim Date</label>
                  <input required type="date" min={minDate} max={maxDate} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" />
                  <p className="text-[11px] text-slate-400 ml-1">Claim per day. Only current or previous month.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Distance (one way)</label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      step="0.1"
                      min="0"
                      value={transportDistance}
                      onChange={(e) => setTransportDistance(e.target.value)}
                      className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                      placeholder="0.0"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">KM</span>
                  </div>
                  <p className="text-[11px] text-slate-400 ml-1">Distance from home to workplace</p>
                </div>
              </div>

              {/* Transport calculation breakdown */}
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-black text-orange-700 uppercase tracking-wider">Calculation Breakdown</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-white rounded-xl border border-orange-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Distance</p>
                    <p className="text-lg font-black text-slate-700">{Number(transportDistance || 0).toFixed(1)} <span className="text-xs text-slate-400">km</span></p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-xl border border-orange-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Rate</p>
                    <p className="text-lg font-black text-slate-700">RM {TRANSPORT_RATE_PER_KM.toFixed(2)} <span className="text-xs text-slate-400">/km</span></p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-xl border border-orange-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Round Trip</p>
                    <p className="text-lg font-black text-slate-700">x {TRANSPORT_MULTIPLIER}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-orange-200">
                  <p className="text-xs text-orange-600 font-medium">
                    {Number(transportDistance || 0).toFixed(1)} km x RM {TRANSPORT_RATE_PER_KM.toFixed(2)} x {TRANSPORT_MULTIPLIER}
                  </p>
                  <p className="text-xl font-black text-orange-700">RM {transportTotal.toFixed(2)}</p>
                </div>
              </div>
            </>
          ) : (
            /* Non-transport: regular date + amount fields */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Claim Date</label>
                <input required type="date" min={minDate} max={maxDate} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" />
                <p className="text-[11px] text-slate-400 ml-1">Only current or previous month allowed</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Total Amount</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">RM</span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    max={isHealthClaim ? healthRemaining : undefined}
                    className={`w-full pl-14 pr-5 py-4 bg-slate-50 border rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 ${
                      healthWouldExceed ? "border-red-400 bg-red-50/50" : "border-slate-200"
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {isHealthClaim && (
                  <div className="ml-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] font-medium ${healthWouldExceed ? "text-red-500" : "text-slate-400"}`}>
                        {healthWouldExceed
                          ? "Exceeds yearly cap!"
                          : `RM${HEALTH_CLAIM_YEARLY_CAP}/year limit`
                        }
                      </p>
                      <p className="text-[11px] text-slate-400">
                        RM {Math.max(0, healthRemaining - Number(claimAmount || 0)).toFixed(2)} remaining
                      </p>
                    </div>
                    {/* Yearly usage progress bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          healthWouldExceed ? "bg-red-500" :
                          (healthUsedThisYear + Number(claimAmount || 0)) / HEALTH_CLAIM_YEARLY_CAP > 0.8 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, ((healthUsedThisYear + Number(claimAmount || 0)) / HEALTH_CLAIM_YEARLY_CAP) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Used this year: RM {healthUsedThisYear.toFixed(2)}
                      {Number(claimAmount) > 0 && (
                        <span className="text-slate-500 font-medium"> + RM {Number(claimAmount).toFixed(2)} = RM {(healthUsedThisYear + Number(claimAmount)).toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Description</label>
            <textarea required rows={3} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none" placeholder="Provide full context here..."></textarea>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Supporting Documents</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`group border-2 border-dashed rounded-[1.5rem] p-10 text-center transition-all cursor-pointer flex flex-col items-center
                ${selectedFile ? 'border-green-400 bg-green-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}
            >
              <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              {selectedFile ? (
                <div className="flex flex-col items-center">
                  <span className="text-3xl mb-2">📄</span>
                  <p className="text-green-700 font-bold">{selectedFile.name}</p>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-xs text-red-500 mt-2 font-bold hover:underline">Change File</button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-3xl mb-3 opacity-40 group-hover:scale-110 transition-transform">☁️</span>
                  <p className="text-slate-500 font-medium">Click to upload <span className="text-blue-600 font-bold">Receipt or MC</span></p>
                  <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-tighter">PDF, JPG or PNG (MAX 5MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Deadline reminder */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl">⏰</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Submission Deadline</p>
              <p className="text-xs text-amber-700">Claims must be submitted by the <strong>2nd</strong> of each month. Late submissions will be processed in the next cycle.</p>
            </div>
          </div>

          {isHealthClaim && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">🏥</span>
              <div>
                <p className="text-sm font-bold text-emerald-800">Health Claim Cap</p>
                <p className="text-xs text-emerald-700">Maximum <strong>RM {HEALTH_CLAIM_YEARLY_CAP}</strong> per year. You have used <strong>RM {healthUsedThisYear.toFixed(2)}</strong> so far in {currentYear}. Remaining: <strong>RM {healthRemaining.toFixed(2)}</strong>.</p>
              </div>
            </div>
          )}

          {isTransportClaim && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">🚗</span>
              <div>
                <p className="text-sm font-bold text-orange-800">Transport Claim</p>
                <p className="text-xs text-orange-700">Claimed per day. Formula: <strong>Distance (km) x RM {TRANSPORT_RATE_PER_KM.toFixed(2)} x {TRANSPORT_MULTIPLIER}</strong> (round trip). Submit one claim per working day.</p>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-6">
            <button type="button" onClick={onBack} className="px-8 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={
                (isHealthClaim && healthWouldExceed) ||
                (isTransportClaim && Number(transportDistance) <= 0)
              }
              className={`flex-1 py-4 ${claim.color} text-white rounded-2xl font-bold shadow-xl shadow-blue-900/10 transition-all ${
                (isHealthClaim && healthWouldExceed) ||
                (isTransportClaim && Number(transportDistance) <= 0)
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:brightness-110 active:scale-[0.98]"
              }`}
            >
              Submit Claim {isTransportClaim && transportTotal > 0 ? `- RM ${transportTotal.toFixed(2)}` : ""}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- CLAIM TYPE SELECTOR SUB-COMPONENT ---
interface ClaimTypeSelectorProps {
  onSelect: (claim: typeof CLAIM_TYPES[0]) => void;
  onBack?: () => void;
}

const ClaimTypeSelector = ({ onSelect }: ClaimTypeSelectorProps) => {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Select Claim Type</h2>
        <p className="text-slate-500 font-medium mt-1">Choose a category to submit your claim.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {CLAIM_TYPES.map((claim) => (
          <div
            key={claim.id}
            onClick={() => onSelect(claim)}
            className="cursor-pointer group relative"
          >
            <div className="h-full bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-900/5 hover:-translate-y-3 flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-2xl ${claim.color} flex items-center justify-center text-4xl shadow-lg mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                {claim.icon}
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{claim.title}</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">Process your {claim.id} reimbursements.</p>
              <div className="mt-auto flex items-center gap-2 text-blue-600 font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Create Request →
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- CLAIMS STATUS DASHBOARD (MAIN VIEW) ---
type PageView = "status" | "select-type" | "form" | "employee-view" | "employee-add" | "employee-claim-view" | "finance-claim-view";

export default function ClaimsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<PageView>("status");
  const [selectedClaim, setSelectedClaim] = useState<typeof CLAIM_TYPES[0] | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [subFilter, setSubFilter] = useState("");
  const [financeMonthFilter, setFinanceMonthFilter] = useState("");
  const [selectedEmployeeClaim, setSelectedEmployeeClaim] = useState<EmployeeClaim | null>(null);
  const [selectedFinanceClaim, setSelectedFinanceClaim] = useState<ClaimRecord | null>(null);
  const [claims, setClaims] = useState<ClaimRecord[]>(MOCK_CLAIMS);

  const financeAvailableMonths = Array.from(new Set(claims.map((c) => {
    const d = new Date(c.dateSubmitted);
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
  }))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const filteredClaims = claims.filter((claim) => {
    const matchesStatus = activeFilter === "all" || claim.status === activeFilter;
    const matchesSearch = claim.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.claimType.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesRegion = true;
    if (regionFilter) {
      if (regionFilter === "HQ") {
        matchesRegion = claim.branch === "HQ";
        if (subFilter) matchesRegion = matchesRegion && claim.department === subFilter;
      } else {
        const regionBranches = getBranchesForRegion(regionFilter);
        matchesRegion = regionBranches.includes(claim.branch);
        if (subFilter) matchesRegion = claim.branch === subFilter;
      }
    }

    let matchesMonth = true;
    if (financeMonthFilter) {
      const d = new Date(claim.dateSubmitted);
      const claimMonth = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      matchesMonth = claimMonth === financeMonthFilter;
    }

    return matchesStatus && matchesSearch && matchesRegion && matchesMonth;
  });

  const getStatusBadge = (status: StatusKey) => {
    const s = STATUSES.find((st) => st.key === status)!;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${s.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
        {s.label}
      </span>
    );
  };

  const getCountByStatus = (status: StatusKey) => claims.filter((c) => c.status === status).length;
  const totalSubmitted = claims.length;

  const handleSelectClaimType = (claim: typeof CLAIM_TYPES[0]) => {
    setSelectedClaim(claim);
    setView("form");
  };

  const handleBackToStatus = () => {
    setView("status");
    setSelectedClaim(null);
    setSelectedFinanceClaim(null);
  };

  const handleRegionChange = (value: string) => {
    setRegionFilter(value);
    setSubFilter("");
  };

  const handleViewFinanceClaim = (claim: ClaimRecord) => {
    setSelectedFinanceClaim(claim);
    setView("finance-claim-view");
  };

  const handleViewEmployeeClaim = (claim: EmployeeClaim) => {
    setSelectedEmployeeClaim(claim);
    setView("employee-claim-view");
  };

  const handleUpdateClaim = (id: string, updates: Partial<ClaimRecord>) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const selectedRegion = REGIONS.find((r) => r.value === regionFilter);
  const subOptions = regionFilter === "HQ"
    ? HQ_DEPARTMENTS
    : selectedRegion?.branches ? [...selectedRegion.branches] : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="relative flex justify-between items-center px-10 py-8">
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                if (view === "employee-claim-view") {
                  setView("employee-view");
                  setSelectedEmployeeClaim(null);
                } else if (view === "finance-claim-view") {
                  handleBackToStatus();
                } else if (view === "employee-view") {
                  handleBackToStatus();
                } else if (view === "employee-add") {
                  setView("employee-view");
                } else if (view === "select-type") {
                  handleBackToStatus();
                } else if (view === "form") {
                  setView("select-type");
                } else {
                  window.location.href = "/dashboards/hrms";
                }
              }}
              className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight uppercase">
                {view === "employee-view" || view === "employee-add"
                  ? <>Employee Claim <span className="text-blue-400">Status</span></>
                  : view === "employee-claim-view"
                  ? <>Claim <span className="text-blue-400">Details</span></>
                  : view === "finance-claim-view"
                  ? <>Claim <span className="text-blue-400">Review</span></>
                  : view === "select-type" || view === "form"
                  ? <>New <span className="text-blue-400">Claim</span></>
                  : <>Claims <span className="text-blue-400">Status</span></>
                }
              </h1>
              <p className="text-slate-400 font-medium text-sm tracking-widest mt-0.5">EBRIGHT HRMS</p>
            </div>
          </div>
          <UserHeader userName="Admin User" userEmail="admin@ebright.com" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen((p) => !p)} />

        <main className="flex-1 overflow-y-auto px-8 py-8 bg-[#F8FAFC]">
          <div className="mx-auto w-full max-w-7xl">

            {/* VIEW: Employee Claim View */}
            {view === "employee-claim-view" && selectedEmployeeClaim && (
              <EmployeeClaimView
                claim={selectedEmployeeClaim}
                onBack={() => { setView("employee-view"); setSelectedEmployeeClaim(null); }}
              />
            )}

            {/* VIEW: Finance Claim View */}
            {view === "finance-claim-view" && selectedFinanceClaim && (
              <FinanceClaimView
                claim={selectedFinanceClaim}
                onBack={handleBackToStatus}
                onUpdateClaim={handleUpdateClaim}
              />
            )}

            {/* VIEW: Claim Form */}
            {view === "form" && selectedClaim && (
              <ClaimForm claim={selectedClaim} onBack={handleBackToStatus} />
            )}

            {/* VIEW: Select Claim Type (admin) */}
            {view === "select-type" && (
              <ClaimTypeSelector onSelect={handleSelectClaimType} onBack={handleBackToStatus} />
            )}

            {/* VIEW: Employee Side */}
            {view === "employee-view" && (
              <EmployeeSideView
                onAddNew={() => setView("employee-add")}
                onViewClaim={handleViewEmployeeClaim}
              />
            )}

            {/* VIEW: Employee Add New */}
            {view === "employee-add" && (
              <ClaimTypeSelector
                onSelect={(claim) => { setSelectedClaim(claim); setView("form"); }}
                onBack={() => setView("employee-view")}
              />
            )}

            {/* VIEW: Claims Status Dashboard (Finance) */}
            {view === "status" && (
              <div className="animate-in fade-in duration-500">

                {/* Deadline Banner */}
                <DeadlineBanner />

                {/* Summary Cards Row - includes "Submitted" as total count */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                  {/* Submitted total card (non-clickable) */}
                  <div className="rounded-2xl p-5 border bg-blue-50 border-blue-200 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submitted</span>
                    </div>
                    <p className="text-3xl font-black text-blue-600">{totalSubmitted}</p>
                  </div>
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setActiveFilter(activeFilter === s.key ? "all" : s.key)}
                      className={`rounded-2xl p-5 border transition-all text-left ${
                        activeFilter === s.key
                          ? `${s.headerBg} border-2 shadow-md scale-[1.02]`
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`}></span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</span>
                      </div>
                      <p className={`text-3xl font-black ${s.count}`}>{getCountByStatus(s.key)}</p>
                    </button>
                  ))}
                </div>

                {/* Toolbar */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-72">
                      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search by name, ID, or type..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                      />
                    </div>

                    <select
                      value={regionFilter}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all appearance-none cursor-pointer min-w-[150px]"
                    >
                      <option value="">All Regions</option>
                      {REGIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>

                    {regionFilter && subOptions.length > 0 && (
                      <select
                        value={subFilter}
                        onChange={(e) => setSubFilter(e.target.value)}
                        className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all appearance-none cursor-pointer min-w-[180px] animate-in fade-in slide-in-from-left-4 duration-300"
                      >
                        <option value="">{regionFilter === "HQ" ? "All Departments" : "All Branches"}</option>
                        {subOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}

                    <select
                      value={financeMonthFilter}
                      onChange={(e) => setFinanceMonthFilter(e.target.value)}
                      className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all appearance-none cursor-pointer min-w-[160px]"
                    >
                      <option value="">All Months</option>
                      {financeAvailableMonths.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setView("employee-view")}
                      className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 whitespace-nowrap"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Employee Side
                    </button>
                    <button
                      onClick={() => setView("select-type")}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20 whitespace-nowrap"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add New Claim
                    </button>
                  </div>
                </div>

                {/* Filter indicator */}
                {(activeFilter !== "all" || regionFilter || subFilter || financeMonthFilter) && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="text-sm text-slate-500">Filters:</span>
                    {activeFilter !== "all" && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${STATUSES.find((s) => s.key === activeFilter)!.color}`}>
                        {STATUSES.find((s) => s.key === activeFilter)!.label}
                      </span>
                    )}
                    {regionFilter && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200">
                        {REGIONS.find((r) => r.value === regionFilter)?.label}
                      </span>
                    )}
                    {subFilter && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-purple-100 text-purple-700 border-purple-200">
                        {regionFilter === "HQ" ? "Dept" : "Branch"}: {subOptions.find((o) => o.value === subFilter)?.label}
                      </span>
                    )}
                    {financeMonthFilter && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200">
                        {financeMonthFilter}
                      </span>
                    )}
                    <button
                      onClick={() => { setActiveFilter("all"); setRegionFilter(""); setSubFilter(""); setFinanceMonthFilter(""); }}
                      className="text-xs text-slate-400 hover:text-slate-600 underline ml-1"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {/* Claims Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Claim ID</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Submitted</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredClaims.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-16 text-center">
                              <p className="text-slate-400 font-medium text-lg">No claims found</p>
                              <p className="text-slate-300 text-sm mt-1">Try adjusting your search or filter.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredClaims.map((claim) => (
                            <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="text-sm font-bold text-blue-600">{claim.id}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                    {claim.employeeName.split(" ").map((n) => n[0]).join("")}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-800">{claim.employeeName}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-600 font-medium">{claim.branch}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-700 font-medium">{claim.claimType}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm font-bold text-slate-800">
                                  {claim.amount > 0 ? `RM ${claim.amount.toFixed(2)}` : "-"}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-500">{claim.dateSubmitted}</span>
                              </td>
                              <td className="px-6 py-4">
                                {getStatusBadge(claim.status)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    title="View & Review"
                                    onClick={() => handleViewFinanceClaim(claim)}
                                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      Showing <span className="font-bold text-slate-700">{filteredClaims.length}</span> of <span className="font-bold text-slate-700">{claims.length}</span> claims
                    </p>
                    <p className="text-xs text-slate-400">
                      {STATUSES.map(s => `${s.label} (${getCountByStatus(s.key)})`).join(" | ")}
                    </p>
                  </div>
                </div>

              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
