import { Hono } from "hono";
import type { Env } from "../types";
import { ACTOR_REQUIRED, validActor } from "../lib/actor";

// New Cadet System tracker (CMA 3-2.2; the Battalion Adjutant exercises
// staff supervision of the NCS). Phases: I Orientation, II Basic Formation,
// III Advanced Formation, IV Boards, V Recognition.
export const ncs = new Hono<{ Bindings: Env }>();

interface Row {
  id: number;
  first_name: string;
  last_name: string;
  company: "A" | "B" | "C";
  rank: string | null;
  position: string;
  phase: number | null;
  black_striper: 0 | 1 | null;
  specialty_test_date: string | null;
  boards_book_date: string | null;
  boards_invited_date: string | null;
  boards_passed_date: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

const DATE_FIELDS = ["specialty_test_date", "boards_book_date", "boards_invited_date", "boards_passed_date"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function serialize(r: Row) {
  return {
    cadet: { id: r.id, first_name: r.first_name, last_name: r.last_name, company: r.company, rank: r.rank, position: r.position },
    // Cadets with no row yet are shown at Phase II, where every new cadet
    // starts once Orientation is complete.
    progress: {
      tracked: r.phase !== null,
      phase: r.phase ?? 2,
      black_striper: !!r.black_striper,
      specialty_test_date: r.specialty_test_date,
      boards_book_date: r.boards_book_date,
      boards_invited_date: r.boards_invited_date,
      boards_passed_date: r.boards_passed_date,
      notes: r.notes,
      updated_by: r.updated_by,
      updated_at: r.updated_at,
    },
  };
}

const SELECT = `SELECT c.id, c.first_name, c.last_name, c.company, c.rank, c.position,
  p.phase, p.black_striper, p.specialty_test_date, p.boards_book_date, p.boards_invited_date,
  p.boards_passed_date, p.notes, p.updated_by, p.updated_at
  FROM cadets c LEFT JOIN ncs_progress p ON p.cadet_id = c.id`;

// GET /api/ncs — every new cadet on the roster (rank or position "New
// Cadet"), plus anyone already being tracked (e.g. recognized this year).
ncs.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `${SELECT} WHERE c.rank = 'New Cadet' OR c.position = 'New Cadet' OR p.cadet_id IS NOT NULL
     ORDER BY c.company, c.last_name, c.first_name`,
  ).all<Row>();
  return c.json(results.map(serialize));
});

// PUT /api/ncs/:cadetId — set a cadet's phase, milestones and notes.
ncs.put("/:cadetId", async (c) => {
  const { DB } = c.env;
  const cadetId = Number(c.req.param("cadetId"));
  const current = await DB.prepare(`${SELECT} WHERE c.id = ?`).bind(cadetId).first<Row>();
  if (!current) return c.json({ error: "Cadet not found" }, 404);

  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: ACTOR_REQUIRED }, 400);

  const phase = Number(body.phase);
  if (!Number.isInteger(phase) || phase < 1 || phase > 5) return c.json({ error: "Phase must be I to V" }, 400);
  const dates: Record<string, string | null> = {};
  for (const f of DATE_FIELDS) {
    const v = body[f];
    if (v === undefined || v === null || v === "") dates[f] = null;
    else if (typeof v === "string" && DATE_RE.test(v)) dates[f] = v;
    else return c.json({ error: "Milestone dates must be dates" }, 400);
  }
  if (dates.boards_passed_date && !dates.boards_invited_date) {
    return c.json({ error: "A cadet can't pass boards without an invitation date" }, 400);
  }
  if (phase === 5 && !dates.boards_passed_date) {
    return c.json({ error: "Phase V (Recognition) needs the date boards were passed" }, 400);
  }
  const blackStriper = body.black_striper ? 1 : 0;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;

  const after = { phase, black_striper: !!blackStriper, ...dates, notes };
  const before = current.phase === null ? null : serialize(current).progress;
  await DB.batch([
    DB.prepare(
      `INSERT INTO ncs_progress (cadet_id, phase, black_striper, specialty_test_date, boards_book_date, boards_invited_date, boards_passed_date, notes, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (cadet_id) DO UPDATE SET phase = excluded.phase, black_striper = excluded.black_striper,
         specialty_test_date = excluded.specialty_test_date, boards_book_date = excluded.boards_book_date,
         boards_invited_date = excluded.boards_invited_date, boards_passed_date = excluded.boards_passed_date,
         notes = excluded.notes, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    ).bind(
      cadetId,
      phase,
      blackStriper,
      dates.specialty_test_date,
      dates.boards_book_date,
      dates.boards_invited_date,
      dates.boards_passed_date,
      notes,
      actor,
    ),
    DB.prepare("INSERT INTO staff_audit (kind, record_id, action, actor, before_json, after_json) VALUES ('ncs', ?, ?, ?, ?, ?)").bind(
      cadetId,
      before ? "update" : "create",
      actor,
      before ? JSON.stringify(before) : null,
      JSON.stringify(after),
    ),
  ]);
  const updated = await DB.prepare(`${SELECT} WHERE c.id = ?`).bind(cadetId).first<Row>();
  return c.json(serialize(updated!));
});
