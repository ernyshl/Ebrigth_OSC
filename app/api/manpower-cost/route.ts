import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getWorkingDaysForBranch,
  getTimeSlotsForDay,
  isOpeningClosingSlot,
  isAdminSlot,
  COLUMNS,
} from "@/lib/manpowerUtils";

// Executive rate is fixed at RM11/hr for all
const EXECUTIVE_RATE = 11;

interface DailyHour {
  day: string; // "Wednesday", "Thursday", etc.
  coachHrs: number;
  execHrs: number;
  totalHrs: number;
}

interface StaffHourEntry {
  name: string;
  branch: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  coachHrs: number;
  execHrs: number;
  totalHrs: number;
  dailyBreakdown: DailyHour[];
}

/**
 * Calculate staff hours from a ManpowerSchedule selections object.
 * Returns both totals and daily breakdown per employee.
 */
function calculateHoursFromSelections(
  selections: Record<string, string>,
  branch: string
): Record<string, { coachHrs: number; execHrs: number; totalHrs: number; dailyBreakdown: DailyHour[] }> {
  const allNames = new Set<string>();
  Object.values(selections).forEach((val) => {
    if (val && val !== "" && val !== "None") allNames.add(val);
  });

  const staffStats: Record<string, { coachHrs: number; execHrs: number; totalHrs: number; dailyBreakdown: DailyHour[] }> = {};
  allNames.forEach((name) => {
    staffStats[name] = { coachHrs: 0, execHrs: 0, totalHrs: 0, dailyBreakdown: [] };
  });

  getWorkingDaysForBranch(branch).forEach((day) => {
    const isWeekend = day === "Saturday" || day === "Sunday";
    const dailyTarget = isWeekend ? 10.5 : 5.0;

    allNames.forEach((emp) => {
      let coachingHoursForDay = 0;
      let explicitExecHoursForDay = 0;
      let workedThatDay = false;

      getTimeSlotsForDay(day, branch).forEach((slot) => {
        if (isOpeningClosingSlot(slot, branch)) return;
        COLUMNS.forEach((col) => {
          if (selections[`${day}-${slot}-${col.id}`] === emp) {
            workedThatDay = true;
            const slotDuration = isAdminSlot(slot, branch) ? 0.25 : 1.25;
            if (col.type === "coach") {
              coachingHoursForDay += slotDuration;
            } else if (col.type === "exec") {
              explicitExecHoursForDay += slotDuration;
            }
          }
        });
      });

      if (workedThatDay) {
        const execHrs = explicitExecHoursForDay > 0
          ? explicitExecHoursForDay
          : Math.max(0, dailyTarget - coachingHoursForDay);

        staffStats[emp].coachHrs += coachingHoursForDay;
        staffStats[emp].execHrs += execHrs;
        staffStats[emp].totalHrs = staffStats[emp].coachHrs + staffStats[emp].execHrs;
        staffStats[emp].dailyBreakdown.push({
          day,
          coachHrs: coachingHoursForDay,
          execHrs,
          totalHrs: coachingHoursForDay + execHrs,
        });
      }
    });
  });

  return staffStats;
}

