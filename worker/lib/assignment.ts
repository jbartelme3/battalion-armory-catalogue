import type { CadetRow, EquipmentRow } from "../types";
import { validateAssignment, type EquipmentType } from "./equipmentRules";

export type EquipmentRowWithOwner = EquipmentRow & {
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_company: string | null;
};

export type AssignmentResult = { ok: true; item: EquipmentRowWithOwner } | { ok: false; status: 400 | 404; error: string };

function toCadetLike(cadet: CadetRow) {
  return { position: cadet.position, is_honor_guard: !!cadet.is_honor_guard, hg_rank: cadet.hg_rank, company: cadet.company };
}

const SELECT_WITH_OWNER_BY_ID = `
  SELECT e.*, c.first_name AS owner_first_name, c.last_name AS owner_last_name, c.company AS owner_company
  FROM equipment_items e
  LEFT JOIN cadets c ON c.id = e.owner_cadet_id
  WHERE e.id = ?
`;

/**
 * Single choke point for every equipment ownership change ("assign /
 * reassign / unassign"), shared by the Equipment tab's assign route and the
 * Rifle Pickup scan/manual routes. Keeps equipment_items.owner_cadet_id and
 * equipment_assignment_history in lockstep so accountability history never
 * drifts from the live assignment.
 */
export async function performAssignment(DB: D1Database, itemId: number, cadetId: number | null): Promise<AssignmentResult> {
  const item = await DB.prepare("SELECT * FROM equipment_items WHERE id = ?").bind(itemId).first<EquipmentRow>();
  if (!item) return { ok: false, status: 404, error: "Equipment item not found" };

  let cadet: CadetRow | null = null;
  if (cadetId !== null) {
    cadet = await DB.prepare("SELECT * FROM cadets WHERE id = ?").bind(cadetId).first<CadetRow>();
    if (!cadet) return { ok: false, status: 404, error: "Cadet not found" };

    const error = validateAssignment(toCadetLike(cadet), {
      type: item.type as EquipmentType,
      is_ps_rifle: !!item.is_ps_rifle,
      is_black_sl_bayonet: !!item.is_black_sl_bayonet,
      company: item.company,
    });
    if (error) return { ok: false, status: 400, error };

    // Free up any other item of this type the cadet already holds (and close
    // out its history), mirroring the "one item per type" rule the
    // substitute modal has always enforced.
    const { results: others } = await DB.prepare(
      "SELECT id FROM equipment_items WHERE type = ? AND owner_cadet_id = ? AND id != ?",
    )
      .bind(item.type, cadetId, itemId)
      .all<{ id: number }>();

    for (const other of others) {
      await DB.prepare(
        "UPDATE equipment_assignment_history SET checked_in_at = datetime('now') WHERE equipment_id = ? AND checked_in_at IS NULL",
      )
        .bind(other.id)
        .run();
      await DB.prepare("UPDATE equipment_items SET owner_cadet_id = NULL, updated_at = datetime('now') WHERE id = ?")
        .bind(other.id)
        .run();
    }
  }

  const isChange = item.owner_cadet_id !== cadetId;

  if (isChange) {
    await DB.prepare(
      "UPDATE equipment_assignment_history SET checked_in_at = datetime('now') WHERE equipment_id = ? AND checked_in_at IS NULL",
    )
      .bind(itemId)
      .run();
  }

  await DB.prepare("UPDATE equipment_items SET owner_cadet_id = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(cadetId, itemId)
    .run();

  if (isChange && cadet) {
    await DB.prepare(
      `INSERT INTO equipment_assignment_history
         (equipment_id, equipment_type, equipment_tag, cadet_id, cadet_first_name, cadet_last_name, cadet_company, checked_out_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(itemId, item.type, item.tag, cadet.id, cadet.first_name, cadet.last_name, cadet.company)
      .run();
  }

  const row = await DB.prepare(SELECT_WITH_OWNER_BY_ID).bind(itemId).first<EquipmentRowWithOwner>();
  return { ok: true, item: row! };
}
