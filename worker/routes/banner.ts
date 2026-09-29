import { Hono } from "hono";
import type { Env } from "../types";
import { BANNER_CATEGORIES, COMPANIES, scoreWeek, type Company, type WeekResult } from "../lib/bannerScoring";

export const banner = new Hono<{ Bindings: Env }>();

interface WeekRow {
  id: number;
  start_date: string;
  end_date: string;
  strength_a: number;
  strength_b: number;
  strength_c: number;
  status: "open" | "final";
  announced_json: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
}

interface EventRow {
  id: number;
  week_id: number;
  category: string;
  event_date: string;
  gigs_a: number;
  gigs_b: number;
  gigs_c: number;
  inspected_a: number | null;
  inspected_b: number | null;
  inspected_c: number | null;
  note: string | null;
  entered_by: string;
  created_at: string;
  updated_at: string;
}

interface GigRow {
  id: number;
  event_id: number;
  company: Company;
  cadet_id: number | null;
  cadet_name: string;
  count: number;
  reason: string | null;
}

interface AuditRow {
  id: number;
  week_id: number;
  event_id: number | null;
  action: string;
  actor: string;
  reason: string | null;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

// The standings as they stood when a week was finalized (or, for weeks
// imported from the spreadsheet, as the spreadsheet recorded them).
interface Announced {
  scores: Record<Company, number>;
  places: Record<Company, number>;
  winners: Company[];
  source: "app" | "spreadsheet";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS;
}

function validActor(actor: unknown): string | null {
  if (typeof actor !== "string") return null;
  const trimmed = actor.trim();
  return trimmed && trimmed.length <= 60 ? trimmed : null;
}

function describeDiscrepancy(announced: Announced | null, result: WeekResult): string | null {
  if (!announced) return null;
  const diffs = COMPANIES.filter(
    (c) => announced.places[c] !== result.places[c] || announced.scores[c] !== result.scores[c],
  );
  if (diffs.length === 0) return null;
  return diffs
    .map(
      (c) =>
        `C${c}: recorded ${announced.scores[c]} pts / place ${announced.places[c]}, recalculated ${result.scores[c]} pts / place ${result.places[c]}`,
    )
    .join("; ");
}

function serializeWeek(week: WeekRow, events: EventRow[]) {
  const result = scoreWeek(week, events);
  const announced = week.announced_json ? (JSON.parse(week.announced_json) as Announced) : null;
  return {
    id: week.id,
    start_date: week.start_date,
    end_date: week.end_date,
    strengths: { A: week.strength_a, B: week.strength_b, C: week.strength_c },
    status: week.status,
    finalized_at: week.finalized_at,
    finalized_by: week.finalized_by,
    announced,
    result,
    discrepancy: describeDiscrepancy(announced, result),
  };
}

function serializeGig(row: GigRow) {
  return {
    id: row.id,
    cadet_id: row.cadet_id,
    cadet_name: row.cadet_name,
    company: row.company,
    count: row.count,
    reason: row.reason,
  };
}

function serializeEvent(row: EventRow, gigs: GigRow[]) {
  return {
    id: row.id,
    category: row.category,
    event_date: row.event_date,
    gigs: { A: row.gigs_a, B: row.gigs_b, C: row.gigs_c },
    inspected: { A: row.inspected_a, B: row.inspected_b, C: row.inspected_c },
    named: gigs.filter((g) => g.event_id === row.id).map(serializeGig),
    note: row.note,
    entered_by: row.entered_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeAudit(row: AuditRow) {
  return {
    id: row.id,
    event_id: row.event_id,
    action: row.action,
    actor: row.actor,
    reason: row.reason,
    before: row.before_json ? JSON.parse(row.before_json) : null,
    after: row.after_json ? JSON.parse(row.after_json) : null,
    created_at: row.created_at,
  };
}

function auditStmt(
  DB: D1Database,
  entry: { week_id: number; event_id?: number | null; action: string; actor: string; reason?: string | null; before?: unknown; after?: unknown },
) {
  return DB.prepare(
    "INSERT INTO banner_audit (week_id, event_id, action, actor, reason, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    entry.week_id,
    entry.event_id ?? null,
    entry.action,
    entry.actor,
    entry.reason ?? null,
    entry.before === undefined ? null : JSON.stringify(entry.before),
    entry.after === undefined ? null : JSON.stringify(entry.after),
  );
}

async function loadWeek(DB: D1Database, id: number) {
  return DB.prepare("SELECT * FROM banner_weeks WHERE id = ?").bind(id).first<WeekRow>();
}

async function loadEvents(DB: D1Database, weekId: number) {
  const { results } = await DB.prepare("SELECT * FROM banner_events WHERE week_id = ? ORDER BY event_date, id")
    .bind(weekId)
    .all<EventRow>();
  return results;
}

async function loadWeekGigs(DB: D1Database, weekId: number) {
  const { results } = await DB.prepare(
    "SELECT g.* FROM banner_gigs g JOIN banner_events e ON e.id = g.event_id WHERE e.week_id = ? ORDER BY g.id",
  )
    .bind(weekId)
    .all<GigRow>();
  return results;
}

async function loadEventGigs(DB: D1Database, eventId: number) {
  const { results } = await DB.prepare("SELECT * FROM banner_gigs WHERE event_id = ? ORDER BY id").bind(eventId).all<GigRow>();
  return results;
}

// ---- Week dates / strengths validation -----------------------------------

interface WeekInput {
  start_date: string;
  end_date: string;
  strength_a: number;
  strength_b: number;
  strength_c: number;
}

function parseWeekInput(body: Record<string, unknown>): { ok: true; value: WeekInput } | { ok: false; error: string } {
  const { start_date, end_date } = body;
  if (typeof start_date !== "string" || !DATE_RE.test(start_date)) return { ok: false, error: "Start date is required" };
  if (typeof end_date !== "string" || !DATE_RE.test(end_date)) return { ok: false, error: "End date is required" };
  const span = daysBetween(start_date, end_date);
  if (!(span >= 1 && span <= 14)) return { ok: false, error: "A week must end 1 to 14 days after it starts" };
  const strengths = (body.strengths ?? {}) as Record<string, unknown>;
  const s = COMPANIES.map((c) => Number(strengths[c]));
  if (s.some((n) => !Number.isInteger(n) || n <= 0)) return { ok: false, error: "Each company's strength must be a whole number above 0" };
  return { ok: true, value: { start_date, end_date, strength_a: s[0], strength_b: s[1], strength_c: s[2] } };
}

// Adjacent weeks share a boundary date (one ends the morning the next starts
// in the afternoon), so only a true overlap is rejected.
async function findOverlap(DB: D1Database, input: WeekInput, excludeId: number | null) {
  return DB.prepare("SELECT * FROM banner_weeks WHERE start_date < ? AND end_date > ? AND id != ?")
    .bind(input.end_date, input.start_date, excludeId ?? -1)
    .first<WeekRow>();
}

// ---- Event validation ------------------------------------------------------

interface EventInput {
  category: string;
  event_date: string;
  gigs_a: number;
  gigs_b: number;
  gigs_c: number;
  inspected_a: number | null;
  inspected_b: number | null;
  inspected_c: number | null;
  note: string | null;
  named: NamedGigInput[];
}

interface NamedGigInput {
  company: Company;
  cadet_id: number | null;
  cadet_name: string;
  count: number;
  reason: string | null;
}

// Named gigs attribute some of an event's gigs to individual cadets. Roster
// cadets are looked up so the stored name/company can't be spoofed; names
// typed in by hand need a company. A company's named gigs can't add up to
// more than the gigs recorded for it on this event.
async function parseNamedGigs(
  DB: D1Database,
  raw: unknown,
  gigs: Record<Company, number>,
): Promise<{ ok: true; value: NamedGigInput[] } | { ok: false; error: string }> {
  if (raw == null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Named gigs must be a list" };
  const named: NamedGigInput[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    const count = Number(item.count);
    if (!Number.isFinite(count) || count <= 0 || Math.round(count * 2) !== count * 2) {
      return { ok: false, error: "Each named cadet needs a gig count above 0 (whole or half)" };
    }
    const reason = typeof item.reason === "string" && item.reason.trim() ? item.reason.trim().slice(0, 200) : null;
    if (item.cadet_id != null) {
      const cadet = await DB.prepare("SELECT id, first_name, last_name, company FROM cadets WHERE id = ?")
        .bind(Number(item.cadet_id))
        .first<{ id: number; first_name: string; last_name: string; company: Company }>();
      if (!cadet) return { ok: false, error: "A named cadet is no longer on the roster" };
      named.push({ company: cadet.company, cadet_id: cadet.id, cadet_name: `${cadet.first_name} ${cadet.last_name}`, count, reason });
    } else {
      const name = typeof item.cadet_name === "string" ? item.cadet_name.trim().slice(0, 80) : "";
      const company = item.company as Company;
      if (!name) return { ok: false, error: "Enter a name for each cadet" };
      if (!COMPANIES.includes(company)) return { ok: false, error: `Pick a company for ${name}` };
      named.push({ company, cadet_id: null, cadet_name: name, count, reason });
    }
  }
  for (const c of COMPANIES) {
    const total = named.filter((n) => n.company === c).reduce((sum, n) => sum + n.count, 0);
    if (total > gigs[c] + 1e-9) {
      return { ok: false, error: `Company ${c} has ${total} named gig(s) but only ${gigs[c]} recorded for this event` };
    }
  }
  return { ok: true, value: named };
}

async function parseEventInput(
  DB: D1Database,
  body: Record<string, unknown>,
  week: WeekRow,
): Promise<{ ok: true; value: EventInput } | { ok: false; error: string }> {
  const category = BANNER_CATEGORIES.find((cat) => cat.key === body.category);
  if (!category) return { ok: false, error: "Pick a category" };
  const date = body.event_date;
  if (typeof date !== "string" || !DATE_RE.test(date)) return { ok: false, error: "Pick a date" };
  if (date < week.start_date || date > week.end_date) {
    return { ok: false, error: `Date must fall within this week (${week.start_date} to ${week.end_date})` };
  }

  const gigsIn = (body.gigs ?? {}) as Record<string, unknown>;
  const gigs = COMPANIES.map((c) => (gigsIn[c] === "" || gigsIn[c] == null ? NaN : Number(gigsIn[c])));
  if (gigs.some((n) => !Number.isFinite(n) || n < 0)) {
    return { ok: false, error: "Enter a number (0 or more) for every company — use 0 if a company had none" };
  }

  let inspected: (number | null)[] = [null, null, null];
  if (category.perCadet) {
    const inspIn = (body.inspected ?? {}) as Record<string, unknown>;
    inspected = COMPANIES.map((c) => (inspIn[c] === "" || inspIn[c] == null ? null : Number(inspIn[c])));
    if (inspected.some((n) => n !== null && (!Number.isInteger(n) || n <= 0))) {
      return { ok: false, error: "Cadets inspected must be a whole number above 0 (or blank for the full company)" };
    }
  }

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const named = await parseNamedGigs(DB, body.named, { A: gigs[0], B: gigs[1], C: gigs[2] });
  if (!named.ok) return named;
  return {
    ok: true,
    value: {
      category: category.key,
      event_date: date,
      gigs_a: gigs[0],
      gigs_b: gigs[1],
      gigs_c: gigs[2],
      inspected_a: inspected[0],
      inspected_b: inspected[1],
      inspected_c: inspected[2],
      note,
      named: named.value,
    },
  };
}

function insertGigStmts(DB: D1Database, eventId: number, named: NamedGigInput[]) {
  return named.map((n) =>
    DB.prepare("INSERT INTO banner_gigs (event_id, company, cadet_id, cadet_name, count, reason) VALUES (?, ?, ?, ?, ?, ?)").bind(
      eventId,
      n.company,
      n.cadet_id,
      n.cadet_name,
      n.count,
      n.reason,
    ),
  );
}

const FINALIZED_ERROR = "This week has been finalized. Reopen it (with a reason) before changing scores.";

// ---- Routes ----------------------------------------------------------------

// GET /api/banner/weeks — every week with its recalculated result (for the
// week picker and season standings).
banner.get("/weeks", async (c) => {
  const { DB } = c.env;
  const [{ results: weeks }, { results: events }] = await Promise.all([
    DB.prepare("SELECT * FROM banner_weeks ORDER BY start_date").all<WeekRow>(),
    DB.prepare("SELECT * FROM banner_events").all<EventRow>(),
  ]);
  return c.json({
    categories: BANNER_CATEGORIES,
    weeks: weeks.map((w) => serializeWeek(w, events.filter((e) => e.week_id === w.id))),
  });
});

// GET /api/banner/weeks/:id — one week with its events and change history.
banner.get("/weeks/:id", async (c) => {
  const { DB } = c.env;
  const week = await loadWeek(DB, Number(c.req.param("id")));
  if (!week) return c.json({ error: "Week not found" }, 404);
  const [events, gigs] = await Promise.all([loadEvents(DB, week.id), loadWeekGigs(DB, week.id)]);
  const { results: audit } = await DB.prepare("SELECT * FROM banner_audit WHERE week_id = ? ORDER BY created_at DESC, id DESC")
    .bind(week.id)
    .all<AuditRow>();
  return c.json({
    categories: BANNER_CATEGORIES,
    week: serializeWeek(week, events),
    events: events.map((e) => serializeEvent(e, gigs)),
    audit: audit.map(serializeAudit),
  });
});

// GET /api/banner/gigs — every named gig with its event's date, category
// and week, for individual performance trends.
banner.get("/gigs", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.*, e.category, e.event_date, e.week_id, w.start_date AS week_start, w.end_date AS week_end
     FROM banner_gigs g
     JOIN banner_events e ON e.id = g.event_id
     JOIN banner_weeks w ON w.id = e.week_id
     ORDER BY e.event_date, g.id`,
  ).all<GigRow & { category: string; event_date: string; week_id: number; week_start: string; week_end: string }>();
  return c.json(
    results.map((r) => ({
      ...serializeGig(r),
      category: r.category,
      event_date: r.event_date,
      week_id: r.week_id,
      week_start: r.week_start,
      week_end: r.week_end,
    })),
  );
});

// POST /api/banner/weeks — start a new week.
banner.post("/weeks", async (c) => {
  const { DB } = c.env;
  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: "Enter your name so the change is recorded" }, 400);
  const parsed = parseWeekInput(body);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const input = parsed.value;

  const overlap = await findOverlap(DB, input, null);
  if (overlap) return c.json({ error: `Overlaps the week of ${overlap.start_date} to ${overlap.end_date}` }, 400);

  const created = await DB.prepare(
    "INSERT INTO banner_weeks (start_date, end_date, strength_a, strength_b, strength_c) VALUES (?, ?, ?, ?, ?) RETURNING *",
  )
    .bind(input.start_date, input.end_date, input.strength_a, input.strength_b, input.strength_c)
    .first<WeekRow>();
  if (!created) return c.json({ error: "Could not create week" }, 500);
  await auditStmt(DB, { week_id: created.id, action: "create_week", actor, after: input }).run();
  return c.json(serializeWeek(created, []), 201);
});

// PATCH /api/banner/weeks/:id — change an open week's dates or strengths.
banner.patch("/weeks/:id", async (c) => {
  const { DB } = c.env;
  const week = await loadWeek(DB, Number(c.req.param("id")));
  if (!week) return c.json({ error: "Week not found" }, 404);
  if (week.status === "final") return c.json({ error: FINALIZED_ERROR }, 409);

  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: "Enter your name so the change is recorded" }, 400);
  const parsed = parseWeekInput(body);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const input = parsed.value;

  const overlap = await findOverlap(DB, input, week.id);
  if (overlap) return c.json({ error: `Overlaps the week of ${overlap.start_date} to ${overlap.end_date}` }, 400);
  const outside = await DB.prepare("SELECT COUNT(*) AS n FROM banner_events WHERE week_id = ? AND (event_date < ? OR event_date > ?)")
    .bind(week.id, input.start_date, input.end_date)
    .first<{ n: number }>();
  if (outside && outside.n > 0) {
    return c.json({ error: `${outside.n} recorded event(s) would fall outside the new dates. Move or delete them first.` }, 400);
  }

  const before = {
    start_date: week.start_date,
    end_date: week.end_date,
    strength_a: week.strength_a,
    strength_b: week.strength_b,
    strength_c: week.strength_c,
  };
  await DB.batch([
    DB.prepare(
      "UPDATE banner_weeks SET start_date = ?, end_date = ?, strength_a = ?, strength_b = ?, strength_c = ?, updated_at = datetime('now') WHERE id = ?",
    ).bind(input.start_date, input.end_date, input.strength_a, input.strength_b, input.strength_c, week.id),
    auditStmt(DB, { week_id: week.id, action: "update_week", actor, before, after: input }),
  ]);
  const updated = (await loadWeek(DB, week.id))!;
  return c.json(serializeWeek(updated, await loadEvents(DB, week.id)));
});

// POST /api/banner/weeks/:id/events — record one event for all three companies.
banner.post("/weeks/:id/events", async (c) => {
  const { DB } = c.env;
  const week = await loadWeek(DB, Number(c.req.param("id")));
  if (!week) return c.json({ error: "Week not found" }, 404);
  if (week.status === "final") return c.json({ error: FINALIZED_ERROR }, 409);

  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: "Enter your name so the change is recorded" }, 400);
  const parsed = await parseEventInput(DB, body, week);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const e = parsed.value;

  const created = await DB.prepare(
    `INSERT INTO banner_events (week_id, category, event_date, gigs_a, gigs_b, gigs_c, inspected_a, inspected_b, inspected_c, note, entered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(week.id, e.category, e.event_date, e.gigs_a, e.gigs_b, e.gigs_c, e.inspected_a, e.inspected_b, e.inspected_c, e.note, actor)
    .first<EventRow>();
  if (!created) return c.json({ error: "Could not save" }, 500);
  await DB.batch([
    ...insertGigStmts(DB, created.id, e.named),
    auditStmt(DB, { week_id: week.id, event_id: created.id, action: "create_event", actor, after: e }),
  ]);
  return c.json(serializeEvent(created, await loadEventGigs(DB, created.id)), 201);
});

async function loadEventAndWeek(DB: D1Database, eventId: number) {
  const event = await DB.prepare("SELECT * FROM banner_events WHERE id = ?").bind(eventId).first<EventRow>();
  if (!event) return null;
  const week = await loadWeek(DB, event.week_id);
  return week ? { event, week } : null;
}

function eventSnapshot(e: EventRow, gigs: GigRow[]): EventInput {
  return {
    category: e.category,
    event_date: e.event_date,
    gigs_a: e.gigs_a,
    gigs_b: e.gigs_b,
    gigs_c: e.gigs_c,
    inspected_a: e.inspected_a,
    inspected_b: e.inspected_b,
    inspected_c: e.inspected_c,
    note: e.note,
    named: gigs.map((g) => ({ company: g.company, cadet_id: g.cadet_id, cadet_name: g.cadet_name, count: g.count, reason: g.reason })),
  };
}

// PATCH /api/banner/events/:id — correct an event in an open week. Named
// gigs are replaced wholesale with the submitted list.
banner.patch("/events/:id", async (c) => {
  const { DB } = c.env;
  const found = await loadEventAndWeek(DB, Number(c.req.param("id")));
  if (!found) return c.json({ error: "Event not found" }, 404);
  const { event, week } = found;
  if (week.status === "final") return c.json({ error: FINALIZED_ERROR }, 409);

  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: "Enter your name so the change is recorded" }, 400);
  const parsed = await parseEventInput(DB, body, week);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const e = parsed.value;
  const before = eventSnapshot(event, await loadEventGigs(DB, event.id));

  await DB.batch([
    DB.prepare(
      `UPDATE banner_events SET category = ?, event_date = ?, gigs_a = ?, gigs_b = ?, gigs_c = ?,
         inspected_a = ?, inspected_b = ?, inspected_c = ?, note = ?, updated_at = datetime('now') WHERE id = ?`,
    ).bind(e.category, e.event_date, e.gigs_a, e.gigs_b, e.gigs_c, e.inspected_a, e.inspected_b, e.inspected_c, e.note, event.id),
    DB.prepare("DELETE FROM banner_gigs WHERE event_id = ?").bind(event.id),
    ...insertGigStmts(DB, event.id, e.named),
    auditStmt(DB, { week_id: week.id, event_id: event.id, action: "update_event", actor, before, after: e }),
  ]);
  const updated = await DB.prepare("SELECT * FROM banner_events WHERE id = ?").bind(event.id).first<EventRow>();
  return c.json(serializeEvent(updated!, await loadEventGigs(DB, event.id)));
});

// DELETE /api/banner/events/:id — remove an event from an open week. The
// audit log keeps a full copy of what was deleted, named gigs included.
banner.delete("/events/:id", async (c) => {
  const { DB } = c.env;
  const found = await loadEventAndWeek(DB, Number(c.req.param("id")));
  if (!found) return c.json({ error: "Event not found" }, 404);
  const { event, week } = found;
  if (week.status === "final") return c.json({ error: FINALIZED_ERROR }, 409);

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: "Enter your name so the change is recorded" }, 400);
  const before = eventSnapshot(event, await loadEventGigs(DB, event.id));

  await DB.batch([
    DB.prepare("DELETE FROM banner_gigs WHERE event_id = ?").bind(event.id),
    DB.prepare("DELETE FROM banner_events WHERE id = ?").bind(event.id),
    auditStmt(DB, { week_id: week.id, event_id: event.id, action: "delete_event", actor, before }),
  ]);
  return c.body(null, 204);
});

