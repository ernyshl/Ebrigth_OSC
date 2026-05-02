"use client";

import { useMemo } from "react";
import { ALL_BRANCHES, DAYS, getWorkingDaysForBranch } from "@/lib/manpowerUtils";
import {
  countClassesForDay,
  countClassesForWeek,
  isWeekPlanned,
  type SelectionsMap,
} from "@/lib/manpowerDashboard";

type ScheduleRow = {
  branch: string;
  startDate: string;
  selections: SelectionsMap;
};

export default function ManpowerDashboardMatrix({
  schedules,
  weekStart,
  onBranchClick,
}: {
  schedules: ScheduleRow[];
  weekStart: string;
  onBranchClick: (branch: string) => void;
}) {
  const dayList = useMemo(() => [...DAYS], []);

  const rows = useMemo(() => {
    return ALL_BRANCHES.map((branch) => {
      const schedule = schedules.find((s) => s.branch === branch && s.startDate === weekStart);
      const planned = isWeekPlanned(schedule ?? null);
      const workingDays = getWorkingDaysForBranch(branch);
      const perDay: Record<string, number | null> = {};
      let total = 0;
      for (const d of dayList) {
        if (!workingDays.includes(d)) {
          perDay[d] = null; // render as —
          continue;
        }
        const count = schedule ? countClassesForDay(schedule.selections, d, branch) : 0;
        perDay[d] = count;
        total += count;
      }
      return { branch, planned, perDay, total };
    });
  }, [schedules, weekStart, dayList]);

  const networkTotalsPerDay = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const d of dayList) {
      totals[d] = rows.reduce((sum, r) => sum + (r.perDay[d] ?? 0), 0);
    }
    return totals;
  }, [rows, dayList]);

  const networkWeekTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const plannedCount = rows.filter((r) => r.planned).length;
  const totalBranches = rows.length;

  const bannerClass =
    plannedCount === totalBranches
      ? "bg-green-50 border-green-200 text-green-800"
      : plannedCount === 0
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-yellow-50 border-yellow-200 text-yellow-800";
  const bannerText =
    plannedCount === totalBranches
      ? `✅ All ${totalBranches} branches planned for this week`
      : plannedCount === 0
        ? "🔴 No branches have planned this week yet"
        : `⚠️ ${plannedCount} of ${totalBranches} branches planned — ${totalBranches - plannedCount} outstanding`;

  return (
    <div className="space-y-4">
      <div className={`border rounded-2xl p-4 font-bold ${bannerClass}`}>{bannerText}</div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
            <thead className="bg-[#2D3F50] text-white text-[10px] uppercase tracking-widest">
              <tr>
                <th className="p-3 text-left w-[220px]">Branch</th>
                {dayList.map((d) => (
                  <th key={d} className="p-3 text-center">{d.slice(0, 3)}</th>
                ))}
                <th className="p-3 text-right w-[140px]">Week Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.branch}
                  onClick={() => onBranchClick(r.branch)}
                  className={`border-b cursor-pointer transition-colors ${
                    r.planned ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <td className="p-3 font-bold text-sm text-slate-800">{r.branch}</td>
                  {dayList.map((d) => (
                    <td key={d} className="p-3 text-center text-sm font-medium">
                      {r.perDay[d] === null ? "—" : r.perDay[d]}
                    </td>
                  ))}
                  <td className="p-3 text-right text-sm font-black text-slate-800">
                    {r.planned ? (
                      r.total
                    ) : (
                      <span className="inline-block px-2 py-1 rounded bg-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest">
                        Not planned
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100">
              <tr>
                <td className="p-3 font-black uppercase text-xs tracking-widest text-slate-800">Network total</td>
                {dayList.map((d) => (
                  <td key={d} className="p-3 text-center font-black text-slate-800">
                    {networkTotalsPerDay[d]}
                  </td>
                ))}
                <td className="p-3 text-right font-black text-slate-800">{networkWeekTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
