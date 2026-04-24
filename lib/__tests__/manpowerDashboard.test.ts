import { describe, it, expect } from 'vitest';
import { getWeekRanges } from '@/lib/manpowerDashboard';

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
