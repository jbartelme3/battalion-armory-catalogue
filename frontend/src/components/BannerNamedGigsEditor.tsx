import { useState } from "react";
import type { BannerCompany, BannerNamedGigInput, Cadet } from "../types";
import { BANNER_COMPANIES } from "../types";

interface Props {
  value: BannerNamedGigInput[];
  onChange: (next: BannerNamedGigInput[]) => void;
  roster: Cadet[];
  gigs: Record<BannerCompany, string>;
}

const inputClass =
  "rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

// Optional: attribute some of an event's gigs to individual cadets. Names
// come from the Armorer roster; a name typed in that isn't on the roster
// is kept as text with a company picked by hand.
export default function BannerNamedGigsEditor({ value, onChange, roster, gigs }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? roster
        .filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.last_name.toLowerCase().startsWith(q))
        .filter((c) => !value.some((v) => v.cadet_id === c.id))
        .slice(0, 8)
    : [];

  function add(row: BannerNamedGigInput) {
    onChange([...value, row]);
    setQuery("");
  }

  function update(i: number, patch: Partial<BannerNamedGigInput>) {
    onChange(value.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  return (
    <div>
      <div className="text-sm font-medium text-slate-700">
        Who was gigged? <span className="font-normal text-slate-400">(optional)</span>
      </div>
      <p className="text-xs text-slate-500">
        For individual tracking. Doesn't change the score; a company's named gigs can't exceed its count above.
      </p>

      <div className="relative mt-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the roster by name…"
          className={`w-full ${inputClass}`}
        />
        {q && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
            {matches.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() =>
                  add({ cadet_id: c.id, cadet_name: `${c.first_name} ${c.last_name}`, company: c.company, count: 1, reason: "" })
                }
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span>
                  {c.last_name}, {c.first_name}
                </span>
                <span className="text-xs text-slate-500">C{c.company}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => add({ cadet_id: null, cadet_name: query.trim(), company: "A", count: 1, reason: "" })}
              className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
            >
              Add “{query.trim()}” (not on the roster)
            </button>
          </div>
        )}
      </div>

      {value.length > 0 && (
        <ul className="mt-2 space-y-2">
          {value.map((row, i) => (
            <li key={`${row.cadet_id ?? row.cadet_name}-${i}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{row.cadet_name}</span>
                <div className="flex items-center gap-2">
                  {row.cadet_id === null ? (
                    <select
                      value={row.company}
                      onChange={(e) => update(i, { company: e.target.value as BannerCompany })}
                      aria-label={`${row.cadet_name} company`}
                      className={inputClass}
                    >
                      {BANNER_COMPANIES.map((c) => (
                        <option key={c} value={c}>
                          C{c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-500">C{row.company}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                    aria-label={`Remove ${row.cadet_name}`}
                    className="px-1 text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.5"
                  step="0.5"
                  value={row.count}
                  onChange={(e) => update(i, { count: e.target.value })}
                  aria-label={`${row.cadet_name} gigs`}
                  className={`w-16 ${inputClass}`}
                />
                <input
                  value={row.reason}
                  onChange={(e) => update(i, { reason: e.target.value })}
                  placeholder="Reason (e.g. bed not made)"
                  aria-label={`${row.cadet_name} reason`}
                  className={`min-w-0 flex-1 ${inputClass}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {value.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {BANNER_COMPANIES.map((c) => {
            const named = value.filter((v) => v.company === c).reduce((sum, v) => sum + (Number(v.count) || 0), 0);
            const total = Number(gigs[c]) || 0;
            return (
              <span key={c} className={`mr-3 ${named > total ? "font-semibold text-red-600" : ""}`}>
                C{c}: {named} of {total} named
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
