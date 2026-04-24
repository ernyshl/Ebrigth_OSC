import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
} from 'date-fns';

export type WeekRange = {
  startDate: string;
  endDate: string;
};

export type WeekRanges = {
  lastWeek: WeekRange;
  thisWeek: WeekRange;
  nextWeek: WeekRange;
};

function toRange(date: Date): WeekRange {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}

export function getWeekRanges(today: Date): WeekRanges {
  return {
    lastWeek: toRange(addWeeks(today, -1)),
    thisWeek: toRange(today),
    nextWeek: toRange(addWeeks(today, 1)),
  };
}
