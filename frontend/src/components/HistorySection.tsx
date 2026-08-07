import { useState } from "react";
import type { HistoryEntry } from "../types";
import { EQUIPMENT_TYPE_LABELS, parseSqliteUtc } from "../types";

function formatDateTime(sqliteUtc: string): string {
  return parseSqliteUtc(sqliteUtc).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Collapsible, lazy-fetched checkout/return log — used on both the cadet
// profile (variant="cadet", showing which item they had) and the equipment
// detail modal (variant="equipment", showing which cadet had it), same
// underlying equipment_assignment_history data either way.
export default function HistorySection({
  variant,
  fetchHistory,
}: {
  variant: "cadet" | "equipment";
  fetchHistory: () => Promise<HistoryEntry[]>;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        setEntries(await fetchHistory());
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
      >
        <span>History</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {loading && <p className="px-4 py-3 text-sm text-slate-400">Loading…</p>}
          {!loading && entries.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No history yet.</p>}
          {!loading && entries.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">{variant === "cadet" ? "Item" : "Cadet"}</th>
                  <th className="px-4 py-2">Checked out</th>
                  <th className="px-4 py-2">Checked in</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-2 text-slate-800">
                      {variant === "cadet" ? (
                        <>
                          {EQUIPMENT_TYPE_LABELS[entry.equipment_type]}{" "}
                          <span className="font-medium">{entry.equipment_tag}</span>
                        </>
                      ) : (
                        <>
                          {entry.cadet_name} <span className="text-xs text-slate-400">(Co. {entry.cadet_company})</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{formatDateTime(entry.checked_out_at)}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {entry.checked_in_at ? formatDateTime(entry.checked_in_at) : <span className="text-slate-400">Current</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
