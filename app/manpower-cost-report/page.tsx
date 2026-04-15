"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/app/components/Sidebar";
import UserHeader from "@/app/components/UserHeader";
import Link from "next/link";

// --- HELPERS ---
const fmtHrs = (h: number): string => {
  if (h === 0) return "-";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
};

// --- BRANCHES BY REGION (for filters) ---
const REGIONS = [
  {
    value: "region-a", label: "Region A",
    branches: ["Rimbayu", "Klang", "Shah Alam", "Setia Alam", "Denai Alam", "Eco Grandeur", "Subang Taipan"],
  },
  {
    value: "region-b", label: "Region B",
    branches: ["Danau Kota", "Kota Damansara", "Ampang", "Sri Petaling", "Bandar Tun Hussein Onn", "Kajang TTDI Groove", "Taman Sri Gombak"],
  },
  {
    value: "region-c", label: "Region C",
    branches: ["Putrajaya", "Kota Warisan", "Bandar Baru Bangi", "Cyberjaya", "Bandar Seri Putra", "Dataran Puchong Utama", "Online"],
  },
];

// --- TYPES ---
interface StaffEntry {
  name: string;
  branch: string;
  employeeId: string | null;
  rate: number | null;
  employmentType: string | null;
  position: string | null;
  isPT: boolean;
  coachHrs: number;
  execHrs: number;
  totalHrs: number;
  coachPay: number;
  execPay: number;
  totalPay: number;
  days: { date: string; day: string; coachHrs: number; execHrs: number; totalHrs: number }[];
}

interface Totals {
  totalStaff: number;
  ptCount: number;
  ftCount: number;
  totalCoachHrs: number;
  totalExecHrs: number;
  totalHrs: number;
  totalCoachPay: number;
  totalExecPay: number;
  totalPay: number;
  executiveRate: number;
}

interface ApiResponse {
  success: boolean;
  month: string;
  totals: Totals;
  staff: StaffEntry[];
}

// --- AVAILABLE MONTHS (generate last 6 months) ---
const getAvailableMonths = () => {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  const startMonth = new Date(2026, 3, 1); // April 2026 — first month with clean schedule data
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d >= startMonth; d.setMonth(d.getMonth() - 1)) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    months.push({ value, label });
  }
  return months;
};

const AVAILABLE_MONTHS = getAvailableMonths();

// --- PAGE ---
type ViewTab = "all" | "pt" | "ft";

