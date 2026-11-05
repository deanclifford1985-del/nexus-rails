import { B } from './balance.js';

// Game time is kept as whole minutes since Year 1, Month 1, Day 1, 00:00.
// 30-day months, 12-month years, 7-day weeks.
const MIN_DAY = 24 * 60;

export const dayIndex = (minutes) => Math.floor(minutes / MIN_DAY); // 0-based
export const weekOf = (minutes) => Math.floor(dayIndex(minutes) / B.WEEK.days);

export function dateOf(minutes) {
  const C = B.CALENDAR;
  const d = dayIndex(minutes);
  const monthIndex = Math.floor(d / C.daysPerMonth);
  const year = Math.floor(monthIndex / C.monthsPerYear) + 1;
  const month = (monthIndex % C.monthsPerYear) + 1;
  const day = (d % C.daysPerMonth) + 1;
  const minuteOfDay = ((minutes % MIN_DAY) + MIN_DAY) % MIN_DAY;
  return { year, month, day, hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60, dayIndex: d, monthIndex, week: weekOf(minutes) };
}

const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (minutes) => {
  const d = dateOf(minutes);
  return `Day ${d.day}, Month ${d.month}, Year ${d.year}`;
};
export const fmtShortDate = (minutes) => {
  const d = dateOf(minutes);
  return `D${d.day} M${d.month} Y${d.year}`;
};
export const fmtTime = (minutes) => {
  const d = dateOf(minutes);
  return `${pad(d.hour)}:${pad(d.minute)}`;
};
// A length of game time, e.g. "1 d 6 h" or "4 h 20 m".
export function fmtSpan(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const days = Math.floor(m / MIN_DAY);
  const hours = Math.floor((m % MIN_DAY) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  return `${hours} h ${m % 60} m`;
}

// The Locomotive Festival: the first days of every third month (months 3, 6, 9, 12).
// Each festival has an id so its contests can be entered once.
export function festivalInfo(minutes) {
  const C = B.CALENDAR;
  const d = dateOf(minutes);
  const every = C.festivalEveryMonths;
  const active = d.month % every === 0 && d.day <= C.festivalDays;
  const id = active ? `${d.year}-${d.month}` : null;
  // The next festival's first day.
  let monthIndex = d.monthIndex + (active ? every : 0);
  while ((monthIndex % C.monthsPerYear) % every !== every - 1) monthIndex += 1;
  if (!active && monthIndex === d.monthIndex) monthIndex += every;
  const nextAt = monthIndex * C.daysPerMonth * MIN_DAY;
  const endsAt = active ? (d.monthIndex * C.daysPerMonth + C.festivalDays) * MIN_DAY : null;
  return { active, id, nextAt, endsAt };
}

// Minutes a run takes on the calendar: the trip itself plus the turnaround.
export const runMinutes = (gameSeconds) => Math.round((gameSeconds ?? 0) / 60 + B.CALENDAR.turnaroundHours * 60);
