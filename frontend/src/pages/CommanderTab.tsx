import { useEffect, useState } from "react";
import { bannerApi, cadetsApi, ncsApi, staffApi } from "../api/client";
import type { BannerWeek, Cadet, NcsEntry, StaffRecord } from "../types";
import { BANNER_COMPANIES } from "../types";
import { addDays, effectiveStandings, formatDay, ordinal, seasonOf, todayIso, weekLabel } from "../components/bannerUtils";
import { laundryState } from "../components/staff/staffUtils";

// Battalion Commander's view (CMA 3-1): responsible for the performance,
// conduct, discipline and accountability of the battalion, punctuality at
// formations, after-taps conduct, and keeping unit commanders informed.
// Read-only: it pulls from every other section.

interface Data {
  weeks: BannerWeek[];
  records: Record<string, StaffRecord[]>;
  ncs: NcsEntry[];
  roster: Cadet[];
}

const KINDS = ["orders", "morale", "training", "laundry", "work_orders", "police_areas", "first_sgt_reports", "inspections"];

interface ActionItem {
  text: string;
  href: string;
  tone: "red" | "amber";
}

function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

function Card({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {href && (
          <a href={href} className="text-xs text-slate-500 underline hover:text-slate-800">
            Open
          </a>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function CommanderTab() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([bannerApi.weeks(), staffApi.lists(KINDS), ncsApi.list(), cadetsApi.list()])
      .then(([{ weeks }, records, ncs, roster]) => setData({ weeks, records, ncs, roster }))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  const today = todayIso();
  const { weeks, records, ncs, roster } = data;

  // ---- Needs attention ------------------------------------------------------
  const actions: ActionItem[] = [];
  const overdueLaundry = records.laundry.filter((r) => r.data.status === "Waiting" && laundryState(r.data).overdue);
  if (overdueLaundry.length) {
    const cos = [...new Set(overdueLaundry.map((r) => `C${r.data.company}`))].join(", ");
    actions.push({ text: `${plural(overdueLaundry.length, "laundry pickup")} past 24 hours (${cos})`, href: "#/supply/laundry", tone: "red" });
  }
  const openBanner = weeks.filter((w) => w.status === "open" && w.end_date < today);
  for (const w of openBanner) actions.push({ text: `Banner week ${weekLabel(w)} ended but isn't finalized`, href: "#/sergeant-major/banner", tone: "amber" });
  const followUps = records.morale.filter((r) => r.data.follow_up === "Follow-up needed");
  if (followUps.length) actions.push({ text: `${plural(followUps.length, "morale report")} ${followUps.length === 1 ? "needs" : "need"} follow-up`, href: "#/adjutant/morale", tone: "amber" });
  const failed = records.training.filter((r) => r.data.evaluation === "Did not meet – retrain");
  if (failed.length) actions.push({ text: `${plural(failed.length, "training event")} did not meet the standard`, href: "#/operations/training", tone: "red" });
  const unevaluated = records.training.filter((r) => r.data.status === "Completed" && !r.data.evaluation);
  if (unevaluated.length) actions.push({ text: `${plural(unevaluated.length, "completed training event")} not evaluated`, href: "#/operations/training", tone: "amber" });
  const staleTraining = records.training.filter((r) => r.data.status === "Planned" && String(r.data.date) < today);
  if (staleTraining.length) actions.push({ text: `${plural(staleTraining.length, "past training event")} still marked Planned`, href: "#/operations/training", tone: "amber" });
  const police = records.police_areas.filter((r) => r.data.condition === "Needs attention");
  if (police.length) actions.push({ text: `${plural(police.length, "police area")} ${police.length === 1 ? "needs" : "need"} attention`, href: "#/supply/police-areas", tone: "amber" });
  const unsubmitted = records.first_sgt_reports.filter((r) => r.data.submitted === "Not yet submitted" && String(r.data.date) < today);
  if (unsubmitted.length) {
    actions.push({ text: `${plural(unsubmitted.length, "First Sergeant's report")} from past days not submitted`, href: "#/sergeant-major/1sg-reports", tone: "amber" });
  }
  const corrections = records.inspections.filter((r) => r.data.corrected === "Correction needed");
  if (corrections.length) {
    const cos = [...new Set(corrections.map((r) => `C${r.data.company}`))].join(", ");
    actions.push({ text: `${plural(corrections.length, "inspection finding")} awaiting correction (${cos})`, href: "#/commander/inspections", tone: "amber" });
  }
  const blackStripers = ncs.filter((e) => e.progress.black_striper);
  if (blackStripers.length) actions.push({ text: `${plural(blackStripers.length, "Black Striper")} in the New Cadet System`, href: "#/adjutant/ncs", tone: "amber" });

  // ---- Banner ---------------------------------------------------------------------
  const current = weeks.find((w) => w.start_date <= today && today <= w.end_date && w.status === "open") ?? weeks[weeks.length - 1];
  const season = current ? seasonOf(current) : null;
  const finals = weeks.filter((w) => w.status === "final" && seasonOf(w) === season);
  const lastFinal = finals[finals.length - 1];
  const wins = Object.fromEntries(BANNER_COMPANIES.map((c) => [c, finals.filter((w) => effectiveStandings(w).winners.includes(c)).length]));

  // Discipline & accountability this season, straight from banner scoring:
  // ATVs (after-taps conduct) and Accountability (punctuality at formations).
  const seasonWeeks = weeks.filter((w) => seasonOf(w) === season);
  const sumCategory = (key: string, c: "A" | "B" | "C") =>
    seasonWeeks.reduce((sum, w) => sum + (w.result.categories.find((x) => x.key === key)?.totals[c] ?? 0), 0);

  // ---- Staff ----------------------------------------------------------------------
  const activeOrders = records.orders.filter(
    (r) => String(r.data.effective) <= today && (!r.data.expires || String(r.data.expires) >= today),
  );
  const upcomingOrders = records.orders.filter((r) => String(r.data.effective) > today);
  const weekAhead = addDays(today, 7);
  const upcomingTraining = records.training
    .filter((r) => r.data.status === "Planned" && String(r.data.date) >= today && String(r.data.date) <= weekAhead)
    .sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)));
  const openWorkOrders = records.work_orders.filter((r) => r.data.status !== "Completed");
  const strength = Object.fromEntries(BANNER_COMPANIES.map((c) => [c, roster.filter((x) => x.company === c).length]));
  const invited = ncs.filter((e) => e.progress.boards_invited_date).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Battalion Overview</h2>
        <p className="mt-0.5 text-xs text-slate-500">Performance, discipline and accountability across every section. {formatDay(today)}.</p>
      </div>

      <Card title="Needs attention">
        {actions.length === 0 ? (
          <p className="text-sm text-emerald-700">Nothing outstanding.</p>
        ) : (
          <ul className="space-y-1.5">
            {actions.map((a) => (
              <li key={a.text}>
                <a href={a.href} className="flex items-start gap-2 text-sm text-slate-800 hover:underline">
                  <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${a.tone === "red" ? "bg-red-500" : "bg-amber-400"}`} aria-hidden />
                  <span>
                    <span className="sr-only">{a.tone === "red" ? "Urgent: " : "Attention: "}</span>
                    {a.text}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {current && (
          <Card title="Battalion Banner" href="#/sergeant-major/banner">
            <p className="text-xs text-slate-500">
              {current.status === "open" ? "This week so far" : "Latest week"} · {weekLabel(current)}
            </p>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              {BANNER_COMPANIES.map((c) => {
                const s = effectiveStandings(current);
                return (
                  <div key={c} className={`rounded-md py-2 ${s.places[c] === 1 ? "bg-amber-100" : "bg-slate-50"}`}>
                    <div className="text-xs text-slate-500">Company {c}</div>
                    <div className="text-base font-bold text-slate-900">{ordinal(s.places[c])}</div>
                    <div className="text-[11px] text-slate-500">
                      {s.scores[c]} pts · {wins[c]} banner{wins[c] === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              })}
            </div>
            {lastFinal && (
              <p className="mt-2 text-xs text-slate-600">
                Last banner: <span className="font-semibold">{effectiveStandings(lastFinal).winners.map((c) => `Company ${c}`).join(" & ")}</span> (
                {weekLabel(lastFinal)})
              </p>
            )}
          </Card>
        )}

        <Card title="Discipline & accountability this season" href="#/sergeant-major/trends">
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="py-1 text-left font-semibold" />
                {BANNER_COMPANIES.map((c) => (
                  <th key={c} className="w-14 py-1 text-right font-semibold">
                    C{c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { key: "atvs", label: "After-taps violations" },
                { key: "accountability", label: "Late / absent (pts)" },
                { key: "bed_checks", label: "Bed check gigs" },
              ].map((row) => (
                <tr key={row.key} className="border-t border-slate-100 text-slate-700">
                  <td className="py-1">{row.label}</td>
                  {BANNER_COMPANIES.map((c) => (
                    <td key={c} className="py-1 text-right">
                      {Math.round(sumCategory(row.key, c) * 10) / 10}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-slate-100 text-slate-700">
                <td className="py-1">Latest morale</td>
                {BANNER_COMPANIES.map((c) => {
                  const latest = records.morale
                    .filter((r) => r.data.company === c)
                    .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)))[0];
                  return (
                    <td key={c} className="py-1 text-right" title={latest ? String(latest.data.rating) : undefined}>
                      {latest ? `${String(latest.data.rating).charAt(0)}/5` : "–"}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-t border-slate-100 text-slate-700">
                <td className="py-1">Unexcused absences (1SG)</td>
                {BANNER_COMPANIES.map((c) => (
                  <td key={c} className="py-1 text-right">
                    {records.first_sgt_reports
                      .filter((r) => r.data.company === c && seasonOf({ start_date: String(r.data.date) }) === season)
                      .reduce((sum, r) => sum + Number(r.data.unexcused), 0)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-slate-100 text-slate-500">
                <td className="py-1">Strength (roster)</td>
                {BANNER_COMPANIES.map((c) => (
                  <td key={c} className="py-1 text-right">
                    {strength[c]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-400">From banner scores, morale reports and First Sergeant's reports for {season ?? "this season"}.</p>
        </Card>

        <Card title="Orders & notices in effect" href="#/adjutant/orders">
          {activeOrders.length === 0 ? (
            <p className="text-sm text-slate-500">None in effect.</p>
          ) : (
            <ul className="space-y-1.5">
              {activeOrders.map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="font-semibold text-slate-800">{String(r.data.title)}</span>
                  <span className="text-xs text-slate-500">
                    {" "}
                    · {r.data.audience ? `C${r.data.audience}` : "Battalion"}
                    {r.data.expires ? ` · until ${formatDay(String(r.data.expires))}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {upcomingOrders.length > 0 && <p className="mt-1 text-xs text-blue-700">{upcomingOrders.length} more take effect soon.</p>}
        </Card>

        <Card title="Training this week" href="#/operations/training">
          {upcomingTraining.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing scheduled in the next 7 days.</p>
          ) : (
            <ul className="space-y-1.5">
              {upcomingTraining.map((r) => (
                <li key={r.id} className="text-sm text-slate-800">
                  <span className="text-xs text-slate-500">
                    {formatDay(String(r.data.date))}
                    {r.data.time ? ` ${r.data.time}` : ""} ·{" "}
                  </span>
                  {String(r.data.title)} <span className="text-xs text-slate-500">({String(r.data.event)})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card title="Supply" href="#/supply/work-orders">
            <p className="text-2xl font-bold text-slate-900">{openWorkOrders.length}</p>
            <p className="text-xs text-slate-500">open work order{openWorkOrders.length === 1 ? "" : "s"}</p>
          </Card>
          <Card title="New cadets" href="#/adjutant/ncs">
            <p className="text-2xl font-bold text-slate-900">
              {invited}
              <span className="text-sm font-normal text-slate-500">/{ncs.length}</span>
            </p>
            <p className="text-xs text-slate-500">invited to boards</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
