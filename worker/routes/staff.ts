import { Hono } from "hono";
import type { Env } from "../types";
import { STAFF_KINDS, validateStaffData, type StaffData, type StaffKind } from "../lib/staffKinds";
import { ACTOR_REQUIRED, validActor } from "../lib/actor";

export const staff = new Hono<{ Bindings: Env }>();

interface RecordRow {
  id: number;
  kind: string;
  title: string;
  record_date: string | null;
  company: "A" | "B" | "C" | null;
  status: string | null;
  data_json: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface AuditRow {
  id: number;
  action: string;
  actor: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

function serializeRecord(row: RecordRow) {
  return {
    id: row.id,
    kind: row.kind,
    data: JSON.parse(row.data_json) as StaffData,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Columns derived from the data so lists can sort and filter without
// parsing JSON in SQL.
function indexedColumns(kind: StaffKind, data: StaffData) {
  const title = String(data[kind.titleField] ?? "").slice(0, 200) || kind.label;
  const date = kind.dateField ? (data[kind.dateField] as string | null) : null;
  const company = kind.companyField ? (data[kind.companyField] as string | null) : null;
  const status = kind.statusField ? (data[kind.statusField] as string | null) : null;
  return { title, date, company, status };
}

function auditStmt(DB: D1Database, kind: string, recordId: number, action: string, actor: string, before?: unknown, after?: unknown) {
  return DB.prepare(
    "INSERT INTO staff_audit (kind, record_id, action, actor, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(
    kind,
    recordId,
    action,
    actor,
    before === undefined ? null : JSON.stringify(before),
    after === undefined ? null : JSON.stringify(after),
  );
}

function findKind(key: string) {
  return STAFF_KINDS.find((k) => k.key === key);
}

async function loadRecord(DB: D1Database, id: number) {
  return DB.prepare("SELECT * FROM staff_records WHERE id = ? AND deleted_at IS NULL").bind(id).first<RecordRow>();
}

// GET /api/staff/kinds — field definitions for every record type.
staff.get("/kinds", (c) => c.json(STAFF_KINDS));

// GET /api/staff/list/:kind — live records of one type, newest date first.
staff.get("/list/:kind", async (c) => {
  const kind = findKind(c.req.param("kind"));
  if (!kind) return c.json({ error: "Unknown record type" }, 404);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM staff_records WHERE kind = ? AND deleted_at IS NULL ORDER BY record_date DESC, id DESC",
  )
    .bind(kind.key)
    .all<RecordRow>();
  return c.json(results.map(serializeRecord));
});

// POST /api/staff/list/:kind — create a record.
staff.post("/list/:kind", async (c) => {
  const kind = findKind(c.req.param("kind"));
  if (!kind) return c.json({ error: "Unknown record type" }, 404);
  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: ACTOR_REQUIRED }, 400);
  const parsed = validateStaffData(kind, body.data);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const { title, date, company, status } = indexedColumns(kind, parsed.data);
  const { DB } = c.env;
  const created = await DB.prepare(
    `INSERT INTO staff_records (kind, title, record_date, company, status, data_json, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(kind.key, title, date, company, status, JSON.stringify(parsed.data), actor, actor)
    .first<RecordRow>();
  if (!created) return c.json({ error: "Could not save" }, 500);
  await auditStmt(DB, kind.key, created.id, "create", actor, undefined, parsed.data).run();
  return c.json(serializeRecord(created), 201);
});

// PATCH /api/staff/records/:id — edit a record.
staff.patch("/records/:id", async (c) => {
  const { DB } = c.env;
  const row = await loadRecord(DB, Number(c.req.param("id")));
  if (!row) return c.json({ error: "Record not found" }, 404);
  const kind = findKind(row.kind)!;
  const body = await c.req.json<Record<string, unknown>>();
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: ACTOR_REQUIRED }, 400);
  const parsed = validateStaffData(kind, body.data);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const { title, date, company, status } = indexedColumns(kind, parsed.data);
  await DB.batch([
    DB.prepare(
      `UPDATE staff_records SET title = ?, record_date = ?, company = ?, status = ?, data_json = ?, updated_by = ?,
         updated_at = datetime('now') WHERE id = ?`,
    ).bind(title, date, company, status, JSON.stringify(parsed.data), actor, row.id),
    auditStmt(DB, kind.key, row.id, "update", actor, JSON.parse(row.data_json), parsed.data),
  ]);
  return c.json(serializeRecord((await loadRecord(DB, row.id))!));
});

// DELETE /api/staff/records/:id — soft delete; the history keeps the record.
staff.delete("/records/:id", async (c) => {
  const { DB } = c.env;
  const row = await loadRecord(DB, Number(c.req.param("id")));
  if (!row) return c.json({ error: "Record not found" }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const actor = validActor(body.actor);
  if (!actor) return c.json({ error: ACTOR_REQUIRED }, 400);
  await DB.batch([
    DB.prepare("UPDATE staff_records SET deleted_at = datetime('now'), updated_by = ? WHERE id = ?").bind(actor, row.id),
    auditStmt(DB, row.kind, row.id, "delete", actor, JSON.parse(row.data_json)),
  ]);
  return c.body(null, 204);
});

// GET /api/staff/records/:id/history — change log for one record.
staff.get("/records/:id/history", async (c) => {
  const { DB } = c.env;
  const id = Number(c.req.param("id"));
  const row = await DB.prepare("SELECT kind FROM staff_records WHERE id = ?").bind(id).first<{ kind: string }>();
  if (!row) return c.json({ error: "Record not found" }, 404);
  const { results } = await DB.prepare(
    "SELECT * FROM staff_audit WHERE kind = ? AND record_id = ? ORDER BY created_at DESC, id DESC",
  )
    .bind(row.kind, id)
    .all<AuditRow>();
  return c.json(
    results.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.actor,
      before: r.before_json ? JSON.parse(r.before_json) : null,
      after: r.after_json ? JSON.parse(r.after_json) : null,
      created_at: r.created_at,
    })),
  );
});
