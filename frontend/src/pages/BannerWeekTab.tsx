import { useEffect, useState } from "react";
import { bannerApi } from "../api/client";
import type { BannerAuditEntry, BannerCategory, BannerCompany, BannerEvent, BannerWeek, BannerWeekInput } from "../types";
import { BANNER_COMPANIES } from "../types";
import BannerEventForm from "../components/BannerEventForm";
import ActorBar, { useActorName } from "../components/ActorBar";
import {
  addDays,
  dayOptionLabel,
  formatDay,
  formatTotal,
  ordinal,
  todayIso,
  weekLabel,
} from "../components/bannerUtils";

interface Detail {
  categories: BannerCategory[];
  week: BannerWeek;
  events: BannerEvent[];
  audit: BannerAuditEntry[];
}

type Mode =
  | { kind: "none" }
  | { kind: "add"; category?: string }
  | { kind: "edit"; event: BannerEvent }
  | { kind: "editWeek" }
  | { kind: "newWeek" }
  | { kind: "finalize" }
  | { kind: "reopen" };

// The week to open by default: the one containing today, else the latest.
function defaultWeek(weeks: BannerWeek[]): BannerWeek | undefined {
  const today = todayIso();
  const current = weeks.filter((w) => w.start_date <= today && today <= w.end_date);
  return current.find((w) => w.status === "open") ?? current[current.length - 1] ?? weeks[weeks.length - 1];
}

