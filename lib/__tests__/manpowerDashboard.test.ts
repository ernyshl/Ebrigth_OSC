import { describe, it, expect } from 'vitest';
import {
  getWeekRanges,
  countClassesForSlot,
  countClassesForDay,
  countClassesForWeek,
  isWeekPlanned,
} from '@/lib/manpowerDashboard';

describe('getWeekRanges', () => {
  it('returns last/this/next Mon-Sun ranges for a mid-week day', () => {
    // Wednesday 2026-04-22
    const today = new Date('2026-04-22T10:00:00');
    const { lastWeek, thisWeek, nextWeek } = getWeekRanges(today);
    expect(thisWeek).toEqual({ startDate: '2026-04-20', endDate: '2026-04-26' });
    expect(lastWeek).toEqual({ startDate: '2026-04-13', endDate: '2026-04-19' });
    expect(nextWeek).toEqual({ startDate: '2026-04-27', endDate: '2026-05-03' });
  });

  it('handles Sunday as last day of this week (not next)', () => {
    // Sunday 2026-04-26 at 23:00 — still "this week"
    const today = new Date('2026-04-26T23:00:00');
    const { thisWeek } = getWeekRanges(today);
    expect(thisWeek).toEqual({ startDate: '2026-04-20', endDate: '2026-04-26' });
  });

  it('handles Monday as start of this week (not last)', () => {
    // Monday 2026-04-20 at 00:05
    const today = new Date('2026-04-20T00:05:00');
    const { thisWeek, lastWeek } = getWeekRanges(today);
    expect(thisWeek).toEqual({ startDate: '2026-04-20', endDate: '2026-04-26' });
    expect(lastWeek).toEqual({ startDate: '2026-04-13', endDate: '2026-04-19' });
  });

  it('handles month boundary', () => {
    // Monday 2026-03-30 — next week crosses into April
    const today = new Date('2026-03-30T10:00:00');
    const { nextWeek } = getWeekRanges(today);
    expect(nextWeek).toEqual({ startDate: '2026-04-06', endDate: '2026-04-12' });
  });

  it('handles year boundary', () => {
    // Tuesday 2026-12-29 — next week is in 2027
    const today = new Date('2026-12-29T10:00:00');
    const { nextWeek } = getWeekRanges(today);
    expect(nextWeek).toEqual({ startDate: '2027-01-04', endDate: '2027-01-10' });
  });
});

describe('countClassesForSlot', () => {
  const WEEKDAY_SLOT = '06.00PM - 07.15PM';

  it('returns 0 when selections is empty', () => {
    expect(countClassesForSlot({}, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(0);
  });

  it('counts filled coach cells (coach1..coach5)', () => {
    const selections = {
      [`Thursday-${WEEKDAY_SLOT}-coach1`]: 'Faizal',
      [`Thursday-${WEEKDAY_SLOT}-coach2`]: 'Aina Nabihah',
    };
    expect(countClassesForSlot(selections, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(2);
  });

  it('treats "None" and empty string as not filled', () => {
    const selections = {
      [`Thursday-${WEEKDAY_SLOT}-coach1`]: '',
      [`Thursday-${WEEKDAY_SLOT}-coach2`]: 'None',
      [`Thursday-${WEEKDAY_SLOT}-coach3`]: 'Faizal',
    };
    expect(countClassesForSlot(selections, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(1);
  });

  it('ignores exec1..exec5 columns', () => {
    const selections = {
      [`Thursday-${WEEKDAY_SLOT}-exec1`]: 'Danish',
      [`Thursday-${WEEKDAY_SLOT}-exec2`]: 'Irfan',
    };
    expect(countClassesForSlot(selections, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(0);
  });

  it('ignores MANAGER column', () => {
    const selections = {
      [`Thursday-${WEEKDAY_SLOT}-MANAGER`]: 'Zahid',
    };
    expect(countClassesForSlot(selections, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(0);
  });

  it('returns 0 for opening/closing slots regardless of selections', () => {
    const OPENING = '5:00 PM - 6:00 PM'; // Ampang opening slot
    const selections = {
      [`Thursday-${OPENING}-coach1`]: 'Faizal',
      [`Thursday-${OPENING}-coach2`]: 'Aina Nabihah',
    };
    expect(countClassesForSlot(selections, 'Thursday', OPENING, 'Ampang')).toBe(0);
  });
});

describe('countClassesForDay', () => {
  it('sums countClassesForSlot across all slots of the day', () => {
    const selections = {
      'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
      'Thursday-06.00PM - 07.15PM-coach2': 'Aina Nabihah',
      'Thursday-07:15PM - 08:30PM-coach1': 'Faizal',
      'Thursday-08.30PM - 09:45PM-coach1': 'Faizal',
    };
    // Ampang weekday slots include three non-opening/closing slots above.
    // Counts: 2 + 1 + 1 = 4.
    expect(countClassesForDay(selections, 'Thursday', 'Ampang')).toBe(4);
  });

  it('returns 0 for a branch that does not run that day', () => {
    // Rimbayu only runs Sat/Sun.
    const selections = {
      'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
    };
    expect(countClassesForDay(selections, 'Thursday', 'Rimbayu')).toBe(0);
  });

  it('excludes opening/closing slot counts', () => {
    const selections = {
      'Thursday-5:00 PM - 6:00 PM-coach1': 'Faizal', // Ampang opening
      'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
    };
    expect(countClassesForDay(selections, 'Thursday', 'Ampang')).toBe(1);
  });
});

describe('countClassesForWeek', () => {
  it('sums across all working days for the branch', () => {
    const selections = {
      'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
      'Friday-06.00PM - 07.15PM-coach1': 'Faizal',
      'Saturday-09:15 AM – 10:30 AM-coach1': 'Faizal',
    };
    // Ampang runs Thu/Fri/Sat/Sun: 1 + 1 + 1 + 0 = 3.
    expect(countClassesForWeek(selections, 'Ampang')).toBe(3);
  });

  it('returns 0 when no coach cells are filled', () => {
    const selections = {
      'Thursday-06.00PM - 07.15PM-exec1': 'Danish',
      'Thursday-06.00PM - 07.15PM-MANAGER': 'Zahid',
    };
    expect(countClassesForWeek(selections, 'Ampang')).toBe(0);
  });
});

describe('isWeekPlanned', () => {
  it('returns false when schedule is null', () => {
    expect(isWeekPlanned(null)).toBe(false);
  });

  it('returns false when schedule is undefined', () => {
    expect(isWeekPlanned(undefined)).toBe(false);
  });

  it('returns false when selections has no coach cells', () => {
    expect(
      isWeekPlanned({
        selections: {
          'Thursday-06.00PM - 07.15PM-exec1': 'Danish',
          'Thursday-06.00PM - 07.15PM-MANAGER': 'Zahid',
        },
      }),
    ).toBe(false);
  });

  it('returns false when coach cells are all "None" or empty', () => {
    expect(
      isWeekPlanned({
        selections: {
          'Thursday-06.00PM - 07.15PM-coach1': 'None',
          'Thursday-06.00PM - 07.15PM-coach2': '',
        },
      }),
    ).toBe(false);
  });

  it('returns true when at least one coach cell is filled', () => {
    expect(
      isWeekPlanned({
        selections: {
          'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
        },
      }),
    ).toBe(true);
  });
});