// POST /api/banner/weeks/:id/finalize — lock the week and freeze the
// standings as announced.
banner.post("/weeks/:id/finalize", async (c) => {
  const { DB } = c.env;
  const week = await loadWeek(DB, Number(c.req.param("id")));
  if (!week) return c.json({ error: "Week not found" }, 404);
  if (week.status === "final") return c.json({ error: "Already finalized" }, 409);

  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: "Enter your name so the change is recorded" }, 400);

  const result = scoreWeek(week, await loadEvents(DB, week.id));
  const announced: Announced = { scores: result.scores, places: result.places, winners: result.winners, source: "app" };
  await DB.batch([
    DB.prepare(
      "UPDATE banner_weeks SET status = 'final', announced_json = ?, finalized_at = datetime('now'), finalized_by = ?, updated_at = datetime('now') WHERE id = ?",
    ).bind(JSON.stringify(announced), actor, week.id),
    auditStmt(DB, { week_id: week.id, action: "finalize", actor, after: { ...announced, tiebreakNotes: result.tiebreakNotes } }),
  ]);
  const updated = (await loadWeek(DB, week.id))!;
  return c.json(serializeWeek(updated, await loadEvents(DB, week.id)));
});

// POST /api/banner/weeks/:id/reopen — unlock a finalized week. Requires a
// reason, which is kept in the audit log alongside what had been announced.
banner.post("/weeks/:id/reopen", async (c) => {
  const { DB } = c.env;
  const week = await loadWeek(DB, Number(c.req.param("id")));
  if (!week) return c.json({ error: "Week not found" }, 404);
  if (week.status !== "final") return c.json({ error: "Week is not finalized" }, 409);

  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: "Enter your name so the change is recorded" }, 400);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5) return c.json({ error: "Give a reason for reopening a finalized week" }, 400);

  await DB.batch([
    DB.prepare("UPDATE banner_weeks SET status = 'open', updated_at = datetime('now') WHERE id = ?").bind(week.id),
    auditStmt(DB, {
      week_id: week.id,
      action: "reopen",
      actor,
      reason: reason.slice(0, 500),
      before: week.announced_json ? JSON.parse(week.announced_json) : null,
    }),
  ]);
  const updated = (await loadWeek(DB, week.id))!;
  return c.json(serializeWeek(updated, await loadEvents(DB, week.id)));
});
