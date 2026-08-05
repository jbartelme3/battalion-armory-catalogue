import { Hono } from "hono";
import type { Env, CadetRow, EquipmentRow } from "../types";
import { resolveEligibleSlots } from "../lib/equipmentRules";
import { serializeCadet, serializeEquipment } from "../lib/serialize";

export const cadets = new Hono<{ Bindings: Env }>();

const SELECT_CADETS_WITH_RIFLE = `
  SELECT c.*, e.tag AS rifle_tag, e.type AS rifle_type, e.manual_condition AS rifle_condition
  FROM cadets c
  LEFT JOIN equipment_items e
    ON e.owner_cadet_id = c.id AND e.type IN ('infantry_rifle', 'honor_guard_rifle')
`;

type CadetRowWithRifle = CadetRow & {
  rifle_tag: string | null;
  rifle_type: string | null;
  rifle_condition: "green" | "yellow" | "red" | null;
};

function serializeCadetWithRifle(row: CadetRowWithRifle) {
  return {
    ...serializeCadet(row),
    rifle: row.rifle_tag
      ? { type: row.rifle_type, tag: row.rifle_tag, condition: row.rifle_condition }
      : null,
  };
}

// GET /api/cadets?company=A
cadets.get("/", async (c) => {
  const company = c.req.query("company");
  const { DB } = c.env;

  const stmt = company
    ? DB.prepare(
        `${SELECT_CADETS_WITH_RIFLE} WHERE c.company = ? ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE`,
      ).bind(company)
    : DB.prepare(`${SELECT_CADETS_WITH_RIFLE} ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE`);

  const { results } = await stmt.all<CadetRowWithRifle>();
  return c.json(results.map(serializeCadetWithRifle));
});

// GET /api/cadets/:id
cadets.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { DB } = c.env;

  const cadet = await DB.prepare("SELECT * FROM cadets WHERE id = ?").bind(id).first<CadetRow>();
  if (!cadet) return c.json({ error: "Cadet not found" }, 404);

  const { results: equipment } = await DB.prepare("SELECT * FROM equipment_items WHERE owner_cadet_id = ?")
    .bind(id)
    .all<EquipmentRow>();

  return c.json({
    ...serializeCadet(cadet),
    eligible_slots: resolveEligibleSlots({ ...cadet, is_honor_guard: !!cadet.is_honor_guard }),
    equipment: equipment.map((row) => ({
      ...serializeEquipment(row),
      owner_name: `${cadet.first_name} ${cadet.last_name}`,
      owner_company: cadet.company,
    })),
  });
});

// POST /api/cadets
cadets.post("/", async (c) => {
  const body = await c.req.json<{
    first_name: string;
    last_name: string;
    company: "A" | "B" | "C";
    position: string;
    rank?: string | null;
    is_honor_guard?: boolean;
    hg_rank?: string | null;
  }>();

  if (!body.first_name?.trim() || !body.last_name?.trim() || !["A", "B", "C"].includes(body.company)) {
    return c.json({ error: "first_name, last_name, and a valid company (A/B/C) are required" }, 400);
  }

  const { DB } = c.env;
  const result = await DB.prepare(
    `INSERT INTO cadets (first_name, last_name, company, position, rank, is_honor_guard, hg_rank, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(
      body.first_name.trim(),
      body.last_name.trim(),
      body.company,
      body.position?.trim() || "New Cadet",
      body.rank?.trim() || null,
      body.is_honor_guard ? 1 : 0,
      body.is_honor_guard ? body.hg_rank ?? null : null,
    )
    .run();

  const cadet = await DB.prepare("SELECT * FROM cadets WHERE id = ?")
    .bind(result.meta.last_row_id)
    .first<CadetRow>();

  return c.json(serializeCadet(cadet!), 201);
});

// PATCH /api/cadets/:id
cadets.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { DB } = c.env;

  const existing = await DB.prepare("SELECT * FROM cadets WHERE id = ?").bind(id).first<CadetRow>();
  if (!existing) return c.json({ error: "Cadet not found" }, 404);

  const body = await c.req.json<Partial<{
    first_name: string;
    last_name: string;
    company: "A" | "B" | "C";
    position: string;
    rank: string | null;
    is_honor_guard: boolean;
    hg_rank: string | null;
  }>>();

  const merged = {
    first_name: body.first_name?.trim() ?? existing.first_name,
    last_name: body.last_name?.trim() ?? existing.last_name,
    company: body.company ?? existing.company,
    position: body.position?.trim() ?? existing.position,
    rank: body.rank !== undefined ? body.rank?.trim() || null : existing.rank,
    is_honor_guard: body.is_honor_guard ?? !!existing.is_honor_guard,
    hg_rank: body.is_honor_guard === false ? null : body.hg_rank ?? existing.hg_rank,
  };

  await DB.prepare(
    `UPDATE cadets SET first_name = ?, last_name = ?, company = ?, position = ?, rank = ?, is_honor_guard = ?, hg_rank = ?, updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      merged.first_name,
      merged.last_name,
      merged.company,
      merged.position,
      merged.rank,
      merged.is_honor_guard ? 1 : 0,
      merged.is_honor_guard ? merged.hg_rank : null,
      id,
    )
    .run();

  const updated = await DB.prepare("SELECT * FROM cadets WHERE id = ?").bind(id).first<CadetRow>();
  return c.json(serializeCadet(updated!));
});

// DELETE /api/cadets/:id
cadets.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { DB } = c.env;

  const existing = await DB.prepare("SELECT id FROM cadets WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Cadet not found" }, 404);

  await DB.prepare("DELETE FROM cadets WHERE id = ?").bind(id).run();
  return c.body(null, 204);
});