export default function BannerWeekTab() {
  const [actor, setActor] = useActorName();
  const [weeks, setWeeks] = useState<BannerWeek[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWeeks(selectId?: number) {
    const { weeks } = await bannerApi.weeks();
    setWeeks(weeks);
    const next = selectId ?? selectedId ?? defaultWeek(weeks)?.id ?? null;
    setSelectedId(next);
    if (next !== null) setDetail(await bannerApi.week(next));
    else setDetail(null);
  }

  useEffect(() => {
    loadWeeks().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectWeek(id: number) {
    setMode({ kind: "none" });
    setExpanded(null);
    setError(null);
    setSelectedId(id);
    try {
      setDetail(await bannerApi.week(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that week.");
    }
  }

  // Run a write, then refresh everything it could have changed.
  async function run(action: () => Promise<unknown>, selectId?: number) {
    setError(null);
    await action();
    setMode({ kind: "none" });
    await loadWeeks(selectId);
  }

  if (error && !weeks) return <p className="text-sm text-red-600">{error}</p>;
  if (!weeks) return <p className="text-sm text-slate-400">Loading…</p>;

  const index = weeks.findIndex((w) => w.id === selectedId);
  const prev = index > 0 ? weeks[index - 1] : null;
  const next = index >= 0 && index < weeks.length - 1 ? weeks[index + 1] : null;
  const latest = weeks[weeks.length - 1];
  const week = detail?.week;
  const isOpen = week?.status === "open";
  const canWrite = actor.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Battalion Banner</h2>
        {!next && mode.kind !== "newWeek" && (
          <button
            onClick={() => setMode({ kind: "newWeek" })}
            disabled={!canWrite}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            + Next week
          </button>
        )}
      </div>

      <ActorBar actor={actor} onChange={setActor} />

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {mode.kind === "newWeek" && (
        <WeekForm
          title="Start the next week"
          initial={
            latest
              ? { start_date: latest.end_date, end_date: addDays(latest.end_date, 7), strengths: latest.strengths }
              : { start_date: todayIso(), end_date: addDays(todayIso(), 7), strengths: { A: 54, B: 53, C: 53 } }
          }
          onCancel={() => setMode({ kind: "none" })}
          onSubmit={async (data) => {
            const created = await bannerApi.createWeek(data, actor);
            await run(async () => {}, created.id);
          }}
        />
      )}

      {weeks.length === 0 && mode.kind !== "newWeek" && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
          No weeks yet. Enter your name above, then tap “+ Next week”.
        </p>
      )}

      {week && detail && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-2">
            <button
              onClick={() => prev && selectWeek(prev.id)}
              disabled={!prev}
              className="rounded px-3 py-1 text-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              aria-label="Previous week"
            >
              ‹
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-900">{weekLabel(week)}</div>
              <div className="text-xs text-slate-500">
                {isOpen ? (
                  <span className="font-semibold text-emerald-700">Open, scores can be entered</span>
                ) : (
                  <span>
                    Final{week.finalized_by ? ` · ${week.finalized_by}` : ""}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => next && selectWeek(next.id)}
              disabled={!next}
              className="rounded px-3 py-1 text-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              aria-label="Next week"
            >
              ›
            </button>
          </div>

          {week.discrepancy && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="font-semibold">
                {week.announced?.source === "spreadsheet"
                  ? "The spreadsheet's recorded result doesn't match a recalculation"
                  : isOpen
                    ? "Scores have changed since this week was announced"
                    : "Recorded result doesn't match a recalculation"}
              </div>
              <div className="mt-0.5 text-xs">{week.discrepancy}</div>
              {!isOpen &&
                week.result.tiebreakNotes.map((n) => (
                  <div key={n} className="mt-0.5 text-xs">
                    {n}
                  </div>
                ))}
            </div>
          )}

          <Standings week={week} />

          {isOpen && mode.kind === "none" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMode({ kind: "add" })}
                disabled={!canWrite}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                + Record scores
              </button>
              <button
                onClick={() => setMode({ kind: "finalize" })}
                disabled={!canWrite}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Finalize week
              </button>
              <button
                onClick={() => setMode({ kind: "editWeek" })}
                disabled={!canWrite}
                className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Edit dates / strength
              </button>
            </div>
          )}

          {!isOpen && mode.kind === "none" && (
            <button
              onClick={() => setMode({ kind: "reopen" })}
              disabled={!canWrite}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Reopen week…
            </button>
          )}

          {mode.kind === "add" && (
            <BannerEventForm
              week={week}
              categories={detail.categories}
              defaultCategory={mode.category}
              onCancel={() => setMode({ kind: "none" })}
              onSubmit={(data) => run(() => bannerApi.addEvent(week.id, data, actor))}
            />
          )}

          {mode.kind === "edit" && (
            <BannerEventForm
              week={week}
              categories={detail.categories}
              initial={mode.event}
              onCancel={() => setMode({ kind: "none" })}
              onSubmit={(data) => run(() => bannerApi.updateEvent(mode.event.id, data, actor))}
            />
          )}

          {mode.kind === "editWeek" && (
            <WeekForm
              title="Edit this week"
              initial={{ start_date: week.start_date, end_date: week.end_date, strengths: week.strengths }}
              onCancel={() => setMode({ kind: "none" })}
              onSubmit={(data) => run(() => bannerApi.updateWeek(week.id, data, actor))}
            />
          )}

          {mode.kind === "finalize" && (
            <FinalizePanel
              week={week}
              onCancel={() => setMode({ kind: "none" })}
              onConfirm={() => run(() => bannerApi.finalize(week.id, actor)).catch((err) => setError(err.message))}
            />
          )}

          {mode.kind === "reopen" && (
            <ReopenPanel
              onCancel={() => setMode({ kind: "none" })}
              onConfirm={(reason) => run(() => bannerApi.reopen(week.id, actor, reason))}
            />
          )}

          <CategoryBreakdown
            detail={detail}
            expanded={expanded}
            onToggle={(key) => setExpanded(expanded === key ? null : key)}
            canEdit={isOpen && canWrite && mode.kind === "none"}
            onAdd={(category) => setMode({ kind: "add", category })}
            onEdit={(event) => setMode({ kind: "edit", event })}
            onDelete={(event) => {
              const cat = detail.categories.find((c) => c.key === event.category)?.label ?? event.category;
              if (!window.confirm(`Delete ${cat} on ${formatDay(event.event_date)}? It stays in the change history.`)) return;
              run(() => bannerApi.deleteEvent(event.id, actor)).catch((err) => setError(err.message));
            }}
          />

          <div className="rounded-lg border border-slate-200 bg-white">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700"
            >
              Change history ({detail.audit.length})
              <span className="text-slate-400">{showHistory ? "▲" : "▼"}</span>
            </button>
            {showHistory && <AuditList audit={detail.audit} categories={detail.categories} />}
          </div>
        </>
      )}
    </div>
  );
}

