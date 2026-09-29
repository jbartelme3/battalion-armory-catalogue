import { useState } from "react";
import type { BannerCategory, BannerEvent, BannerEventInput, BannerWeek } from "../types";
import { BANNER_COMPANIES } from "../types";
import { dayOptionLabel, todayIso, weekDates } from "./bannerUtils";

interface Props {
  week: BannerWeek;
  categories: BannerCategory[];
  initial?: BannerEvent;
  defaultCategory?: string;
  onSubmit: (data: BannerEventInput) => Promise<void>;
  onCancel: () => void;
}

// Records one event for all three companies at once, so an event can never
// be scored for one company and left blank (silently zero) for another.
export default function BannerEventForm({ week, categories, initial, defaultCategory, onSubmit, onCancel }: Props) {
  const dates = weekDates(week);
  const today = todayIso();
  const [category, setCategory] = useState(initial?.category ?? defaultCategory ?? "");
  const [date, setDate] = useState(initial?.event_date ?? (dates.includes(today) ? today : dates[0]));
  const [gigs, setGigs] = useState<Record<string, string>>(() =>
    Object.fromEntries(BANNER_COMPANIES.map((c) => [c, initial ? String(initial.gigs[c]) : ""])),
  );
  const [inspected, setInspected] = useState<Record<string, string>>(() =>
    Object.fromEntries(BANNER_COMPANIES.map((c) => [c, initial?.inspected[c] ? String(initial.inspected[c]) : ""])),
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cat = categories.find((c) => c.key === category);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cat) return setError("Pick a category.");
    if (BANNER_COMPANIES.some((c) => gigs[c].trim() === "")) {
      return setError("Enter a number for every company. Use 0 if a company had none.");
    }
    setSaving(true);
    try {
      await onSubmit({
        category,
        event_date: date,
        gigs: { A: gigs.A, B: gigs.B, C: gigs.C },
        inspected: cat.perCadet
          ? { A: inspected.A || null, B: inspected.B || null, C: inspected.C || null }
          : { A: null, B: null, C: null },
        note,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{initial ? "Edit scores" : "Record scores"}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1 ${inputClass}`}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Day
          <select value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inputClass}`}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {dayOptionLabel(d, week)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cat?.hint && <p className="text-xs text-slate-500">{cat.hint}</p>}

      <div>
        <div className="text-sm font-medium text-slate-700">Gigs</div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {BANNER_COMPANIES.map((c) => (
            <label key={c} className="block text-xs font-semibold text-slate-500">
              C{c}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={category === "accountability" ? "0.5" : "1"}
                value={gigs[c]}
                onChange={(e) => setGigs((prev) => ({ ...prev, [c]: e.target.value }))}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          ))}
        </div>
      </div>

      {cat?.perCadet && (
        <div>
          <div className="text-sm font-medium text-slate-700">Cadets inspected</div>
          <p className="text-xs text-slate-500">
            Scored per cadet. Leave blank to use the company's full strength; fill in if only part was inspected (e.g. one squad).
          </p>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {BANNER_COMPANIES.map((c) => (
              <input
                key={c}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder={String(week.strengths[c])}
                value={inspected[c]}
                onChange={(e) => setInspected((prev) => ({ ...prev, [c]: e.target.value }))}
                aria-label={`C${c} cadets inspected`}
                className={inputClass}
              />
            ))}
          </div>
        </div>
      )}

      <label className="block text-sm font-medium text-slate-700">
        Note <span className="font-normal text-slate-400">(optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Inspected by Major Smith"
          className={`mt-1 ${inputClass}`}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
