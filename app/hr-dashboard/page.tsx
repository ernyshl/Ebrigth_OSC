"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface StaffRecord {
  name: string;
  branch: string;
  position: string;
  dept: string;
  date: string;
  employeeId: string;
  isHighlight: boolean;
}

interface LeaveRecord {
  employeeCode: string;
  name: string;
  position: string;
  dept: string;
  branch: string;
  date: string;
  reason: string;
  status: string;
  days: string;
  isHighlight: boolean;
}

interface DashboardData {
  onboarding: StaffRecord[];
  offboarding: StaffRecord[];
  mc: LeaveRecord[];
  mcToday: LeaveRecord[];
  annualLeave: LeaveRecord[];
  annualLeaveToday: LeaveRecord[];
  counts: {
    onboarding: number;
    onboardingHighlight: number;
    offboarding: number;
    offboardingHighlight: number;
    mc: number;
    mcToday: number;
    mcHighlight: number;
    annualLeave: number;
    annualLeaveToday: number;
    annualLeaveHighlight: number;
  };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(s: string) {
  if (s === "A") return <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Approved</span>;
  if (s === "N") return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>;
  return <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{s}</span>;
}

type Section = "overview" | "onboarding" | "offboarding" | "mc" | "leave";

export default function HRDashboardPage() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/hr-dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full mx-auto mb-4" />
          <p className="text-slate-500">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-red-500">
          <p className="text-lg font-bold">Error loading data</p>
          <p className="text-sm mt-2">{error}</p>
          <Link href="/dashboards/hrms" className="text-blue-500 mt-4 inline-block">← Back to HRMS</Link>
        </div>
      </div>
    );
  }

  const c = data.counts;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">HR Dashboard</h1>
            <p className="text-xs text-slate-400">Employee Lifecycle Data</p>
          </div>
        </div>
        <Link
          href="/dashboards/hrms"
          className="text-sm text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all"
        >
          ← Back to HRMS
        </Link>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Overview */}
        {activeSection === "overview" && (
          <>
            {/* 2x2 Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Onboarding */}
              <button
                onClick={() => setActiveSection("onboarding")}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-left transition-all hover:shadow-md hover:border-emerald-300 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase">Onboarding</h3>
                    <p className="text-[11px] text-slate-400">Today &rarr; +6 months</p>
                  </div>
                </div>
                <div className="text-center my-8">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Today</p>
                  <p className="text-[120px] leading-none font-black text-emerald-500">{c.onboardingHighlight}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase">+2 weeks</p>
                    <p className="text-4xl font-black text-emerald-600">{c.onboarding}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">+6 months</p>
                    <p className="text-4xl font-black text-slate-600">{c.onboarding - c.onboardingHighlight}</p>
                  </div>
                </div>
              </button>

              {/* Offboarding */}
              <button
                onClick={() => setActiveSection("offboarding")}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-left transition-all hover:shadow-md hover:border-red-300 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase">Offboarding</h3>
                    <p className="text-[11px] text-slate-400">Today &rarr; +1 month</p>
                  </div>
                </div>
                <div className="text-center my-8">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Today</p>
                  <p className="text-[120px] leading-none font-black text-red-500">{c.offboardingHighlight}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase">+2 weeks</p>
                    <p className="text-4xl font-black text-emerald-600">{c.offboarding}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">+1 month</p>
                    <p className="text-4xl font-black text-slate-600">{c.offboarding - c.offboardingHighlight}</p>
                  </div>
                </div>
              </button>

              {/* MC */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 transition-all hover:shadow-md hover:border-amber-300">
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase">MC</h3>
                  <p className="text-[11px] text-slate-400">Today</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center justify-center min-w-[100px] bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-[10px] text-amber-600 font-semibold uppercase">Today</p>
                    <p className="text-6xl font-black text-amber-500">{c.mcToday}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[180px] space-y-1 flex flex-col justify-center">
                    {data.mcToday.length === 0 ? (
                      <p className="text-sm text-slate-400 italic py-2">No MC for today</p>
                    ) : (
                      data.mcToday.map((row, i) => (
                        <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-amber-50">
                          <span className="text-slate-700 font-medium truncate mr-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                            {row.name}
                          </span>
                          <span className="text-slate-400 whitespace-nowrap text-[11px]">{formatDate(row.date)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Annual Leave */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 transition-all hover:shadow-md hover:border-purple-300">
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase">Annual Leave</h3>
                  <p className="text-[11px] text-slate-400">Today</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center justify-center min-w-[100px] bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                    <p className="text-[10px] text-purple-600 font-semibold uppercase">Today</p>
                    <p className="text-6xl font-black text-purple-500">{c.annualLeaveToday}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[180px] space-y-1 flex flex-col justify-center">
                    {data.annualLeaveToday.length === 0 ? (
                      <p className="text-sm text-slate-400 italic py-2">No Annual Leave for today</p>
                    ) : (
                      data.annualLeaveToday.map((row, i) => (
                        <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-purple-50">
                          <span className="text-slate-700 font-medium truncate mr-2">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5" />
                            {row.name}
                          </span>
                          <span className="text-slate-400 whitespace-nowrap text-[11px]">{formatDate(row.date)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

          </>
        )}

        {/* Onboarding Detail */}
        {activeSection === "onboarding" && (
          <DetailSection title={`Onboarding (today to +6 months) (${data.onboarding.length})`} subtitle="Green = within 2 weeks" color="emerald" onBack={() => setActiveSection("overview")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">#</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">NAME</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">POSITION</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">DEPT / BRANCH</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">START DATE</th>
                </tr>
              </thead>
              <tbody>
                {data.onboarding.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">No onboarding records found</td></tr>
                )}
                {data.onboarding.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${row.isHighlight ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                    <td className="py-3 px-3 text-slate-500">{i + 1}</td>
                    <td className="py-3 px-3 text-slate-800 font-medium">
                      {row.name}
                      {row.isHighlight && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500" />}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{row.position}</td>
                    <td className="py-3 px-3 text-slate-600">{row.dept}</td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{formatDate(row.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        )}

        {/* Offboarding Detail */}
        {activeSection === "offboarding" && (
          <DetailSection title={`Offboarding (today to +1 month) (${data.offboarding.length})`} subtitle="Green = within 2 weeks" color="red" onBack={() => setActiveSection("overview")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">#</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">NAME</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">POSITION</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">DEPT / BRANCH</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">END DATE</th>
                </tr>
              </thead>
              <tbody>
                {data.offboarding.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">No offboarding records found</td></tr>
                )}
                {data.offboarding.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${row.isHighlight ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                    <td className="py-3 px-3 text-slate-500">{i + 1}</td>
                    <td className="py-3 px-3 text-slate-800 font-medium">
                      {row.name}
                      {row.isHighlight && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500" />}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{row.position}</td>
                    <td className="py-3 px-3 text-slate-600">{row.dept}</td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{formatDate(row.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        )}

        {/* MC Detail */}
        {activeSection === "mc" && (
          <DetailSection title={`MC (-2 weeks to today) (${data.mc.length})`} subtitle="Orange = within last 3 days" color="amber" onBack={() => setActiveSection("overview")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">#</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">NAME</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">POSITION</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">DEPT / BRANCH</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">MC DATE</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">REASON</th>
                </tr>
              </thead>
              <tbody>
                {data.mc.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400 italic">No MC records found</td></tr>
                )}
                {data.mc.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${row.isHighlight ? "bg-amber-50" : "hover:bg-slate-50"}`}>
                    <td className="py-3 px-3 text-slate-500">{i + 1}</td>
                    <td className="py-3 px-3 text-slate-800 font-medium">
                      {row.name}
                      {row.isHighlight && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500" />}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{row.position}</td>
                    <td className="py-3 px-3 text-slate-600">{row.dept}<br /><span className="text-slate-400 text-xs">{row.branch}</span></td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{formatDate(row.date)}</td>
                    <td className="py-3 px-3 text-slate-600">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        )}

        {/* Annual Leave Detail */}
        {activeSection === "leave" && (
          <DetailSection title={`Annual Leave (-1 week to +2 weeks) (${data.annualLeave.length})`} subtitle="Purple = within 1 week" color="purple" onBack={() => setActiveSection("overview")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">#</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">EMPLOYEE CODE</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">LEAVE DATE</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">DAYS</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">REASON</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">STATUS</th>
                  <th className="text-left py-3 px-3 text-slate-500 font-semibold">REMARK</th>
                </tr>
              </thead>
              <tbody>
                {data.annualLeave.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400 italic">No annual leave records found</td></tr>
                )}
                {data.annualLeave.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${row.isHighlight ? "bg-purple-50" : "hover:bg-slate-50"}`}>
                    <td className="py-3 px-3 text-slate-500">{i + 1}</td>
                    <td className="py-3 px-3 text-slate-800 font-medium font-mono text-xs">
                      {row.employeeCode}
                      {row.isHighlight && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-purple-500" />}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{formatDate(row.date)}</td>
                    <td className="py-3 px-3 text-slate-600">{row.days}</td>
                    <td className="py-3 px-3 text-slate-600">{row.reason}</td>
                    <td className="py-3 px-3">{statusLabel(row.status)}</td>
                    <td className="py-3 px-3 text-slate-400 text-xs max-w-[200px] truncate">{(row as any).remark || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        )}
      </div>
    </div>
  );
}

function DetailSection({
  title, subtitle, color, onBack, children,
}: {
  title: string; subtitle: string; color: string; onBack: () => void; children: React.ReactNode;
}) {
  const bgMap: Record<string, string> = {
    emerald: "bg-emerald-500", red: "bg-red-500", amber: "bg-amber-500", purple: "bg-purple-500",
  };
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
        ← Back to Overview
      </button>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className={`${bgMap[color] || bgMap.emerald} text-white px-6 py-4`}>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm opacity-80">{subtitle}</p>
        </div>
        <div className="p-4 overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}