function Standings({ week }: { week: BannerWeek }) {
  const final = week.status === "final" && week.announced;
  const shown = final ? week.announced! : week.result;
  const order = [...BANNER_COMPANIES].sort((a, b) => shown.places[a] - shown.places[b]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {final ? (week.announced!.source === "spreadsheet" ? "Result (from spreadsheet)" : "Final result") : "Standings so far"}
      </div>
      <div className="mt-2 divide-y divide-slate-100">
        {order.map((c) => {
          const winner = shown.places[c] === 1;
          return (
            <div key={c} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-8 w-10 items-center justify-center rounded-md text-xs font-bold ${
                    winner ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {ordinal(shown.places[c])}
                </span>
                <span className={`text-base ${winner ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                  Company {c}
                </span>
              </div>
              <span className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">{shown.scores[c]}</span> pts
              </span>
            </div>
          );
        })}
      </div>
      {!final && week.result.tiebreakNotes.map((n) => (
        <p key={n} className="mt-2 text-xs text-slate-500">
          {n}
        </p>
      ))}
      <p className="mt-2 text-xs text-slate-400">
        Points = sum of 12 category places. Lowest wins. Ties broken by ATVs, then Laundry, then BRC/DRC.
      </p>
    </div>
  );
}

function CategoryBreakdown({
  detail,
  expanded,
  onToggle,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  detail: Detail;
  expanded: string | null;
  onToggle: (key: string) => void;
  canEdit: boolean;
  onAdd: (category: string) => void;
  onEdit: (event: BannerEvent) => void;
  onDelete: (event: BannerEvent) => void;
}) {
  const { week, events } = detail;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[1fr_repeat(3,3.5rem)] gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
        <span>Category</span>
        {BANNER_COMPANIES.map((c) => (
          <span key={c} className="text-center">
            C{c}
          </span>
        ))}
      </div>
      {week.result.categories.map((cat) => {
        const catEvents = events.filter((e) => e.category === cat.key);
        const open = expanded === cat.key;
        return (
          <div key={cat.key} className="border-b border-slate-100 last:border-b-0">
            <button
              onClick={() => onToggle(cat.key)}
              className="grid w-full grid-cols-[1fr_repeat(3,3.5rem)] items-center gap-1 px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className="text-sm text-slate-800">
                {cat.label}
                <span className="ml-1 text-xs text-slate-400">
                  {cat.eventCount === 0 ? "· none" : `· ${cat.eventCount}`}
                  {cat.perCadet ? " · per cadet" : ""}
                </span>
              </span>
              {BANNER_COMPANIES.map((c) => (
                <RankCell key={c} rank={cat.ranks[c]} total={formatTotal(cat.totals[c], cat.perCadet)} dim={cat.eventCount === 0} />
              ))}
            </button>
            {open && (
              <div className="space-y-2 bg-slate-50 px-3 py-3">
                {catEvents.length === 0 && <p className="text-xs text-slate-500">Nothing recorded this week.</p>}
                {catEvents.map((e) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    week={week}
                    perCadet={cat.perCadet}
                    canEdit={canEdit}
                    onEdit={() => onEdit(e)}
                    onDelete={() => onDelete(e)}
                  />
                ))}
                {canEdit && (
                  <button onClick={() => onAdd(cat.key)} className="text-xs font-semibold text-slate-700 underline">
                    + Record {cat.label}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="grid grid-cols-[1fr_repeat(3,3.5rem)] gap-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">
        <span>Total points</span>
        {BANNER_COMPANIES.map((c) => (
          <span key={c} className="text-center">
            {week.result.scores[c]}
          </span>
        ))}
      </div>
    </div>
  );
}

function RankCell({ rank, total, dim }: { rank: number; total: string; dim: boolean }) {
  const color = dim ? "text-slate-300" : rank === 1 ? "text-emerald-700" : rank === 3 ? "text-red-600" : "text-slate-700";
  return (
    <span className="text-center leading-tight">
      <span className={`block text-sm font-bold ${color}`}>{rank}</span>
      {!dim && <span className="block text-[10px] text-slate-400">{total}</span>}
    </span>
  );
}

function EventRow({
  event,
  week,
  perCadet,
  canEdit,
  onEdit,
  onDelete,
}: {
  event: BannerEvent;
  week: BannerWeek;
  perCadet: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">{dayOptionLabel(event.event_date, week)}</div>
          <div className="text-slate-700">
            {BANNER_COMPANIES.map((c) => (
              <span key={c} className="mr-3">
                C{c} <span className="font-bold">{event.gigs[c]}</span>
                {perCadet && (
                  <span className="text-xs text-slate-400">/{event.inspected[c] ?? week.strengths[c]}</span>
                )}
              </span>
            ))}
          </div>
          {event.named.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
              {event.named.map((n) => (
                <li key={n.id}>
                  <span className="font-semibold text-slate-700">{n.cadet_name}</span> (C{n.company}) · {n.count} gig
                  {n.count === 1 ? "" : "s"}
                  {n.reason ? ` · ${n.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
          {event.note && <div className="text-xs text-slate-500">{event.note}</div>}
          <div className="text-[11px] text-slate-400">Entered by {event.entered_by}</div>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2 text-xs">
            <button onClick={onEdit} className="text-slate-600 underline">
              Edit
            </button>
            <button onClick={onDelete} className="text-red-600 underline">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekForm({
  title,
  initial,
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: BannerWeekInput;
  onSubmit: (data: BannerWeekInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [start, setStart] = useState(initial.start_date);
  const [end, setEnd] = useState(initial.end_date);
  const [strengths, setStrengths] = useState<Record<BannerCompany, string>>({
    A: String(initial.strengths.A),
    B: String(initial.strengths.B),
    C: String(initial.strengths.C),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass =
    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
          await onSubmit({
            start_date: start,
            end_date: end,
            strengths: { A: Number(strengths.A), B: Number(strengths.B), C: Number(strengths.C) },
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save.");
          setSaving(false);
        }
      }}
      className="space-y-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500">
        1st and 3rd make: Sunday afternoon to Sunday morning. 2nd make: Wednesday afternoon to Wednesday morning.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Starts (afternoon)
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Ends (morning)
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </label>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-700">Company strength</div>
        <p className="text-xs text-slate-500">Headcount used for per-cadet scoring (Room Inspections, BSM BRC).</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {BANNER_COMPANIES.map((c) => (
            <label key={c} className="block text-xs font-semibold text-slate-500">
              C{c}
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={strengths[c]}
                onChange={(e) => setStrengths((prev) => ({ ...prev, [c]: e.target.value }))}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </div>
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

function FinalizePanel({ week, onConfirm, onCancel }: { week: BannerWeek; onConfirm: () => void; onCancel: () => void }) {
  const winners = week.result.winners.map((c) => `Company ${c}`).join(" and ");
  const empty = week.result.categories.every((c) => c.eventCount === 0);
  return (
    <div className="space-y-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Finalize {weekLabel(week)}?</h3>
      {empty && <p className="text-sm text-amber-700">No scores have been recorded this week.</p>}
      <p className="text-sm text-slate-700">
        {week.result.winners.length > 1 ? "Shared banner: " : "Banner winner: "}
        <span className="font-bold">{winners}</span>
      </p>
      <p className="text-xs text-slate-500">
        This locks the week and records the standings as announced. Any later change requires reopening it with a
        reason, which is kept in the history.
      </p>
      <div className="flex gap-2">
        <button onClick={onConfirm} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Finalize
        </button>
        <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReopenPanel({ onConfirm, onCancel }: { onConfirm: (reason: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await onConfirm(reason);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not reopen.");
        }
      }}
      className="space-y-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h3 className="text-sm font-bold text-slate-900">Reopen this finalized week</h3>
      <label className="block text-sm font-medium text-slate-700">
        Reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. Regimental inspection gigs for CB were entered on the wrong day"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </label>
      <p className="text-xs text-slate-500">The announced result stays on record next to any recalculated one.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Reopen
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---- Change history ----------------------------------------------------------

type Snapshot = Record<string, unknown>;

function gigsText(s: Snapshot): string {
  const counts = BANNER_COMPANIES.map((c) => `C${c} ${s[`gigs_${c.toLowerCase()}`]}`).join(", ");
  const named = (s.named as { cadet_name: string; count: number }[] | undefined) ?? [];
  return named.length ? `${counts}; named: ${named.map((n) => `${n.cadet_name} ${n.count}`).join(", ")}` : counts;
}

function describeAudit(entry: BannerAuditEntry, categories: BannerCategory[]): string {
  const label = (s: Snapshot | null) =>
    s ? `${categories.find((c) => c.key === s.category)?.label ?? s.category} on ${formatDay(String(s.event_date))}` : "";
  const b = entry.before as Snapshot | null;
  const a = entry.after as Snapshot | null;
  switch (entry.action) {
    case "create_week":
      return "Started the week";
    case "update_week":
      return `Changed week: ${b?.start_date}–${b?.end_date}, strength ${b?.strength_a}/${b?.strength_b}/${b?.strength_c} → ${a?.start_date}–${a?.end_date}, strength ${a?.strength_a}/${a?.strength_b}/${a?.strength_c}`;
    case "create_event":
      return `Recorded ${label(a)}: ${gigsText(a!)}`;
    case "update_event":
      return `Changed ${label(b)} (${gigsText(b!)}) → ${label(a)} (${gigsText(a!)})`;
    case "delete_event":
      return `Deleted ${label(b)} (${gigsText(b!)})`;
    case "finalize": {
      const winners = (a?.winners as string[] | undefined)?.map((c) => `C${c}`).join(" & ");
      return `Finalized. Winner: ${winners}`;
    }
    case "reopen":
      return "Reopened the finalized week";
    case "import":
      return "Imported from the spreadsheet";
    default:
      return entry.action;
  }
}

function formatTimestamp(sqlite: string): string {
  return new Date(`${sqlite.replace(" ", "T")}Z`).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AuditList({ audit, categories }: { audit: BannerAuditEntry[]; categories: BannerCategory[] }) {
  if (audit.length === 0) return <p className="px-4 pb-3 text-sm text-slate-400">No changes yet.</p>;
  return (
    <ul className="divide-y divide-slate-100 border-t border-slate-100">
      {audit.map((entry) => (
        <li key={entry.id} className="px-4 py-2 text-sm">
          <div className="text-slate-800">{describeAudit(entry, categories)}</div>
          {entry.reason && <div className="text-xs text-slate-600">Reason: {entry.reason}</div>}
          <div className="text-[11px] text-slate-400">
            {entry.actor} · {formatTimestamp(entry.created_at)}
          </div>
        </li>
      ))}
    </ul>
  );
}
