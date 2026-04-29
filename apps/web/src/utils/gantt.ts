import type { Task } from "../../../../packages/shared/src/index";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimelineDay {
  key: string;
  label: string;
  weekLabel: string;
  isWeekStart: boolean;
  isToday: boolean;
}

export interface Timeline {
  startDate: string;
  endDate: string;
  days: TimelineDay[];
}

export function buildTimeline(tasks: Task[], today = toDateKey(new Date())): Timeline {
  const taskDates = tasks.flatMap((task) => [task.startDate, task.dueDate]);
  const baseStart = taskDates.length > 0 ? minDate(taskDates) : today;
  const baseEnd = taskDates.length > 0 ? maxDate(taskDates) : today;
  const startDate = addDays(baseStart, -2);
  const endDate = addDays(baseEnd, 2);
  const dayCount = daysBetween(startDate, endDate) + 1;

  return {
    startDate,
    endDate,
    days: Array.from({ length: dayCount }, (_, index) => {
      const key = addDays(startDate, index);
      const date = parseDate(key);
      const dayOfWeek = date.getUTCDay();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();

      return {
        key,
        label: `${month}/${day}`,
        weekLabel: `${month}/${day} 周`,
        isWeekStart: dayOfWeek === 1 || index === 0,
        isToday: key === today
      };
    })
  };
}

export function daysBetween(startDate: string, endDate: string) {
  return Math.round((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / DAY_MS);
}

export function addDays(dateKey: string, offset: number) {
  return toDateKey(new Date(parseDate(dateKey).getTime() + offset * DAY_MS));
}

function minDate(values: string[]) {
  return values.reduce((current, value) => (daysBetween(value, current) > 0 ? value : current), values[0]);
}

function maxDate(values: string[]) {
  return values.reduce((current, value) => (daysBetween(current, value) > 0 ? value : current), values[0]);
}

function parseDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
