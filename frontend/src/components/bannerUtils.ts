import { useState } from "react";
import type { BannerWeek } from "../types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  return new Date(parseDate(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

// "Sun 9/27"
export function formatDay(iso: string): string {
  const d = parseDate(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// Every date in the week, both boundary days included. The first is the
// afternoon the week starts; the last is the morning it ends.
export function weekDates(week: Pick<BannerWeek, "start_date" | "end_date">): string[] {
  const dates: string[] = [];
  for (let d = week.start_date; d <= week.end_date; d = addDays(d, 1)) dates.push(d);
  return dates;
}

export function dayOptionLabel(iso: string, week: Pick<BannerWeek, "start_date" | "end_date">): string {
  if (iso === week.start_date) return `${formatDay(iso)} (afternoon)`;
  if (iso === week.end_date) return `${formatDay(iso)} (morning)`;
  return formatDay(iso);
}

export function weekLabel(week: Pick<BannerWeek, "start_date" | "end_date">): string {
  return `${formatDay(week.start_date)} – ${formatDay(week.end_date)}`;
}

export function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

// "9/27"
export function shortDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// Academic year a week belongs to, e.g. a week starting 2026-09-27 -> "2026–27".
export function seasonOf(week: Pick<BannerWeek, "start_date">): string {
  const [y, m] = week.start_date.split("-").map(Number);
  const start = m >= 7 ? y : y - 1;
  return `${start}–${String(start + 1).slice(2)}`;
}

// One fixed color per company, validated as a set (CVD-safe, all pairs).
// Company C's aqua is under 3:1 on white, so charts always pair it with a
// legend, direct labels or a table view.
export const COMPANY_COLORS: Record<"A" | "B" | "C", string> = {
  A: "#2a78d6",
  B: "#eb6834",
  C: "#1baf7a",
};

// Per-cadet totals are fractions; everything else is a whole or half count.
export function formatTotal(n: number, perCadet: boolean): string {
  return perCadet ? n.toFixed(3) : String(Math.round(n * 100) / 100);
}

// The standings that count for a week: what was announced once finalized,
// otherwise the live calculation.
export function effectiveStandings(week: BannerWeek) {
  if (week.status === "final" && week.announced) return week.announced;
  return week.result;
}

// Name recorded against every banner change. Remembered per browser so the
// Sergeant Major (or a Bat Staff substitute) only types it once.
const ACTOR_KEY = "banner.actorName";

export function useActorName(): [string, (name: string) => void] {
  const [name, setName] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTOR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  function save(next: string) {
    setName(next);
    try {
      localStorage.setItem(ACTOR_KEY, next);
    } catch {
      // Storage unavailable (private mode); the name still lasts this visit.
    }
  }
  return [name, save];
}
