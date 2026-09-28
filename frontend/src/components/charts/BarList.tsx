export interface BarRow {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  color: string;
}

interface Props {
  rows: BarRow[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  formatValue?: (n: number) => string;
}

// Ranked horizontal bars: 16px thick, 4px rounded data-end and square at the
// baseline, value at the tip in ink (never the bar color). Rows are buttons
// so a tap selects one for detail.
export default function BarList({ rows, selectedKey, onSelect, formatValue = String }: Props) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-slate-400">No data yet.</p>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const selected = selectedKey === r.key;
        return (
          <li key={r.key}>
            <button
              onClick={() => onSelect?.(r.key)}
              aria-pressed={selected}
              className={`grid w-full grid-cols-[minmax(0,9rem)_1fr] items-center gap-2 rounded px-1 py-1 text-left ${
                selected ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
            >
              <span className="truncate text-sm text-slate-800">
                {r.label}
                {r.sublabel && <span className="ml-1 text-xs text-slate-500">{r.sublabel}</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="block h-4 rounded-r"
                  style={{ width: `${Math.max(2, (r.value / max) * 85)}%`, background: r.color, borderRadius: "0 4px 4px 0" }}
                />
                <span className="text-xs font-semibold text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatValue(r.value)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
