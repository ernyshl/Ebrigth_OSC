"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const branchData = [
  { branch: "Marker Lane", count: 15 },
  { branch: "Nod Fi", count: 12 },
  { branch: "Tullstory", count: 9 },
  { branch: "CEL-Hos", count: 18 },
  { branch: "CEL-KK", count: 7 },
];

const BAR_COLORS = ["#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b"];

interface OnboardingRecord {
  no: number;
  employeeName: string;
  position: string;
  branch: string;
  startDate: string;
  documentSubmission: boolean;
  systemAccess: boolean;
  orientation: boolean;
  trainingPlan: boolean;
  probationReview: boolean;
}

const onboardingData: OnboardingRecord[] = [
  { no: 1, employeeName: "Ahmad Faiz", position: "Executive", branch: "CEL-Hos", startDate: "2026-01-15", documentSubmission: true, systemAccess: true, orientation: true, trainingPlan: true, probationReview: false },
  { no: 2, employeeName: "Siti Nurhaliza", position: "Senior Executive", branch: "Marker Lane", startDate: "2026-01-20", documentSubmission: true, systemAccess: true, orientation: true, trainingPlan: false, probationReview: false },
  { no: 3, employeeName: "Muhammad Iqbal", position: "Manager", branch: "Nod Fi", startDate: "2026-02-01", documentSubmission: true, systemAccess: true, orientation: false, trainingPlan: false, probationReview: false },
  { no: 4, employeeName: "Nurul Aisyah", position: "Executive", branch: "CEL-KK", startDate: "2026-02-10", documentSubmission: true, systemAccess: false, orientation: false, trainingPlan: false, probationReview: false },
  { no: 5, employeeName: "Tan Wei Ming", position: "Analyst", branch: "Tullstory", startDate: "2026-02-15", documentSubmission: true, systemAccess: true, orientation: true, trainingPlan: true, probationReview: true },
  { no: 6, employeeName: "Raj Kumar", position: "Executive", branch: "CEL-Hos", startDate: "2026-03-01", documentSubmission: true, systemAccess: true, orientation: false, trainingPlan: false, probationReview: false },
  { no: 7, employeeName: "Lee Siew Ling", position: "HR Officer", branch: "Marker Lane", startDate: "2026-03-05", documentSubmission: true, systemAccess: false, orientation: false, trainingPlan: false, probationReview: false },
  { no: 8, employeeName: "Mohd Hafiz", position: "Technician", branch: "Nod Fi", startDate: "2026-03-10", documentSubmission: false, systemAccess: false, orientation: false, trainingPlan: false, probationReview: false },
];

function StatusBadge({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">✓</span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-400">✗</span>
  );
}

export default function OnboardingPage() {
  const [filter, setFilter] = useState("all");

  const filteredData =
    filter === "all"
      ? onboardingData
      : onboardingData.filter((r) => r.branch === filter);

  const branches = [...new Set(onboardingData.map((r) => r.branch))];

  const totalNew = branchData.reduce((s, b) => s + b.count, 0);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboards/hrms"
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Back to HRMS
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
        <div className="bg-green-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md">
          <span className="text-xl">🟢</span>
          <h1 className="text-lg font-black uppercase tracking-wide m-0 leading-none">
            Onboarding Dashboard
          </h1>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500 uppercase tracking-wide">Total New Hires</p>
          <p className="text-4xl font-black text-green-600 mt-1">{totalNew}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500 uppercase tracking-wide">Branches</p>
          <p className="text-4xl font-black text-blue-600 mt-1">{branchData.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500 uppercase tracking-wide">Pending Checklist</p>
          <p className="text-4xl font-black text-amber-500 mt-1">
            {onboardingData.filter((r) => !r.probationReview).length}
          </p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">New Hires by Branch</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={branchData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="branch" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={50}>
              {branchData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Onboarding Checklist Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Onboarding Checklist</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                <th className="text-left py-3 px-2 text-slate-600 font-semibold">Start Date</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">Document Submission</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">System Access</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">Orientation</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">Training Plan</th>
                <th className="text-center py-3 px-2 text-slate-600 font-semibold">Probation Review</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row.no} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-2 text-slate-700">{row.no}</td>
                  <td className="py-3 px-2 text-slate-800 font-medium">{row.employeeName}</td>
                  <td className="py-3 px-2 text-slate-600">{row.position}</td>
                  <td className="py-3 px-2 text-slate-600">{row.branch}</td>
                  <td className="py-3 px-2 text-slate-600">{row.startDate}</td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.documentSubmission} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.systemAccess} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.orientation} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.trainingPlan} /></td>
                  <td className="py-3 px-2 text-center"><StatusBadge done={row.probationReview} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
