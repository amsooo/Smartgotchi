// Pomocnicze funkcje czasu. Wszystko, co widzi użytkownik, liczymy w czasie polskim.
// Intl sam uwzględnia czas letni i zimowy, więc nie musimy o tym pamiętać.
import { TIMEZONE } from "./config";

const WEEKDAYS: Record<string, string> = {
  Mon: "poniedziałek",
  Tue: "wtorek",
  Wed: "środa",
  Thu: "czwartek",
  Fri: "piątek",
  Sat: "sobota",
  Sun: "niedziela",
};

const MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

export interface WarsawTime {
  date: string; // "2026-11-13"
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  minutesOfDay: number; // np. 8:30 → 510
  weekday: string; // "piątek"
  dateLong: string; // "13 listopada 2026"
  time: string; // "14:05"
}

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

/** Zwraca aktualny (lub podany) moment w czasie polskim. */
export function warsawTime(ts: number = Date.now()): WarsawTime {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(new Date(ts))) parts[p.type] = p.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    year,
    month,
    day,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    weekday: WEEKDAYS[parts.weekday] ?? parts.weekday,
    dateLong: `${day} ${MONTHS[month - 1]} ${year}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Ile dni kalendarzowych dzieli dwie daty "RRRR-MM-DD" (b - a). */
export function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / 86_400_000);
}

/** Dodaje dni do daty "RRRR-MM-DD". */
export function addDays(date: string, days: number): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + days));
  return d.toISOString().slice(0, 10);
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