export default function ManpowerCostReportPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(AVAILABLE_MONTHS[0].value);
  const [regionFilter, setRegionFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [viewTab, setViewTab] = useState<ViewTab>("all");
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const selectedRegion = REGIONS.find((r) => r.value === regionFilter);
  const branchOptions = selectedRegion ? selectedRegion.branches : [];

  const handleRegionChange = (value: string) => {
    setRegionFilter(value);
    setBranchFilter("");
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/manpower-cost?month=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      setError("Failed to load manpower cost data. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter staff by region/branch and view tab
  const filteredStaff = (data?.staff || []).filter((s) => {
    // Branch/region filter
    if (branchFilter && s.branch !== branchFilter) return false;
    if (regionFilter && !branchFilter) {
      const region = REGIONS.find((r) => r.value === regionFilter);
      if (region && !region.branches.includes(s.branch)) return false;
    }
    // Tab filter
    if (viewTab === "pt" && !s.isPT) return false;
    if (viewTab === "ft" && s.isPT) return false;
    return true;
  });

  // Recalculate totals for filtered view
  const filteredTotals = {
    totalStaff: filteredStaff.length,
    ptCount: filteredStaff.filter((s) => s.isPT).length,
    ftCount: filteredStaff.filter((s) => !s.isPT).length,
    totalCoachHrs: filteredStaff.reduce((s, r) => s + r.coachHrs, 0),
    totalExecHrs: filteredStaff.reduce((s, r) => s + r.execHrs, 0),
    totalHrs: filteredStaff.reduce((s, r) => s + r.totalHrs, 0),
    totalCoachPay: filteredStaff.filter((s) => s.isPT).reduce((s, r) => s + r.coachPay, 0),
    totalExecPay: filteredStaff.filter((s) => s.isPT).reduce((s, r) => s + r.execPay, 0),
    totalPay: filteredStaff.filter((s) => s.isPT).reduce((s, r) => s + r.totalPay, 0),
  };

  const monthLabel = AVAILABLE_MONTHS.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="relative flex justify-between items-center px-10 py-8">
          <div className="flex items-center gap-6">
            <Link href="/dashboards/hrms" className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight uppercase">
                Manpower <span className="text-green-400">Cost Report</span>
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
          <div className="mx-auto w-full max-w-7xl animate-in fade-in duration-500">

            {/* Toolbar: Tabs + Filters */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
              {/* Left: Tab toggle */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {([
                  { key: "all" as ViewTab, label: "All Staff" },
                  { key: "pt" as ViewTab, label: "Part-Time" },
                  { key: "ft" as ViewTab, label: "Full-Time" },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setViewTab(tab.key)}
                    className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      viewTab === tab.key
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Right: Filters */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all appearance-none cursor-pointer min-w-[160px]"
                >
                  {AVAILABLE_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

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

                {regionFilter && branchOptions.length > 0 && (
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all appearance-none cursor-pointer min-w-[180px] animate-in fade-in slide-in-from-left-4 duration-300"
                  >
                    <option value="">All Branches</option>
                    {branchOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Loading / Error */}
            {loading && (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-500 font-medium">Loading manpower cost data...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                <p className="text-red-600 font-medium">{error}</p>
                <button onClick={fetchData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && data && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  <div className="rounded-2xl p-4 bg-white border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Staff</p>
                    <p className="text-2xl font-black text-slate-700">{filteredTotals.totalStaff}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">PT: {filteredTotals.ptCount} | FT: {filteredTotals.ftCount}</p>
                  </div>
                  <div className="rounded-2xl p-4 bg-white border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Hours</p>
                    <p className="text-xl font-black text-blue-600">{fmtHrs(filteredTotals.totalHrs)}</p>
                  </div>
                  <div className="rounded-2xl p-4 bg-orange-50 border border-orange-200">
                    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Coach Hours</p>
                    <p className="text-xl font-black text-orange-600">{fmtHrs(filteredTotals.totalCoachHrs)}</p>
                  </div>
                  <div className="rounded-2xl p-4 bg-indigo-50 border border-indigo-200">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Exec Hours</p>
                    <p className="text-xl font-black text-indigo-600">{fmtHrs(filteredTotals.totalExecHrs)}</p>
                  </div>
                  <div className="rounded-2xl p-4 bg-green-50 border border-green-200">
                    <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1">PT Cost</p>
                    <p className="text-xl font-black text-green-600">RM {filteredTotals.totalPay.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="rounded-2xl p-4 bg-white border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Avg / PT</p>
                    <p className="text-xl font-black text-slate-600">
                      RM {filteredTotals.ptCount > 0 ? (filteredTotals.totalPay / filteredTotals.ptCount).toFixed(0) : "0"}
                    </p>
                  </div>
                </div>

                {/* Rate Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 mb-6 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-slate-500">
                    <span className="font-bold text-slate-700">Exec Rate:</span> RM {data.totals.executiveRate}/hr (fixed)
                    <span className="mx-3 text-slate-300">|</span>
                    <span className="font-bold text-slate-700">Coach Rate:</span> per employee profile (PT only)
                    <span className="mx-3 text-slate-300">|</span>
                    <span className="font-bold text-slate-700">Period:</span> {monthLabel}
                    <span className="mx-3 text-slate-300">|</span>
                    <span className="font-bold text-slate-700">FT:</span> hours only (fixed salary)
                  </p>
                </div>

                {/* Staff Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                          <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</th>
                          <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Type</th>
                          <th className="px-5 py-4 text-xs font-bold text-orange-500 uppercase tracking-wider text-center">Coach Hrs</th>
                          <th className="px-5 py-4 text-xs font-bold text-indigo-500 uppercase tracking-wider text-center">Exec Hrs</th>
                          <th className="px-5 py-4 text-xs font-bold text-blue-500 uppercase tracking-wider text-center">Total Hrs</th>
                          {viewTab !== "ft" && (
                            <>
                              <th className="px-5 py-4 text-xs font-bold text-orange-500 uppercase tracking-wider text-center">Rate</th>
                              <th className="px-5 py-4 text-xs font-bold text-green-600 uppercase tracking-wider text-right">Total Pay</th>
                            </>
                          )}
                          <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStaff.length === 0 ? (
                          <tr>
                            <td colSpan={viewTab !== "ft" ? 9 : 7} className="px-5 py-12 text-center">
                              <p className="text-slate-400 font-medium">No staff data found for {monthLabel}.</p>
                              <p className="text-slate-300 text-sm mt-1">Make sure schedules are finalized for this month.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredStaff.map((s) => {
                            const isExpanded = expandedCoach === `${s.name}:::${s.branch}`;
                            return (
                              <React.Fragment key={`${s.name}:::${s.branch}`}>
                                <tr className={`hover:bg-slate-50/50 transition-colors ${isExpanded ? "bg-blue-50/30" : ""}`}>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                        {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-slate-800">{s.name}</p>
                                        <p className="text-[10px] text-slate-400">{s.employeeId || "-"}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 text-sm text-slate-600 font-medium">{s.branch}</td>
                                  <td className="px-5 py-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      s.isPT
                                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                                        : "bg-blue-100 text-blue-700 border border-blue-200"
                                    }`}>
                                      {s.isPT ? "PT" : "FT"}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 text-center text-sm font-bold text-orange-600">{fmtHrs(s.coachHrs)}</td>
                                  <td className="px-5 py-4 text-center text-sm font-bold text-indigo-600">{fmtHrs(s.execHrs)}</td>
                                  <td className="px-5 py-4 text-center text-sm font-black text-blue-600">{fmtHrs(s.totalHrs)}</td>
                                  {viewTab !== "ft" && (
                                    <>
                                      <td className="px-5 py-4 text-center text-sm text-slate-500">
                                        {s.isPT && s.rate ? `RM${s.rate}` : "-"}
                                      </td>
                                      <td className="px-5 py-4 text-right text-sm font-black text-green-600">
                                        {s.isPT ? `RM ${s.totalPay.toFixed(2)}` : "-"}
                                      </td>
                                    </>
                                  )}
                                  <td className="px-5 py-4 text-center">
                                    {s.days.length > 0 && (
                                      <button
                                        onClick={() => setExpandedCoach(isExpanded ? null : `${s.name}:::${s.branch}`)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                      >
                                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                    )}
                                  </td>
                                </tr>

                                {/* Inline daily breakdown - full month 1st to 30/31st */}
                                {isExpanded && (() => {
                                  const [yr, mn] = selectedMonth.split("-").map(Number);
                                  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                                  const numDays = new Date(yr, mn, 0).getDate();
                                  const allDaysInMonth = Array.from({ length: numDays }, (_, i) => {
                                    const d = i + 1;
                                    const dateStr = `${yr}-${String(mn).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                                    const dayName = daysOfWeek[new Date(yr, mn - 1, d).getDay()];
                                    return { dayNum: d, date: dateStr, day: dayName };
                                  });
                                  // Build lookup of worked days
                                  const workedMap: Record<string, { coachHrs: number; execHrs: number; totalHrs: number }> = {};
                                  s.days.forEach((d) => { workedMap[d.date] = d; });
                                  const execRate = data?.totals.executiveRate || 10;

                                  return (
                                    <tr>
                                      <td colSpan={viewTab !== "ft" ? 9 : 7} className="p-0">
                                        <div className="bg-slate-50 border-y border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
                                          <div className="px-5 py-3 flex items-center justify-between bg-slate-100 border-b border-slate-200">
                                            <p className="text-sm font-bold text-slate-700">
                                              Daily Breakdown: <span className="text-blue-600">{s.name}</span>
                                              <span className="text-slate-400 font-normal ml-2">
                                                ({s.branch}{s.isPT && s.rate ? ` | Coach RM${s.rate}/hr, Exec RM${execRate}/hr` : ""})
                                              </span>
                                            </p>
                                            <p className="text-xs text-slate-500 font-medium">{s.days.length} day{s.days.length !== 1 ? "s" : ""} worked</p>
                                          </div>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                              <thead>
                                                <tr className="text-xs font-bold uppercase tracking-wider bg-slate-50">
                                                  <th className="px-4 py-2 text-slate-400 w-12">No.</th>
                                                  <th className="px-4 py-2 text-slate-400">Day</th>
                                                  <th className="px-4 py-2 text-slate-400">Date</th>
                                                  <th className="px-4 py-2 text-orange-400 text-center">Coach Hr</th>
                                                  <th className="px-4 py-2 text-indigo-400 text-center">Exec Hr</th>
                                                  <th className="px-4 py-2 text-blue-400 text-center">Total Hr</th>
                                                  {s.isPT && <th className="px-4 py-2 text-green-500 text-right">Pay (RM)</th>}
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                {allDaysInMonth.map((row) => {
                                                  const entry = workedMap[row.date];
                                                  const isWeekend = row.day === "Saturday" || row.day === "Sunday";
                                                  const worked = !!entry;
                                                  const dayPay = worked && s.isPT ? ((entry.coachHrs * (s.rate || 0)) + (entry.execHrs * execRate)) : 0;

                                                  return (
                                                    <tr key={row.date} className={`transition-colors ${
                                                      !worked ? "bg-slate-50/50 text-slate-300" :
                                                      isWeekend ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-slate-50/50"
                                                    }`}>
                                                      <td className="px-4 py-1.5 text-xs font-medium text-slate-400">{row.dayNum}</td>
                                                      <td className="px-4 py-1.5">
                                                        <span className={`text-xs font-bold ${!worked ? "text-slate-300" : isWeekend ? "text-blue-600" : "text-slate-600"}`}>
                                                          {row.day.slice(0, 3)}
                                                        </span>
                                                      </td>
                                                      <td className="px-4 py-1.5 text-xs text-slate-500">{row.date}</td>
                                                      <td className="px-4 py-1.5 text-center text-xs font-bold">
                                                        <span className={worked ? "text-orange-600" : "text-slate-300"}>{worked ? fmtHrs(entry.coachHrs) : "-"}</span>
                                                      </td>
                                                      <td className="px-4 py-1.5 text-center text-xs font-bold">
                                                        <span className={worked ? "text-indigo-600" : "text-slate-300"}>{worked ? fmtHrs(entry.execHrs) : "-"}</span>
                                                      </td>
                                                      <td className="px-4 py-1.5 text-center text-xs font-black">
                                                        <span className={worked ? "text-blue-600" : "text-slate-300"}>{worked ? fmtHrs(entry.totalHrs) : "-"}</span>
                                                      </td>
                                                      {s.isPT && (
                                                        <td className="px-4 py-1.5 text-right text-xs font-black">
                                                          <span className={worked ? "text-green-600" : "text-slate-300"}>{worked ? `RM ${dayPay.toFixed(2)}` : "-"}</span>
                                                        </td>
                                                      )}
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                              <tfoot>
                                                <tr className="bg-slate-900 text-white">
                                                  <td colSpan={3} className="px-4 py-3 text-xs font-black uppercase">Monthly Total ({s.days.length} days worked)</td>
                                                  <td className="px-4 py-3 text-center text-xs font-black text-orange-300">{fmtHrs(s.coachHrs)}</td>
                                                  <td className="px-4 py-3 text-center text-xs font-black text-indigo-300">{fmtHrs(s.execHrs)}</td>
                                                  <td className="px-4 py-3 text-center text-xs font-black text-blue-300">{fmtHrs(s.totalHrs)}</td>
                                                  {s.isPT && <td className="px-4 py-3 text-right text-sm font-black text-green-400">RM {s.totalPay.toFixed(2)}</td>}
                                                </tr>
                                              </tfoot>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })()}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                      {filteredStaff.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-900 text-white">
                            <td colSpan={3} className="px-5 py-4 text-sm font-black uppercase tracking-wider">
                              Total ({filteredTotals.totalStaff} staff)
                            </td>
                            <td className="px-5 py-4 text-center text-sm font-bold text-orange-300">{fmtHrs(filteredTotals.totalCoachHrs)}</td>
                            <td className="px-5 py-4 text-center text-sm font-bold text-indigo-300">{fmtHrs(filteredTotals.totalExecHrs)}</td>
                            <td className="px-5 py-4 text-center text-sm font-bold text-blue-300">{fmtHrs(filteredTotals.totalHrs)}</td>
                            {viewTab !== "ft" && (
                              <>
                                <td className="px-5 py-4"></td>
                                <td className="px-5 py-4 text-right text-lg font-black text-green-400">
                                  RM {filteredTotals.totalPay.toFixed(2)}
                                </td>
                              </>
                            )}
                            <td className="px-5 py-4"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