/**
 * GET /api/manpower-cost?month=2026-04
 *
 * Returns staff hours + cost data by parsing ManpowerSchedule selections
 * and joining with BranchStaff for employee details (employeeId, rate, role/position).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // e.g. "2026-04"

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "month parameter required (format: YYYY-MM)" },
        { status: 400 }
      );
    }

    // 1. Fetch all ManpowerSchedule records that overlap with the requested month
    const [year, mon] = month.split("-");
    const monthStart = `${year}-${mon}-01`;
    const nextMonth = Number(mon) === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(mon) + 1).padStart(2, "0")}-01`;

    // Only fetch schedules that start within the requested month.
    // Days that spill into the next month are filtered out in step 3.
    const schedules = await prisma.manpowerSchedule.findMany({
      where: {
        startDate: { gte: monthStart, lt: nextMonth },
        status: "Finalized",
      },
      orderBy: { startDate: "asc" },
    });

    // 2. Fetch Employee table (this is where schedule names come from)
    // The `position` field stores the role (e.g. "PT - COACH", "FT - COACH", "Branch Manager")
    const allEmployees = await prisma.employee.findMany({
      select: { name: true, nickname: true, branch: true, position: true, CoachRate: true },
    });

    // Also fetch BranchStaff to map full names (e.g. "VARSHNI A/P GUNASHAKAR") → nickname ("Varshni")
    // Old schedules may have saved full names from BranchStaff, while newer ones use Employee.name
    const allBranchStaff = await prisma.branchStaff.findMany({
      select: { name: true, nickname: true, branch: true },
    });

    // Build Employee lookup by name+branch (position and CoachRate from Employee table)
    // Also build a name normalization map so all name variants merge into the Employee.name
    const employeeLookup: Record<string, { position: string | null; CoachRate: number | null }> = {};
    const nameNormalize: Record<string, string> = {};
    allEmployees.forEach((e) => {
      if (e.name && e.branch) {
        const key = `${e.name}:::${e.branch}`;
        employeeLookup[key] = {
          position: e.position,
          CoachRate: e.CoachRate ? Number(e.CoachRate) : null,
        };
        nameNormalize[key] = key;
      }
      if (e.nickname && e.branch && e.nickname !== e.name) {
        const nickKey = `${e.nickname}:::${e.branch}`;
        employeeLookup[nickKey] = {
          position: e.position,
          CoachRate: e.CoachRate ? Number(e.CoachRate) : null,
        };
        if (e.name) {
          nameNormalize[nickKey] = `${e.name}:::${e.branch}`;
        }
      }
    });

    // Map BranchStaff full names → Employee.name via matching nickname (case-insensitive).
    // BranchStaff uses abbreviated branch codes (e.g. "KLG") while Employee uses full names ("Klang"),
    // so we match by nickname only, then pair with Employee's branch.
    allBranchStaff.forEach((bs) => {
      if (bs.name && bs.nickname) {
        const bsNickLower = bs.nickname.toLowerCase();
        const emp = allEmployees.find(
          (e) => e.name?.toLowerCase() === bsNickLower || e.nickname?.toLowerCase() === bsNickLower
        );
        if (emp?.name && emp.branch) {
          // Map the full name (with Employee's branch) to the canonical Employee.name key
          const fullKey = `${bs.name}:::${emp.branch}`;
          if (!nameNormalize[fullKey]) {
            nameNormalize[fullKey] = `${emp.name}:::${emp.branch}`;
          }
        }
      }
    });

    // Resolve a name+branch to its canonical (Employee.name) key
    const canonicalKey = (name: string, branch: string): string => {
      const key = `${name}:::${branch}`;
      return nameNormalize[key] || key;
    };

    // Helper to find info for a given name+branch
    const findStaffInfo = (name: string, branch: string) => {
      const key = `${name}:::${branch}`;
      const emp = employeeLookup[key];
      return {
        position: emp?.position || null,
        rate: emp?.CoachRate || null,
      };
    };

    // Helper: map day name to actual date within a schedule week
    const dayNameToDate = (dayName: string, startDate: string): string => {
      const dayMap: Record<string, number> = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
      };
      const [sy, sm, sd] = startDate.split("-").map(Number);
      const start = new Date(sy, sm - 1, sd);
      const startDow = start.getDay();
      const targetDow = dayMap[dayName] ?? 0;
      let diff = targetDow - startDow;
      if (diff < 0) diff += 7;
      const result = new Date(sy, sm - 1, sd + diff);
      const yyyy = result.getFullYear();
      const mm = String(result.getMonth() + 1).padStart(2, "0");
      const dd = String(result.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    // 3. Process each schedule and compute hours
    //    Filter daily entries to only include days within the requested month,
    //    since a schedule week can span across month boundaries.
    const allEntries: StaffHourEntry[] = [];

    schedules.forEach((schedule: any) => {
      const selections = (schedule.selections || schedule.originalSelections || {}) as Record<string, string>;
      if (!selections || Object.keys(selections).length === 0) return;

      const stats = calculateHoursFromSelections(selections, schedule.branch);

      Object.entries(stats).forEach(([name, hours]) => {
        if (hours.totalHrs === 0) return;
        // Map daily breakdown day names to actual dates, then filter to requested month
        const dailyWithDates = hours.dailyBreakdown
          .map((d) => ({
            ...d,
            date: dayNameToDate(d.day, schedule.startDate),
          }))
          .filter((d) => d.date >= monthStart && d.date < nextMonth);

        if (dailyWithDates.length === 0) return;

        // Recalculate hours from filtered days only
        const filteredCoachHrs = dailyWithDates.reduce((s, d) => s + d.coachHrs, 0);
        const filteredExecHrs = dailyWithDates.reduce((s, d) => s + d.execHrs, 0);

        allEntries.push({
          name,
          branch: schedule.branch,
          weekLabel: `${schedule.startDate} - ${schedule.endDate}`,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          coachHrs: filteredCoachHrs,
          execHrs: filteredExecHrs,
          totalHrs: filteredCoachHrs + filteredExecHrs,
          dailyBreakdown: dailyWithDates,
        });
      });
    });

    // 4. Aggregate by employee (sum across all weeks in the month)
    interface DailyEntry { date: string; day: string; coachHrs: number; execHrs: number; totalHrs: number }

    const aggregated: Record<string, {
      name: string;
      branch: string;
      rate: number | null;
      employmentType: string | null;
      position: string | null;
      coachHrs: number;
      execHrs: number;
      totalHrs: number;
      coachPay: number;
      execPay: number;
      totalPay: number;
      days: DailyEntry[];
    }> = {};

    allEntries.forEach((entry) => {
      const key = canonicalKey(entry.name, entry.branch);
      const displayName = key.split(":::")[0];
      const canonicalBranch = key.split(":::")[1];
      // Look up staff info by canonical name (Employee.name), fall back to raw name from selections
      const canonical = findStaffInfo(displayName, canonicalBranch);
      const raw = findStaffInfo(entry.name, entry.branch);
      const staffInfo = {
        position: canonical.position || raw.position,
        rate: canonical.rate || raw.rate,
      };

      if (!aggregated[key]) {
        const rate = staffInfo.rate || null;
        const position = staffInfo.position || null;

        aggregated[key] = {
          name: displayName,
          branch: entry.branch,
          rate,
          employmentType: position,
          position,
          coachHrs: 0,
          execHrs: 0,
          totalHrs: 0,
          coachPay: 0,
          execPay: 0,
          totalPay: 0,
          days: [],
        };
      }

      aggregated[key].coachHrs += entry.coachHrs;
      aggregated[key].execHrs += entry.execHrs;
      aggregated[key].totalHrs += entry.totalHrs;

      // Add daily entries with actual dates
      entry.dailyBreakdown.forEach((d: any) => {
        aggregated[key].days.push({
          date: d.date,
          day: d.day,
          coachHrs: d.coachHrs,
          execHrs: d.execHrs,
          totalHrs: d.totalHrs,
        });
      });
    });

    // Sort each employee's days by date
    Object.values(aggregated).forEach((emp) => {
      emp.days.sort((a, b) => a.date.localeCompare(b.date));
    });

    // 5. Determine PT/FT and calculate pay, exclude Branch Managers
    const results = Object.values(aggregated)
      .filter((emp) => {
        // Exclude branch managers, interns, and training staff
        const pos = (emp.position || "").toUpperCase();
        const name = (emp.name || "").toUpperCase();
        if (pos.includes("BRANCH MANAGER")) return false;
        if (pos.includes("INTERN")) return false;
        if (name.includes("(TRAINING)")) return false;
        return true;
      })
      .map((emp) => {
        // Determine PT by checking role/position/employment_type for "PT" prefix
        const roleStr = (emp.employmentType || emp.position || "").toUpperCase();
        const isPT = roleStr.startsWith("PT") || roleStr.includes("PT -") || roleStr.includes("PART-TIME") || roleStr.includes("PART TIME");

        // PT coaches: calculate pay (use rate if available, otherwise 0 for pay but still flag as PT)
        const hasRate = emp.rate !== null && emp.rate > 0;
        const coachPay = isPT && hasRate ? emp.coachHrs * (emp.rate || 0) : 0;
        const execPay = isPT && hasRate ? emp.execHrs * EXECUTIVE_RATE : 0;

        return {
          ...emp,
          isPT,
          coachPay,
          execPay,
          totalPay: coachPay + execPay,
        };
      });

    // Sort: PT first (they have cost), then FT, then by name
    results.sort((a, b) => {
      if (a.isPT !== b.isPT) return a.isPT ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // 6. Compute totals
    const ptResults = results.filter((r) => r.isPT);
    const ftResults = results.filter((r) => !r.isPT);

    const totals = {
      totalStaff: results.length,
      ptCount: ptResults.length,
      ftCount: ftResults.length,
      totalCoachHrs: results.reduce((s, r) => s + r.coachHrs, 0),
      totalExecHrs: results.reduce((s, r) => s + r.execHrs, 0),
      totalHrs: results.reduce((s, r) => s + r.totalHrs, 0),
      totalCoachPay: ptResults.reduce((s, r) => s + r.coachPay, 0),
      totalExecPay: ptResults.reduce((s, r) => s + r.execPay, 0),
      totalPay: ptResults.reduce((s, r) => s + r.totalPay, 0),
      executiveRate: EXECUTIVE_RATE,
    };

    return NextResponse.json({
      success: true,
      month,
      totals,
      staff: results,
    });
  } catch (error) {
    console.error("Manpower cost calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate manpower cost" },
      { status: 500 }
    );
  }
}
