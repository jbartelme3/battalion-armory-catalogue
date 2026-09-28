import { useEffect, useState } from "react";
import { bannerApi } from "../api/client";
import type { BannerCompany, BannerWeek } from "../types";
import { BANNER_COMPANIES } from "../types";
import { effectiveStandings, seasonOf, weekLabel } from "../components/bannerUtils";

// Consecutive most-recent finalized weeks each company won (shared counts).
function currentStreaks(finals: BannerWeek[]): Record<BannerCompany, number> {
  const streaks = { A: 0, B: 0, C: 0 };
  for (const c of BANNER_COMPANIES) {
    for (let i = finals.length - 1; i >= 0; i--) {
      if (!effectiveStandings(finals[i]).winners.includes(c)) break;
      streaks[c]++;
    }
  }
  return streaks;
}

export default function BannerSeasonTab() {
  const [weeks, setWeeks] = useState<BannerWeek[] | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bannerApi
      .weeks()
      .then(({ weeks }) => {
        setWeeks(weeks);
        if (weeks.length) setSeason(seasonOf(weeks[weeks.length - 1]));
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!weeks) return <p className="text-sm text-slate-400">Loading…</p>;
  if (weeks.length === 0) return <p className="text-sm text-slate-500">No banner weeks recorded yet.</p>;

  const seasons = [...new Set(weeks.map(seasonOf))];
  const inSeason = weeks.filter((w) => seasonOf(w) === season);
  const finals = inSeason.filter((w) => w.status === "final");
  const streaks = currentStreaks(finals);

  const stats = BANNER_COMPANIES.map((c) => ({
    company: c,
    wins: finals.filter((w) => effectiveStandings(w).winners.includes(c)).length,
    points: finals.reduce((sum, w) => sum + effectiveStandings(w).scores[c], 0),
    streak: streaks[c],
  }));
  const bestPoints = Math.min(...stats.map((s) => s.points));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Season Standings</h2>
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

      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.company} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
            <div className="text-sm font-bold text-slate-900">Company {s.company}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{s.wins}</div>
            <div className="text-xs text-slate-500">banner{s.wins === 1 ? "" : "s"}</div>
            <div className={`mt-2 text-sm font-semibold ${s.points === bestPoints && finals.length ? "text-emerald-700" : "text-slate-700"}`}>
              {s.points} pts
            </div>
            <div className="text-[11px] text-slate-400">{s.streak > 1 ? `${s.streak}-week streak` : "cumulative"}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {finals.length} finalized week{finals.length === 1 ? "" : "s"} counted. Cumulative points are the sum of weekly
        scores; lowest is the most consistent company (SOP 18). Shared banners count for both companies.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_4rem_repeat(3,2.5rem)] gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <span>Week</span>
          <span>Banner</span>
          {BANNER_COMPANIES.map((c) => (
            <span key={c} className="text-center">
              C{c}
            </span>
          ))}
        </div>
        {[...inSeason].reverse().map((w) => {
          const s = effectiveStandings(w);
          const open = w.status === "open";
          return (
            <div
              key={w.id}
              className="grid grid-cols-[1fr_4rem_repeat(3,2.5rem)] items-center gap-1 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0"
            >
              <span className="text-slate-800">
                {weekLabel(w)}
                {w.discrepancy && (
                  <span className="ml-1 text-xs text-amber-600" title={w.discrepancy}>
                    ⚠
                  </span>
                )}
              </span>
              <span className={open ? "text-xs text-slate-400" : "font-bold text-slate-900"}>
                {open ? "in progress" : s.winners.map((c) => `C${c}`).join(" & ")}
              </span>
              {BANNER_COMPANIES.map((c) => (
                <span key={c} className={`text-center ${open ? "text-slate-400" : s.places[c] === 1 ? "font-bold text-slate-900" : "text-slate-600"}`}>
                  {s.scores[c]}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      {inSeason.some((w) => w.discrepancy) && (
        <p className="text-xs text-amber-700">
          ⚠ The recorded result differs from a recalculation of the entered scores. Open that week on the Banner tab for
          details.
        </p>
      )}
    </div>
  );
}
