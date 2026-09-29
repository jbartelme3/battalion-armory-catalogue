import { staffApi } from "../../api/client";
import type { StaffData, StaffKind } from "../../types";
import { formatDay, todayIso } from "../bannerUtils";

// Record type definitions rarely change; fetch once per page load.
let kindsPromise: Promise<StaffKind[]> | null = null;
export function loadKinds(): Promise<StaffKind[]> {
  kindsPromise ??= staffApi.kinds().catch((err) => {
    kindsPromise = null;
    throw err;
  });
  return kindsPromise;
}

// "Mon 9/28 14:30"
export function formatDateTime(v: string): string {
  const [d, t] = v.split("T");
  return `${formatDay(d)} ${t ?? ""}`.trim();
}

export function nowLocalDateTime(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function hoursBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
}

export type Tone = "red" | "amber" | "green" | "slate" | "blue";

export interface Badge {
  label: string;
  tone: Tone;
}

export const TONE_CLASSES: Record<Tone, string> = {
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
};

// Whether a record still needs action: open status, an unexpired order, a
// laundry notice still waiting, or completed training not yet evaluated.
export function isActive(kind: StaffKind, data: StaffData): boolean {
  if (kind.key === "orders") {
    const today = todayIso();
    return !data.expires || String(data.expires) >= today;
  }
  // Completed training stays active until someone records how it went.
  if (kind.key === "training" && data.status === "Completed" && !data.evaluation) return true;
  if (kind.statusField && kind.openStatuses) return kind.openStatuses.includes(String(data[kind.statusField]));
  return true;
}

// Laundry must be picked up within 24 hours of notification (CMA 3-1).
export function laundryState(data: StaffData): { overdue: boolean; label: string } {
  const notified = String(data.notified);
  if (data.status === "Picked up" && data.picked_up) {
    const h = hoursBetween(notified, String(data.picked_up));
    return h > 24 ? { overdue: true, label: `Picked up late (${Math.round(h)}h)` } : { overdue: false, label: `Picked up in ${Math.max(0, Math.round(h))}h` };
  }
  const h = hoursBetween(notified, nowLocalDateTime());
  return h > 24 ? { overdue: true, label: `Overdue by ${Math.round(h - 24)}h` } : { overdue: false, label: `Due in ${Math.max(0, Math.round(24 - h))}h` };
}

export function recordBadges(kind: StaffKind, data: StaffData): Badge[] {
  const badges: Badge[] = [];
  switch (kind.key) {
    case "orders": {
      const today = todayIso();
      if (data.expires && String(data.expires) < today) badges.push({ label: "Expired", tone: "slate" });
      else if (String(data.effective) > today) badges.push({ label: "Upcoming", tone: "blue" });
      else badges.push({ label: "In effect", tone: "green" });
      badges.push({ label: String(data.type), tone: "slate" });
      break;
    }
    case "morale": {
      const n = Number(String(data.rating).charAt(0));
      badges.push({ label: String(data.rating), tone: n >= 4 ? "green" : n === 3 ? "slate" : n === 2 ? "amber" : "red" });
      if (data.follow_up === "Follow-up needed") badges.push({ label: "Follow-up needed", tone: "amber" });
      break;
    }
    case "training": {
      badges.push({ label: String(data.status), tone: data.status === "Completed" ? "green" : data.status === "Cancelled" ? "slate" : "blue" });
      if (data.evaluation) {
        const e = String(data.evaluation);
        badges.push({ label: e, tone: e === "Met standard" ? "green" : e === "Partially met" ? "amber" : "red" });
      } else if (data.status === "Completed") {
        badges.push({ label: "Needs evaluation", tone: "amber" });
      }
      break;
    }
    case "laundry": {
      const s = laundryState(data);
      badges.push({ label: s.label, tone: s.overdue ? "red" : data.status === "Picked up" ? "green" : "amber" });
      break;
    }
    case "work_orders": {
      const s = String(data.status);
      badges.push({ label: s, tone: s === "Completed" ? "green" : s === "Open" ? "amber" : "blue" });
      break;
    }
    case "inspections": {
      const r = String(data.rating);
      badges.push({ label: `${data.type} · ${r}`, tone: r === "Unsatisfactory" ? "red" : r === "Outstanding" ? "green" : "slate" });
      if (data.corrected === "Correction needed") badges.push({ label: "Correction needed", tone: "amber" });
      break;
    }
    case "first_sgt_reports": {
      const unexcused = Number(data.unexcused);
      badges.push({ label: `${data.present}/${data.assigned} present`, tone: "slate" });
      if (unexcused > 0) badges.push({ label: `${unexcused} unexcused`, tone: "red" });
      badges.push({ label: String(data.submitted), tone: data.submitted === "Submitted" ? "green" : "amber" });
      break;
    }
    case "police_areas":
      badges.push({ label: String(data.condition), tone: data.condition === "Good" ? "green" : "amber" });
      break;
  }
  return badges;
}

// The one-tap update offered on a record, if any: the common next step
// without opening the full form.
export function quickAction(kind: StaffKind, data: StaffData): { label: string; data: StaffData } | null {
  if (kind.key === "laundry" && data.status === "Waiting") {
    return { label: "Mark picked up now", data: { ...data, status: "Picked up", picked_up: nowLocalDateTime() } };
  }
  if (kind.key === "first_sgt_reports" && data.submitted === "Not yet submitted") {
    return { label: "Mark submitted", data: { ...data, submitted: "Submitted" } };
  }
  if (kind.key === "work_orders" && data.status !== "Completed") {
    return { label: "Mark completed today", data: { ...data, status: "Completed", completed: todayIso() } };
  }
  return null;
}

// Blank form values: today for required dates, now for required
// date-times, the first option for required selects.
export function emptyData(kind: StaffKind): StaffData {
  const data: StaffData = {};
  for (const f of kind.fields) {
    if (f.type === "date" && f.required) data[f.key] = todayIso();
    else if (f.type === "datetime" && f.required) data[f.key] = nowLocalDateTime();
    else if (f.type === "select" && f.required) data[f.key] = f.options?.[0] ?? "";
    else data[f.key] = "";
  }
  return data;
}

export function formatValue(type: string, v: string | number | null): string {
  if (v === null || v === "") return "—";
  if (type === "date") return formatDay(String(v));
  if (type === "datetime") return formatDateTime(String(v));
  if (type === "company") return `Company ${v}`;
  return String(v);
}
