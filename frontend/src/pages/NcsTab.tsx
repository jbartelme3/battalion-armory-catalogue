import { useEffect, useState } from "react";
import { ncsApi } from "../api/client";
import type { NcsEntry, NcsProgress } from "../types";
import { BANNER_COMPANIES, NCS_PHASES } from "../types";
import ActorBar, { useActorName } from "../components/ActorBar";
import { formatDay } from "../components/bannerUtils";

type Company = "A" | "B" | "C";

const MILESTONES: { key: keyof NcsProgress; label: string }[] = [
  { key: "specialty_test_date", label: "Military specialty test passed" },
  { key: "boards_book_date", label: "Boards book issued" },
  { key: "boards_invited_date", label: "Invited to boards" },
  { key: "boards_passed_date", label: "Passed boards" },
];

// New Cadet System tracker for the Battalion Adjutant (CMA 3-2.2): where
// every new cadet stands in phases I–V, the boards milestones, and Black
// Stripers. The Corps goal is every new cadet invited to boards by Spring Break.
export default function NcsTab() {
  const [actor, setActor] = useActorName();
  const [entries, setEntries] = useState<NcsEntry[] | null>(null);
  const [company, setCompany] = useState<Company | "all">("all");
  const [phase, setPhase] = useState<number | "all">("all");
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ncsApi
      .list()
      .then(setEntries)
      .catch((err) => setError(err.message));
  }, []);

  if (error && !entries) return <p className="text-sm text-red-600">{error}</p>;
  if (!entries) return <p className="text-sm text-slate-400">Loading…</p>;

  const visible = entries.filter(
    (e) => (company === "all" || e.cadet.company === company) && (phase === "all" || e.progress.phase === phase),
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">New Cadet System</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Every new cadet on the Armorer roster, by phase (CMA 3-2.2). Goal: all new cadets invited to boards by Spring Break.
        </p>
      </div>

      <ActorBar actor={actor} onChange={setActor} />

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
          No new cadets on the roster. Cadets with the rank or position “New Cadet” in Armorer → Cadets appear here.
        </p>
      ) : (
        <>
          <Summary entries={entries} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs">
              {(["all", ...BANNER_COMPANIES] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCompany(c)}
                  className={`px-3 py-1.5 font-semibold ${company === c ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
                >
                  {c === "all" ? "All" : `C${c}`}
                </button>
              ))}
            </div>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="all">All phases</option>
              {Object.entries(NCS_PHASES).map(([n, label]) => (
                <option key={n} value={n}>
                  Phase {label}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-slate-400">
              {visible.length} of {entries.length}
            </span>
          </div>

          <ul className="space-y-2">
            {visible.map((e) => (
              <li key={e.cadet.id} className="rounded-lg border border-slate-200 bg-white">
                <button onClick={() => setEditing(editing === e.cadet.id ? null : e.cadet.id)} className="w-full px-4 py-3 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {e.cadet.last_name}, {e.cadet.first_name}
                      <span className="ml-1.5 text-xs font-normal text-slate-500">C{e.cadet.company}</span>
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      Phase {NCS_PHASES[e.progress.phase].split(" · ")[0]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    {e.progress.black_striper && (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-700 ring-1 ring-inset ring-red-200">Black Striper</span>
                    )}
                    {e.progress.boards_passed_date ? (
                      <span className="text-emerald-700">Passed boards {formatDay(e.progress.boards_passed_date)}</span>
                    ) : e.progress.boards_invited_date ? (
                      <span className="text-blue-700">Invited to boards {formatDay(e.progress.boards_invited_date)}</span>
                    ) : (
                      <span className="text-slate-500">Not yet invited to boards</span>
                    )}
                    {!e.progress.tracked && <span className="text-slate-400">· not updated yet</span>}
                  </div>
                </button>
                {editing === e.cadet.id && (
                  <ProgressForm
                    entry={e}
                    canWrite={actor.trim().length > 0}
                    onCancel={() => setEditing(null)}
                    onSave={async (data) => {
                      const updated = await ncsApi.update(e.cadet.id, data, actor);
                      setEntries((prev) => prev!.map((x) => (x.cadet.id === e.cadet.id ? updated : x)));
                      setEditing(null);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Summary({ entries }: { entries: NcsEntry[] }) {
  const invited = entries.filter((e) => e.progress.boards_invited_date).length;
  const pct = Math.round((invited / entries.length) * 100);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold text-slate-900">Invited to boards</span>
        <span className="text-sm text-slate-600">
          <span className="font-bold text-slate-900">{invited}</span> of {entries.length} ({pct}%)
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
      <table className="mt-3 w-full text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr className="text-slate-500">
            <th className="py-1 text-left font-semibold">Phase</th>
            {BANNER_COMPANIES.map((c) => (
              <th key={c} className="w-12 py-1 text-right font-semibold">
                C{c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(NCS_PHASES).map(([n, label]) => (
            <tr key={n} className="border-t border-slate-100 text-slate-700">
              <td className="py-1">{label}</td>
              {BANNER_COMPANIES.map((c) => (
                <td key={c} className="py-1 text-right">
                  {entries.filter((e) => e.cadet.company === c && e.progress.phase === Number(n)).length || "–"}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-slate-100 text-red-700">
            <td className="py-1">Black Stripers</td>
            {BANNER_COMPANIES.map((c) => (
              <td key={c} className="py-1 text-right">
                {entries.filter((e) => e.cadet.company === c && e.progress.black_striper).length || "–"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ProgressForm({
  entry,
  canWrite,
  onSave,
  onCancel,
}: {
  entry: NcsEntry;
  canWrite: boolean;
  onSave: (data: Omit<NcsProgress, "tracked" | "updated_by" | "updated_at">) => Promise<void>;
  onCancel: () => void;
}) {
  const p = entry.progress;
  const [phase, setPhase] = useState(p.phase);
  const [blackStriper, setBlackStriper] = useState(p.black_striper);
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(MILESTONES.map((m) => [m.key, (p[m.key] as string | null) ?? ""])),
  );
  const [notes, setNotes] = useState(p.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputClass =
    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await onSave({
            phase,
            black_striper: blackStriper,
            specialty_test_date: dates.specialty_test_date || null,
            boards_book_date: dates.boards_book_date || null,
            boards_invited_date: dates.boards_invited_date || null,
            boards_passed_date: dates.boards_passed_date || null,
            notes: notes || null,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save.");
        }
      }}
      className="space-y-3 border-t border-slate-100 px-4 py-3"
    >
      <label className="block text-sm font-medium text-slate-700">
        Phase
        <select value={phase} onChange={(e) => setPhase(Number(e.target.value))} className={inputClass}>
          {Object.entries(NCS_PHASES).map(([n, label]) => (
            <option key={n} value={n}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        {MILESTONES.map((m) => (
          <label key={m.key} className="block text-xs font-medium text-slate-700">
            {m.label}
            <input
              type="date"
              value={dates[m.key]}
              onChange={(e) => setDates((prev) => ({ ...prev, [m.key]: e.target.value }))}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={blackStriper} onChange={(e) => setBlackStriper(e.target.checked)} />
        Black Striper (missed the boards deadline)
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Notes <span className="font-normal text-slate-400">(optional)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </label>
      {p.updated_by && <p className="text-[11px] text-slate-400">Last updated by {p.updated_by}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canWrite}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
