import { Hono } from "hono";
import type { CadetRow, Env, EquipmentRow } from "../types";
import {
  EQUIPMENT_TYPES,
  conditionSortRank,
  effectiveCondition,
  validateAssignment,
  type EquipmentType,
} from "../lib/equipmentRules";

export const equipment = new Hono<{ Bindings: Env }>();

type RowWithOwner = EquipmentRow & {
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_company: string | null;
};

function serialize(row: RowWithOwner) {
  const hasSheath = row.has_sheath === null ? null : !!row.has_sheath;
  const hasPompom = row.has_pompom === null ? null : !!row.has_pompom;
  return {
    id: row.id,
    type: row.type,
    tag: row.tag,
    manual_condition: row.manual_condition,
    condition: effectiveCondition({
      type: row.type as EquipmentType,
      manual_condition: row.manual_condition,
      has_sheath: hasSheath,
      has_pompom: hasPompom,
    }),
    owner_cadet_id: row.owner_cadet_id,
    owner_name:
      row.owner_first_name && row.owner_last_name ? `${row.owner_first_name} ${row.owner_last_name}` : null,
    owner_company: row.owner_company,
    has_sheath: hasSheath,
    has_pompom: hasPompom,
    size: row.size,
    is_ps_rifle: !!row.is_ps_rifle,
    is_black_sl_bayonet: !!row.is_black_sl_bayonet,
  };
}

function toCadetLike(cadet: CadetRow) {
  return { position: cadet.position, is_honor_guard: !!cadet.is_honor_guard, hg_rank: cadet.hg_rank };
}

const SELECT_WITH_OWNER = `
  SELECT e.*, c.first_name AS owner_first_name, c.last_name AS owner_last_name, c.company AS owner_company
  FROM equipment_items e
  LEFT JOIN cadets c ON c.id = e.owner_cadet_id
`;

// GET /api/equipment?type=infantry_rifle
equipment.get("/", async (c) => {
  const type = c.req.query("type");
  const { DB } = c.env;

  if (type && !EQUIPMENT_TYPES.includes(type as EquipmentType)) {
    return c.json({ error: `Invalid type. Must be one of: ${EQUIPMENT_TYPES.join(", ")}` }, 400);
  }

  const stmt = type
    ? DB.prepare(`${SELECT_WITH_OWNER} WHERE e.type = ? ORDER BY e.tag COLLATE NOCASE`).bind(type)
    : DB.prepare(`${SELECT_WITH_OWNER} ORDER BY e.type, e.tag COLLATE NOCASE`);

  const { results } = await stmt.all<RowWithOwner>();
  return c.json(results.map(serialize));
});

// GET /api/equipment/needs-repair — Red items first, then Yellow, across all types
equipment.get("/needs-repair", async (c) => {
  const { DB } = c.env;
  const { results } = await DB.prepare(`${SELECT_WITH_OWNER} ORDER BY e.type, e.tag COLLATE NOCASE`).all<RowWithOwner>();

  const items = results
    .map(serialize)
    .filter((item) => item.condition === "red" || item.condition === "yellow")
    .sort((a, b) => conditionSortRank(a.condition) - conditionSortRank(b.condition));

  return c.json(items);
});

// GET /api/equipment/:id
equipment.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { DB } = c.env;
  const row = await DB.prepare(`${SELECT_WITH_OWNER} WHERE e.id = ?`).bind(id).first<RowWithOwner>();
  if (!row) return c.json({ error: "Equipment item not found" }, 404);
  return c.json(serialize(row));
});

