import { useEffect, useState } from "react";
import { bannerApi, cadetsApi } from "../api/client";
import type { BannerCategory, BannerCompany, BannerGigRecord, BannerWeek, Cadet } from "../types";
import { BANNER_COMPANIES } from "../types";
import LineChart from "../components/charts/LineChart";
import BarList from "../components/charts/BarList";
import { COMPANY_COLORS, effectiveStandings, formatDay, seasonOf, shortDate, weekLabel } from "../components/bannerUtils";

// Ordinal blue ramp for "average place" cells: 1st (light) -> 3rd (dark).
const PLACE_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf"];

function placeColor(avg: number): { bg: string; fg: string } {
  const i = Math.round(((avg - 1) / 2) * (PLACE_RAMP.length - 1));
  const step = Math.max(0, Math.min(PLACE_RAMP.length - 1, i));
  return { bg: PLACE_RAMP[step], fg: step >= 3 ? "#ffffff" : "#0f172a" };
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface CadetGigs {
  name: string;
  company: BannerCompany;
  total: number;
  records: BannerGigRecord[];
}

function cadetKey(g: BannerGigRecord): string {
  return g.cadet_id !== null ? `id:${g.cadet_id}` : `name:${g.company}:${g.cadet_name.toLowerCase()}`;
}

export default function BannerTrendsTab() {
  const [weeks, setWeeks] = useState<BannerWeek[] | null>(null);
  const [categories, setCategories] = useState<BannerCategory[]>([]);
  const [gigs, setGigs] = useState<BannerGigRecord[]>([]);
  const [season, setSeason] = useState<string | null>(null);
  const [trendCategory, setTrendCategory] = useState("rooms");
  const [gigCompany, setGigCompany] = useState<BannerCompany | "all">("all");
  const [gigCategory, setGigCategory] = useState("all");
  const [selectedCadet, setSelectedCadet] = useState<string | null>(null);
  const [showAllCadets, setShowAllCadets] = useState(false);
  const [rankQuery, setRankQuery] = useState("");
  const [roster, setRoster] = useState<Cadet[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([bannerApi.weeks(), bannerApi.gigs()])
      .then(([{ weeks, categories }, gigs]) => {
        setWeeks(weeks);
        setCategories(categories);
        setGigs(gigs);
        if (weeks.length) setSeason(seasonOf(weeks[weeks.length - 1]));
      })
      .catch((err) => setError(err.message));
    // The roster only adds zero-gig cadets to the full rankings; without it
    // the rankings still list everyone who has been named.
    cadetsApi
      .list()
      .then(setRoster)
      .catch(() => {});
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!weeks) return <p className="text-sm text-slate-400">Loading…</p>;
  if (weeks.length === 0) return <p className="text-sm text-slate-500">No banner weeks recorded yet.</p>;

  const seasons = [...new Set(weeks.map(seasonOf))];
  const finals = weeks.filter((w) => seasonOf(w) === season && w.status === "final");
  const xLabels = finals.map((w) => shortDate(w.start_date));
  const xDetails = finals.map((w) => weekLabel(w));
  const trendCat = categories.find((c) => c.key === trendCategory);

  // Individual gigs this season, filtered, grouped by cadet.
  const seasonGigs = gigs.filter((g) => seasonOf({ start_date: g.week_start }) === season);
  const filtered = seasonGigs.filter(
    (g) => (gigCompany === "all" || g.company === gigCompany) && (gigCategory === "all" || g.category === gigCategory),
  );
  const byCadet = new Map<string, CadetGigs>();
  for (const g of filtered) {
    const key = cadetKey(g);
    const entry = byCadet.get(key) ?? { name: g.cadet_name, company: g.company, total: 0, records: [] };
    entry.total += g.count;
    entry.records.push(g);
    byCadet.set(key, entry);
  }
  const ranked = [...byCadet.entries()].sort((a, b) => b[1].total - a[1].total || a[1].name.localeCompare(b[1].name));
  const selected = selectedCadet ? byCadet.get(selectedCadet) : undefined;

  // Full battalion rankings: every cadet on the roster (zero gigs included)
  // plus any named cadets not on it. Ties share a rank (1, 2, 2, 4).
  const everyone = new Map(byCadet);
  for (const c of roster) {
    const key = `id:${c.id}`;
    if ((gigCompany === "all" || c.company === gigCompany) && !everyone.has(key)) {
      everyone.set(key, { name: `${c.first_name} ${c.last_name}`, company: c.company, total: 0, records: [] });
    }
  }
  const standings: { key: string; entry: CadetGigs; rank: number }[] = [];
  for (const [key, entry] of [...everyone.entries()].sort(
    (a, b) => b[1].total - a[1].total || a[1].name.localeCompare(b[1].name),
  )) {
    const prev = standings[standings.length - 1];
    const rank = prev && prev.entry.total === entry.total ? prev.rank : standings.length + 1;
    standings.push({ key, entry, rank });
  }
  const query = rankQuery.trim().toLowerCase();
  const visibleStandings = query ? standings.filter((s) => s.entry.name.toLowerCase().includes(query)) : standings;
  const canExpand = seasonGigs.length > 0 && standings.length > Math.min(10, ranked.length);
  const catLabel = (key: string) => categories.find((c) => c.key === key)?.label ?? key;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Trends</h2>
        {seasons.length > 1 && (
          <select
            value={season ?? ""}
            onChange={(e) => setSeason(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      <Card title="Weekly banner points" subtitle="Finalized weeks. Lower is better; the lowest total wins the banner.">
        <LineChart
          xLabels={xLabels}
          xDetails={xDetails}
          series={BANNER_COMPANIES.map((c) => ({
            key: c,
            label: `Company ${c}`,
            color: COMPANY_COLORS[c],
            values: finals.map((w) => effectiveStandings(w).scores[c]),
          }))}
        />
      </Card>

      <Card
        title="Category trend"
        subtitle={trendCat?.perCadet ? "Gigs per cadet each week, by company." : "Gigs each week, by company."}
      >
        <select
          value={trendCategory}
          onChange={(e) => setTrendCategory(e.target.value)}
          className="mb-3 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <LineChart
          xLabels={xLabels}
          xDetails={xDetails}
          zeroBased
          formatY={(n) => (trendCat?.perCadet ? n.toFixed(2) : String(Math.round(n * 10) / 10))}
          series={BANNER_COMPANIES.map((c) => ({
            key: c,
            label: `Company ${c}`,
            color: COMPANY_COLORS[c],
            values: finals.map((w) => {
              const cat = w.result.categories.find((x) => x.key === trendCategory);
              return cat && cat.eventCount > 0 ? cat.totals[c] : null;
            }),
          }))}
        />
      </Card>

      <Card
        title="Where each company loses points"
        subtitle="Average place per category over finalized weeks where it was scored. 1.0 = always 1st, 3.0 = always 3rd."
      >
        <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="pb-1 text-left font-semibold">Category</th>
              {BANNER_COMPANIES.map((c) => (
                <th key={c} className="w-14 pb-1 text-center font-semibold">
                  C{c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const scored = finals
                .map((w) => w.result.categories.find((x) => x.key === cat.key))
                .filter((x): x is NonNullable<typeof x> => !!x && x.eventCount > 0);
              return (
                <tr key={cat.key} className="border-t border-slate-100">
                  <td className="py-1 pr-2 text-slate-800">
                    {cat.label}
                    <span className="ml-1 text-xs text-slate-400">{scored.length ? `· ${scored.length} wk` : "· none"}</span>
                  </td>
                  {BANNER_COMPANIES.map((c) => {
                    if (!scored.length) {
                      return (
                        <td key={c} className="py-1 text-center text-slate-300">
                          –
                        </td>
                      );
                    }
                    const avg = scored.reduce((sum, x) => sum + x.ranks[c], 0) / scored.length;
                    const { bg, fg } = placeColor(avg);
                    return (
                      <td key={c} className="p-0.5">
                        <div className="rounded py-1 text-center text-xs font-semibold" style={{ background: bg, color: fg }}>
                          {avg.toFixed(1)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card
        title="Most-gigged cadets"
        subtitle={
          showAllCadets
            ? "Every cadet in the battalion, ranked by named gigs this season. Tap a cadet to see each gig."
            : "Named gigs this season. Tap a cadet to see each gig."
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs">
            {(["all", ...BANNER_COMPANIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setGigCompany(c);
                  setSelectedCadet(null);
                }}
                className={`px-3 py-1.5 font-semibold ${gigCompany === c ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
              >
                {c === "all" ? "All" : `C${c}`}
              </button>
            ))}
          </div>
          <select
            value={gigCategory}
            onChange={(e) => {
              setGigCategory(e.target.value);
              setSelectedCadet(null);
            }}
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2 flex gap-4 text-xs text-slate-600">
          {BANNER_COMPANIES.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COMPANY_COLORS[c] }} />
              Company {c}
            </span>
          ))}
        </div>

        {seasonGigs.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            No cadets named yet. Add names under “Who was gigged?” when recording scores.
          </p>
        ) : showAllCadets ? (
          <>
            <input
              type="search"
              value={rankQuery}
              onChange={(e) => setRankQuery(e.target.value)}
              placeholder="Find a cadet"
              className="mb-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            />
            <div className="max-h-96 overflow-y-auto rounded-md border border-slate-200">
              <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="w-10 px-2 py-1.5 text-right font-semibold">#</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Cadet</th>
                    <th className="w-14 px-2 py-1.5 text-left font-semibold">Co.</th>
                    <th className="w-14 px-2 py-1.5 text-right font-semibold">Gigs</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStandings.map(({ key, entry, rank }) => {
                    const isSelected = selectedCadet === key;
                    return (
                      <tr key={key} className={`border-t border-slate-100 ${isSelected ? "bg-slate-100" : ""}`}>
                        <td className="px-2 py-1 text-right text-slate-500">{rank}</td>
                        <td className="px-2 py-1 text-slate-800">
                          {entry.total > 0 ? (
                            <button
                              onClick={() => setSelectedCadet(isSelected ? null : key)}
                              aria-pressed={isSelected}
                              className="w-full text-left hover:underline"
                            >
                              {entry.name}
                            </button>
                          ) : (
                            entry.name
                          )}
                        </td>
                        <td className="px-2 py-1 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COMPANY_COLORS[entry.company] }} />
                            C{entry.company}
                          </span>
                        </td>
                        <td className={`px-2 py-1 text-right font-semibold ${entry.total > 0 ? "text-slate-900" : "text-slate-300"}`}>
                          {entry.total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleStandings.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No cadets match.</p>}
            </div>
          </>
        ) : (
          <BarList
            rows={ranked.slice(0, 10).map(([key, e]) => ({
              key,
              label: e.name,
              sublabel: `C${e.company}`,
              value: e.total,
              color: COMPANY_COLORS[e.company],
            }))}
            selectedKey={selectedCadet}
            onSelect={(key) => setSelectedCadet(selectedCadet === key ? null : key)}
          />
        )}
        {(canExpand || ranked.length > 10) && (
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              {showAllCadets
                ? `${standings.length} cadets ranked`
                : ranked.length > 10
                  ? `Top 10 of ${ranked.length} cadets.`
                  : ""}
            </span>
            {canExpand && (
              <button
                onClick={() => setShowAllCadets(!showAllCadets)}
                aria-expanded={showAllCadets}
                className="font-semibold text-slate-700 hover:text-slate-900"
              >
                {showAllCadets ? "Show top 10" : "Show full battalion rankings"}
              </button>
            )}
          </div>
        )}

        {selected && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-bold text-slate-900">
              {selected.name} <span className="font-normal text-slate-500">· Company {selected.company}</span>
            </div>
            <ul className="mt-1 divide-y divide-slate-200 text-sm">
              {[...selected.records].reverse().map((g) => (
                <li key={g.id} className="py-1.5">
                  <div className="flex justify-between gap-2 text-slate-800">
                    <span>
                      {formatDay(g.event_date)} · {catLabel(g.category)}
                    </span>
                    <span className="font-semibold">{g.count}</span>
                  </div>
                  {g.reason && <div className="text-xs text-slate-500">{g.reason}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
