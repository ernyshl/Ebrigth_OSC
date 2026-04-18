"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const separationData = [
  { name: "Resigned", value: 85 },
  { name: "Terminated", value: 32 },
  { name: "Contract End", value: 45 },
  { name: "Retired", value: 18 },
  { name: "Mutual Separation", value: 22 },
];

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#6366f1", "#8b5cf6"];

interface OffboardingRecord {
  no: number;
  employeeName: string;
  position: string;
  branch: string;
  lastDate: string;
  separationType: string;
  exitInterview: boolean;
  knowledgeTransfer: boolean;
  assetReturn: boolean;
  systemRevocation: boolean;
  finalSettlement: boolean;
}

const offboardingData: OffboardingRecord[] = [
  { no: 1, employeeName: "Lim Chee Keong", position: "Senior Executive", branch: "CEL-Hos", lastDate: "2026-01-31", separationType: "Resigned", exitInterview: true, knowledgeTransfer: true, assetReturn: true, systemRevocation: true, finalSettlement: true },
  { no: 2, employeeName: "Farah Diyana", position: "Executive", branch: "Marker Lane", lastDate: "2026-02-15", separationType: "Contract End", exitInterview: true, knowledgeTransfer: true, assetReturn: true, systemRevocation: true, finalSettlement: false },
  { no: 3, employeeName: "Wong Kah Yee", position: "Manager", branch: "Nod Fi", lastDate: "2026-02-28", separationType: "Resigned", exitInterview: true, knowledgeTransfer: true, assetReturn: false, systemRevocation: false, finalSettlement: false },
  { no: 4, employeeName: "Amirul Hakim", position: "Technician", branch: "CEL-KK", lastDate: "2026-03-01", separationType: "Terminated", exitInterview: true, knowledgeTransfer: false, assetReturn: false, systemRevocation: false, finalSettlement: false },
  { no: 5, employeeName: "Priya Devi", position: "Analyst", branch: "Tullstory", lastDate: "2026-03-10", separationType: "Retired", exitInterview: true, knowledgeTransfer: true, assetReturn: true, systemRevocation: true, finalSettlement: true },
  { no: 6, employeeName: "Zulkifli Bin Ahmad", position: "Executive", branch: "CEL-Hos", lastDate: "2026-03-15", separationType: "Mutual Separation", exitInterview: false, knowledgeTransfer: false, assetReturn: false, systemRevocation: false, finalSettlement: false },
  { no: 7, employeeName: "Chen Mei Hua", position: "HR Officer", branch: "Marker Lane", lastDate: "2026-03-20", separationType: "Resigned", exitInterview: true, knowledgeTransfer: true, assetReturn: true, systemRevocation: false, finalSettlement: false },
  { no: 8, employeeName: "Balqis Irdina", position: "Executive", branch: "Nod Fi", lastDate: "2026-03-25", separationType: "Contract End", exitInterview: true, knowledgeTransfer: false, assetReturn: false, systemRevocation: false, finalSettlement: false },
];

function StatusBadge({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">✓</span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-400">✗</span>
  );
}

function SeparationBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Resigned: "bg-red-100 text-red-700",
    Terminated: "bg-orange-100 text-orange-700",
    "Contract End": "bg-yellow-100 text-yellow-700",
    Retired: "bg-indigo-100 text-indigo-700",
    "Mutual Separation": "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[type] || "bg-slate-100 text-slate-700"}`}>
      {type}
    </span>
  );
}

export default function OffboardingPage() {
  const [filter, setFilter] = useState("all");

  const filteredData =
    filter === "all"
      ? offboardingData
      : offboardingData.filter((r) => r.branch === filter);

  const branches = [...new Set(offboardingData.map((r) => r.branch))];
  const totalSeparations = separationData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboards/hrms"
          className="text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← Back to HRMS
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
        <div className="bg-red-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md">
          <span className="text-xl">🔴</span>
          <h1 className="text-lg font-black uppercase tracking-wide m-0 leading-none">
            Offboarding Dashboard
          </h1>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500 uppercase tracking-wide">Total Separations</p>
          <p className="text-4xl font-black text-red-600 mt-1">{totalSeparations}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500 uppercase tracking-wide">Most Common</p>
          <p className="text-4xl font-black text-orange-500 mt-1">Resigned</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500 uppercase tracking-wide">Pending Clearance</p>
          <p className="text-4xl font-black text-amber-500 mt-1">
            {offboardingData.filter((r) => !r.finalSettlement).length}
          </p>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Separation by Type</h2>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={separationData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={130}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
            >
              {separationData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Offboarding Checklist Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Offboarding Checklist</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-2 text-slate-600 font-semibold">No</th>
                <th className="text-left py-3 px-2 text-slate-600 font-semibold">Employee Name</th>
                <th className="text-left py-3 px-2 text-slate-600 font-semibold">Position</th>
                <th className="text-left py-3 px-2 text-slate-600 font-semibold">Branch</th>
                <th className="text-left py-3 px-2 text-slate-600 font-semibold">Last Date</th>
                <th className="text-left py-3 px-2 text-slate-600 font-semibold">Type</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">Exit Interview</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">Knowledge Transfer</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">Asset Return</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">System Revocation</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">Final Settlement</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row.no} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-2 text-slate-700">{row.no}</td>
                  <td className="py-3 px-2 text-slate-800 font-medium">{row.employeeName}</td>
                  <td className="py-3 px-2 text-slate-600">{row.position}</td>
                  <td className="py-3 px-2 text-slate-600">{row.branch}</td>
                  <td className="py-3 px-2 text-slate-600">{row.lastDate}</td>
                  <td className="py-3 px-2"><SeparationBadge type={row.separationType} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.exitInterview} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.knowledgeTransfer} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.assetReturn} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.systemRevocation} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.finalSettlement} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
