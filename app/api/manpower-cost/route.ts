import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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
      let workedThatDay = false;

      getTimeSlotsForDay(day, branch).forEach((slot) => {
        if (isOpeningClosingSlot(slot, branch)) return;
        COLUMNS.forEach((col) => {
          if (selections[`${day}-${slot}-${col.id}`] === emp) {
            workedThatDay = true;
            const slotDuration = isAdminSlot(slot, branch) ? 0.25 : 1.25;
            if (col.type === "coach") {
              coachingHoursForDay += slotDuration;
            }
          }
        });
      });

      if (workedThatDay) {
        // Exec hours = total working hours - coach hours (not from slots, to account for gaps)
        const execHrs = Math.max(0, dailyTarget - coachingHoursForDay);

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

    // Get logged-in user session to determine role-based filtering
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as any;
    const userRole = sessionUser?.role || "";
    const isEmployeeView = userRole === "Part_Time" || userRole === "Full_Time";

    // For employee users, resolve their schedule name by matching:
    // User.email → BranchStaff.email → BranchStaff.nickname → Employee.name
    // Also try substring matching for name variations (e.g. "IRDIENA" contains "Diena")
    let employeeFilterNames: string[] = [];
    if (isEmployeeView && sessionUser?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email },
        select: { name: true, branchName: true },
      });

      const branchStaffMatch = await prisma.branchStaff.findFirst({
        where: { email: { equals: sessionUser.email, mode: "insensitive" } },
        select: { name: true, nickname: true },
      });

      // Collect all name candidates from User and BranchStaff
      const candidates = new Set<string>();
      if (branchStaffMatch?.nickname) candidates.add(branchStaffMatch.nickname.toLowerCase().trim());
      if (branchStaffMatch?.name) candidates.add(branchStaffMatch.name.toLowerCase().trim());
      if (dbUser?.name) candidates.add(dbUser.name.toLowerCase().trim());
      if (dbUser?.branchName) candidates.add(dbUser.branchName.toLowerCase().trim());

      // Also find Employee names that are substrings of our candidates or vice versa
      // This handles cases like BranchStaff nickname "IRDIENA" → Employee name "Diena"
      const allEmps = await prisma.employee.findMany({
        select: { name: true, nickname: true },
      });
      const candidateArr = Array.from(candidates);
      allEmps.forEach((emp) => {
        const empName = emp.name?.toLowerCase().trim();
        const empNick = emp.nickname?.toLowerCase().trim();
        if (!empName) return;
        for (const c of candidateArr) {
          // Check exact match, substring match, or if full name contains employee name
          if (c === empName || c === empNick ||
              c.includes(empName) || empName.includes(c) ||
              (empNick && (c.includes(empNick) || empNick.includes(c)))) {
            candidates.add(empName);
            if (empNick) candidates.add(empNick);
            break;
          }
        }
      });

      employeeFilterNames = Array.from(candidates);
    }

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
    // All keys are lowercased to avoid case-sensitive mismatches
    const employeeLookup: Record<string, { position: string | null; CoachRate: number | null; displayName: string; displayBranch: string }> = {};
    const nameNormalize: Record<string, string> = {};
    allEmployees.forEach((e) => {
      if (e.name && e.branch) {
        const key = `${e.name.toLowerCase()}:::${e.branch.toLowerCase()}`;
        employeeLookup[key] = {
          position: e.position,
          CoachRate: e.CoachRate ? Number(e.CoachRate) : null,
          displayName: e.name,
          displayBranch: e.branch,
        };
        nameNormalize[key] = key;
      }
      if (e.nickname && e.branch && e.nickname !== e.name) {
        const nickKey = `${e.nickname.toLowerCase()}:::${e.branch.toLowerCase()}`;
        employeeLookup[nickKey] = {
          position: e.position,
          CoachRate: e.CoachRate ? Number(e.CoachRate) : null,
          displayName: e.name || e.nickname,
          displayBranch: e.branch,
        };
        if (e.name) {
          nameNormalize[nickKey] = `${e.name.toLowerCase()}:::${e.branch.toLowerCase()}`;
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
          const fullKey = `${bs.name.toLowerCase()}:::${emp.branch.toLowerCase()}`;
          if (!nameNormalize[fullKey]) {
            nameNormalize[fullKey] = `${emp.name.toLowerCase()}:::${emp.branch.toLowerCase()}`;
          }
        }
      }
    });

    // Also build a name-only lookup (ignoring branch) as a fallback
    const nameOnlyLookup: Record<string, { position: string | null; CoachRate: number | null }> = {};
    allEmployees.forEach((e) => {
      if (e.name) {
        const nk = e.name.toLowerCase();
        if (!nameOnlyLookup[nk]) {
          nameOnlyLookup[nk] = {
            position: e.position,
            CoachRate: e.CoachRate ? Number(e.CoachRate) : null,
          };
        }
      }
    });

    // Resolve a name+branch to its canonical (Employee.name) key
    const canonicalKey = (name: string, branch: string): string => {
      const key = `${name.toLowerCase()}:::${branch.toLowerCase()}`;
      return nameNormalize[key] || key;
    };

    // Helper to find info for a given name+branch, with fallback to name-only match
    const findStaffInfo = (name: string, branch: string) => {
      const key = `${name.toLowerCase()}:::${branch.toLowerCase()}`;
      const emp = employeeLookup[key];
      if (emp) {
        return { position: emp.position || null, rate: emp.CoachRate || null };
      }
      // Fallback: match by name only (ignore branch)
      const nameOnly = nameOnlyLookup[name.toLowerCase()];
      if (nameOnly) {
        return { position: nameOnly.position || null, rate: nameOnly.CoachRate || null };
      }
      return { position: null, rate: null };
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
    interface DailyEntry { date: string; day: string; coachHrs: number; execHrs: number; totalHrs: number; scheduleBranch?: string }

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

    // Build a name-only Employee lookup to find home branch
    const nameToHomeBranch: Record<string, string> = {};
    allEmployees.forEach((e) => {
      if (e.name && e.branch) {
        nameToHomeBranch[e.name.toLowerCase().trim()] = e.branch;
      }
      if (e.nickname && e.branch) {
        nameToHomeBranch[e.nickname.toLowerCase().trim()] = e.branch;
      }
    });

    allEntries.forEach((entry) => {
      // First try to find the employee via the schedule branch key
      const schedKey = canonicalKey(entry.name, entry.branch);
      const empRecord = employeeLookup[schedKey];
      const displayName = empRecord?.displayName || entry.name;

      // Resolve the employee's HOME branch from Employee table (not the schedule branch)
      const homeBranch = nameToHomeBranch[displayName.toLowerCase().trim()]
        || nameToHomeBranch[entry.name.toLowerCase().trim()]
        || empRecord?.displayBranch
        || entry.branch;

      // Use home branch as the canonical key so replacements aggregate under home branch
      const homeKey = canonicalKey(displayName, homeBranch);

      // Look up staff info by home branch first, then schedule branch as fallback
      const homeInfo = findStaffInfo(displayName, homeBranch);
      const schedInfo = findStaffInfo(entry.name, entry.branch);
      const staffInfo = {
        position: homeInfo.position || schedInfo.position,
        rate: homeInfo.rate || schedInfo.rate,
      };

      if (!aggregated[homeKey]) {
        const rate = staffInfo.rate || null;
        const position = staffInfo.position || null;

        aggregated[homeKey] = {
          name: displayName,
          branch: homeBranch,
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

      aggregated[homeKey].coachHrs += entry.coachHrs;
      aggregated[homeKey].execHrs += entry.execHrs;
      aggregated[homeKey].totalHrs += entry.totalHrs;

      // Add daily entries with scheduleBranch so the UI can show replacement notes
      const scheduleBranch = entry.branch;
      entry.dailyBreakdown.forEach((d: any) => {
        aggregated[homeKey].days.push({
          date: d.date,
          day: d.day,
          coachHrs: d.coachHrs,
          execHrs: d.execHrs,
          totalHrs: d.totalHrs,
          scheduleBranch: scheduleBranch !== homeBranch ? scheduleBranch : undefined,
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

    // For employee users, filter to only their own data (case-insensitive name match)
    if (isEmployeeView && employeeFilterNames.length > 0) {
      const filtered = results.filter((r) =>
        employeeFilterNames.some((n) => r.name.toLowerCase().trim() === n)
      );
      results.length = 0;
      results.push(...filtered);
    }

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

    // Build available weeks list from schedules
    const weeksSet = new Set<string>();
    schedules.forEach((s: any) => {
      weeksSet.add(`${s.startDate}:::${s.endDate}`);
    });
    const availableWeeks = Array.from(weeksSet)
      .map((w) => { const [start, end] = w.split(":::"); return { start, end }; })
      .sort((a, b) => a.start.localeCompare(b.start));

    return NextResponse.json({
      success: true,
      month,
      totals,
      staff: results,
      isEmployeeView,
      availableWeeks,
    });
  } catch (error) {
    console.error("Manpower cost calculation error:", error);
    return NextResponse.json(
      { error: "Failed to calculate manpower cost" },
      { status: 500 }
    );
  }
}
