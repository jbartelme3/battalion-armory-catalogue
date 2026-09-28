import { useEffect, useRef, useState } from "react";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

interface Props {
  xLabels: string[];
  // Longer label for each x position, shown in the tooltip and table.
  xDetails?: string[];
  series: LineSeries[];
  formatY?: (n: number) => string;
  zeroBased?: boolean;
  height?: number;
}

const MARGIN = { top: 12, right: 52, bottom: 24, left: 36 };
const GRID = "#e2e8f0";
const AXIS_TEXT = "#64748b";
const INK = "#0f172a";
const SURFACE = "#ffffff";

// Round a raw tick step up to 1, 2, 2.5 or 5 x 10^k.
function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function ticksFor(min: number, max: number): number[] {
  if (min === max) max = min + 1;
  const step = niceStep((max - min) / 4);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 0.5; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
}

// Multi-series line chart: 2px lines, ringed markers, hairline grid, a legend,
// direct end-labels when they don't collide, a hover crosshair + tooltip, and
// a table view.
export default function LineChart({ xLabels, xDetails, series, formatY = String, zeroBased = false, height = 200 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (xLabels.length === 0 || all.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No data yet.</p>;
  }

  const ticks = ticksFor(zeroBased ? 0 : Math.min(...all), Math.max(...all));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const n = xLabels.length;
  const x = (i: number) => MARGIN.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => MARGIN.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  // Only label every k-th x tick so labels never overlap.
  const labelEvery = Math.max(1, Math.ceil((n * 34) / plotW));

  // End labels: last non-null point of each series. Skip them all if any two
  // would collide; the legend and tooltip still carry identity.
  const ends = series
    .map((s) => {
      let i = s.values.length - 1;
      while (i >= 0 && s.values[i] === null) i--;
      return i >= 0 ? { s, i, v: s.values[i] as number, py: y(s.values[i] as number) } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.py - b.py);
  const endLabelsFit = ends.every((e, k) => k === 0 || e.py - ends[k - 1].py >= 13);

  function handleMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n === 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const tipLeft = hover !== null ? x(hover) : 0;
  const tipOnLeft = tipLeft > width * 0.6;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color, height: 2 }} />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={wrapRef} className="relative">
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={MARGIN.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={AXIS_TEXT} style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatY(t)}
              </text>
            </g>
          ))}
          {xLabels.map((label, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
                {label}
              </text>
            ) : null,
          )}

          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="#94a3b8" strokeWidth={1} />}

          {series.map((s) => {
            // Break the line at gaps instead of bridging them.
            const segments: string[] = [];
            let current = "";
            s.values.forEach((v, i) => {
              if (v === null) {
                if (current) segments.push(current);
                current = "";
              } else {
                current += `${current ? "L" : "M"}${x(i)},${y(v)}`;
              }
            });
            if (current) segments.push(current);
            return (
              <g key={s.key}>
                {segments.map((d, k) => (
                  <path key={k} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {s.values.map((v, i) =>
                  v === null ? null : (
                    <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
                  ),
                )}
              </g>
            );
          })}

          {endLabelsFit &&
            ends.map((e) => (
              <text key={e.s.key} x={x(e.i) + 9} y={e.py} dy="0.32em" fontSize={11} fill={INK} fontWeight={600}>
                {e.s.label.replace("Company ", "C")} {formatY(e.v)}
              </text>
            ))}

          <rect
            x={MARGIN.left - 8}
            y={MARGIN.top}
            width={plotW + 16}
            height={plotH}
            fill="transparent"
            onPointerMove={handleMove}
            onPointerDown={handleMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[8rem] rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-md"
            style={tipOnLeft ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }}
          >
            <div className="mb-1 font-semibold text-slate-900">{xDetails?.[hover] ?? xLabels[hover]}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {s.values[hover] === null ? "–" : formatY(s.values[hover] as number)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => setShowTable(!showTable)} className="mt-1 text-xs text-slate-500 underline hover:text-slate-800">
        {showTable ? "Hide table" : "Show as table"}
      </button>
      {showTable && (
        <table className="mt-2 w-full text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 font-semibold">Week</th>
              {series.map((s) => (
                <th key={s.key} className="py-1 text-right font-semibold">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {xLabels.map((label, i) => (
              <tr key={i} className="border-t border-slate-100 text-slate-700">
                <td className="py-1">{xDetails?.[i] ?? label}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1 text-right">
                    {s.values[i] === null ? "–" : formatY(s.values[i] as number)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
