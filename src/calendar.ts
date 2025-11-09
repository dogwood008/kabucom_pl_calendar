export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export type WeekdayLabel = typeof WEEKDAY_LABELS[number];

export interface CalendarDay {
  day: number;
  isoDate: string;
  isToday: boolean;
}

export type CalendarWeek = (CalendarDay | null)[];

export interface CalendarMonth {
  month: number;
  title: string;
  weeks: CalendarWeek[];
}

export interface CalendarYear {
  year: number;
  months: CalendarMonth[];
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildCalendarDay(
  year: number,
  monthIndex: number,
  day: number,
  today: Date,
): CalendarDay {
  const date = new Date(year, monthIndex, day);
  const isoDate = [
    date.getFullYear(),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");

  return {
    day,
    isoDate,
    isToday:
      today.getFullYear() === year &&
      today.getMonth() === monthIndex &&
      today.getDate() === day,
  };
}

function createMonth(year: number, monthIndex: number, today: Date): CalendarMonth {
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();

  const weeks: CalendarWeek[] = [];
  let currentDay = 1;

  let currentWeek: CalendarWeek = Array.from({ length: 7 }, () => null);

  for (let weekday = 0; weekday < 7; weekday += 1) {
    if (weekday >= firstDayOfWeek) {
      currentWeek[weekday] = buildCalendarDay(year, monthIndex, currentDay, today);
      currentDay += 1;
    }
  }
  weeks.push(currentWeek);

  while (currentDay <= daysInMonth) {
    currentWeek = Array.from({ length: 7 }, () => null);

    for (let weekday = 0; weekday < 7 && currentDay <= daysInMonth; weekday += 1) {
      currentWeek[weekday] = buildCalendarDay(year, monthIndex, currentDay, today);
      currentDay += 1;
    }

    weeks.push(currentWeek);
  }

  return {
    month: monthIndex + 1,
    title: `${year}年${(monthIndex + 1).toString().padStart(2, "0")}月`,
    weeks,
  };
}

export function createYearCalendar(year: number): CalendarYear {
  if (!Number.isInteger(year) || year <= 0) {
    throw new Error(`年の指定が不正です: "${year}"`);
  }

  const today = new Date();
  const months = Array.from({ length: 12 }, (_, index) => createMonth(year, index, today));

  return {
    year,
    months,
  };
}

export function parseYear(value: string | undefined, fallbackYear: number): number {
  if (value === undefined || value.trim() === "") {
    return fallbackYear;
  }

  const parsedYear = Number.parseInt(value, 10);

  if (Number.isNaN(parsedYear)) {
    throw new Error(`年は数値で指定してください: "${value}"`);
  }

  if (parsedYear <= 0) {
    throw new Error(`年の指定が不正です（1以上の整数で指定してください）: "${value}"`);
  }

  return parsedYear;
}
