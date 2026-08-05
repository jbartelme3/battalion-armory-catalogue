import { useState } from "react";
import { ApiError } from "../api/client";
import { ALL_POSITIONS, HG_LEADERSHIP_RANKS, HG_LINE_RANKS, HG_RANK_ABBREVIATIONS, RANKS, RANK_ABBREVIATIONS } from "../types";
import type { Cadet } from "../types";

export interface CadetFormValues {
  first_name: string;
  last_name: string;
  company: Cadet["company"];
  position: string;
  rank: string | null;
  is_honor_guard: boolean;
  hg_rank: string | null;
}

export default function CadetForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<CadetFormValues>;
  submitLabel: string;
  onSubmit: (values: CadetFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [company, setCompany] = useState<Cadet["company"]>(initial?.company ?? "A");
  const [position, setPosition] = useState(initial?.position ?? "New Cadet");
  const [rank, setRank] = useState(initial?.rank ?? "New Cadet");
  const [isHonorGuard, setIsHonorGuard] = useState(initial?.is_honor_guard ?? false);
  const [hgRank, setHgRank] = useState(initial?.hg_rank ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        first_name: firstName,
        last_name: lastName,
        company,
        position,
        rank: rank || null,
        is_honor_guard: isHonorGuard,
        hg_rank: isHonorGuard ? hgRank || null : null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">First name</label>
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Last name</label>
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Unit (Company)</label>
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value as Cadet["company"])}
            className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="A">Company A</option>
            <option value="B">Company B</option>
            <option value="C">Company C</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Rank</label>
          <select
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {r} ({RANK_ABBREVIATIONS[r]})
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600">Position</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            {ALL_POSITIONS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label} ({p.abbrev}){p.exempt ? " — rifle-exempt" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isHonorGuard} onChange={(e) => setIsHonorGuard(e.target.checked)} />
        Member of the Infantry Honor Guard
      </label>

      {isHonorGuard && (
        <div className="mt-2">
          <label className="block text-xs font-medium text-slate-600">Honor Guard rank</label>
          <select
            value={hgRank}
            onChange={(e) => setHgRank(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Not set</option>
            <optgroup label="Leadership (rifle + bayonet exempt)">
              {HG_LEADERSHIP_RANKS.map((r) => (
                <option key={r} value={r}>
                  {r} ({HG_RANK_ABBREVIATIONS[r]})
                </option>
              ))}
            </optgroup>
            <optgroup label="Guardsmen (rifle-carrying)">
              {HG_LINE_RANKS.map((r) => (
                <option key={r} value={r}>
                  {r} ({HG_RANK_ABBREVIATIONS[r]})
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