// POST /api/equipment
equipment.post("/", async (c) => {
  const body = await c.req.json<{
    type: EquipmentType;
    tag: string;
    manual_condition?: "green" | "yellow" | "red";
    has_sheath?: boolean;
    has_pompom?: boolean;
    size?: string;
    is_ps_rifle?: boolean;
    is_black_sl_bayonet?: boolean;
  }>();

  if (!EQUIPMENT_TYPES.includes(body.type)) {
    return c.json({ error: `Invalid type. Must be one of: ${EQUIPMENT_TYPES.join(", ")}` }, 400);
  }
  if (!body.tag?.trim()) {
    return c.json({ error: "tag is required" }, 400);
  }

  const { DB } = c.env;
  const result = await DB.prepare(
    `INSERT INTO equipment_items (type, tag, manual_condition, has_sheath, has_pompom, size, is_ps_rifle, is_black_sl_bayonet, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(
      body.type,
      body.tag.trim(),
      body.manual_condition ?? "green",
      body.type === "bayonet" ? (body.has_sheath ?? true ? 1 : 0) : null,
      body.type === "dress_cover" ? (body.has_pompom ?? true ? 1 : 0) : null,
      body.type === "dress_jacket" ? body.size ?? null : null,
      body.type === "infantry_rifle" && body.is_ps_rifle ? 1 : 0,
      body.type === "bayonet" && body.is_black_sl_bayonet ? 1 : 0,
    )
    .run();

  const row = await DB.prepare(`${SELECT_WITH_OWNER} WHERE e.id = ?`)
    .bind(result.meta.last_row_id)
    .first<RowWithOwner>();

  return c.json(serialize(row!), 201);
});

// PATCH /api/equipment/:id — update condition, tag, accessory flags, size
equipment.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { DB } = c.env;

  const existing = await DB.prepare("SELECT * FROM equipment_items WHERE id = ?").bind(id).first<EquipmentRow>();
  if (!existing) return c.json({ error: "Equipment item not found" }, 404);

  const body = await c.req.json<Partial<{
    tag: string;
    manual_condition: "green" | "yellow" | "red";
    has_sheath: boolean;
    has_pompom: boolean;
    size: string;
    is_ps_rifle: boolean;
    is_black_sl_bayonet: boolean;
  }>>();

  const merged = {
    tag: body.tag?.trim() ?? existing.tag,
    manual_condition: body.manual_condition ?? existing.manual_condition,
    has_sheath:
      existing.type === "bayonet" ? (body.has_sheath !== undefined ? (body.has_sheath ? 1 : 0) : existing.has_sheath) : null,
    has_pompom:
      existing.type === "dress_cover"
        ? body.has_pompom !== undefined
          ? body.has_pompom
            ? 1
            : 0
          : existing.has_pompom
        : null,
    size: existing.type === "dress_jacket" ? body.size ?? existing.size : null,
    is_ps_rifle:
      existing.type === "infantry_rifle"
        ? body.is_ps_rifle !== undefined
          ? body.is_ps_rifle
            ? 1
            : 0
          : existing.is_ps_rifle
        : 0,
    is_black_sl_bayonet:
      existing.type === "bayonet"
        ? body.is_black_sl_bayonet !== undefined
          ? body.is_black_sl_bayonet
            ? 1
            : 0
          : existing.is_black_sl_bayonet
        : 0,
  };

  // If the item is currently assigned, make sure the update (e.g. flipping the
  // PS Rifle / Black SL Bayonet flag) doesn't break that assignment's validity.
  if (existing.owner_cadet_id !== null) {
    const owner = await DB.prepare("SELECT * FROM cadets WHERE id = ?").bind(existing.owner_cadet_id).first<CadetRow>();
    if (owner) {
      const error = validateAssignment(toCadetLike(owner), {
        type: existing.type as EquipmentType,
        is_ps_rifle: !!merged.is_ps_rifle,
        is_black_sl_bayonet: !!merged.is_black_sl_bayonet,
      });
      if (error) return c.json({ error: `${error} Unassign this item first.` }, 400);
    }
  }

  await DB.prepare(
    `UPDATE equipment_items SET tag = ?, manual_condition = ?, has_sheath = ?, has_pompom = ?, size = ?, is_ps_rifle = ?, is_black_sl_bayonet = ?, updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      merged.tag,
      merged.manual_condition,
      merged.has_sheath,
      merged.has_pompom,
      merged.size,
      merged.is_ps_rifle,
      merged.is_black_sl_bayonet,
      id,
    )
    .run();

  const row = await DB.prepare(`${SELECT_WITH_OWNER} WHERE e.id = ?`).bind(id).first<RowWithOwner>();
  return c.json(serialize(row!));
});

// POST /api/equipment/:id/assign — assign/reassign/unassign ownership (the "substitute" action).
// If the target cadet already holds another item of this type, that item is freed up (unassigned)
// so it stays in the catalogue rather than being silently orphaned.
equipment.post("/:id/assign", async (c) => {
  const id = Number(c.req.param("id"));
  const { DB } = c.env;

  const item = await DB.prepare("SELECT * FROM equipment_items WHERE id = ?").bind(id).first<EquipmentRow>();
  if (!item) return c.json({ error: "Equipment item not found" }, 404);

  const body = await c.req.json<{ cadet_id: number | null }>();

  if (body.cadet_id !== null) {
    const cadet = await DB.prepare("SELECT * FROM cadets WHERE id = ?").bind(body.cadet_id).first<CadetRow>();
    if (!cadet) return c.json({ error: "Cadet not found" }, 404);

    const error = validateAssignment(toCadetLike(cadet), {
      type: item.type as EquipmentType,
      is_ps_rifle: !!item.is_ps_rifle,
      is_black_sl_bayonet: !!item.is_black_sl_bayonet,
    });
    if (error) return c.json({ error }, 400);

    await DB.prepare(
      "UPDATE equipment_items SET owner_cadet_id = NULL, updated_at = datetime('now') WHERE type = ? AND owner_cadet_id = ? AND id != ?",
    )
      .bind(item.type, body.cadet_id, id)
      .run();
  }

  await DB.prepare("UPDATE equipment_items SET owner_cadet_id = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(body.cadet_id, id)
    .run();

  const row = await DB.prepare(`${SELECT_WITH_OWNER} WHERE e.id = ?`).bind(id).first<RowWithOwner>();
  return c.json(serialize(row!));
});

// DELETE /api/equipment/:id
equipment.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { DB } = c.env;

  const existing = await DB.prepare("SELECT id FROM equipment_items WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Equipment item not found" }, 404);

  await DB.prepare("DELETE FROM equipment_items WHERE id = ?").bind(id).run();
  return c.body(null, 204);
});
