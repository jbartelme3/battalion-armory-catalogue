import type { CadetRow, EquipmentHistoryRow, EquipmentRow } from "../types";
import { effectiveCondition, type EquipmentType } from "./equipmentRules";

export function serializeCadet(row: CadetRow) {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    company: row.company,
    position: row.position,
    rank: row.rank,
    classman: row.classman,
    is_honor_guard: !!row.is_honor_guard,
    hg_rank: row.hg_rank,
    student_id: row.student_id,
  };
}

export function serializeHistory(row: EquipmentHistoryRow) {
  return {
    id: row.id,
    equipment_id: row.equipment_id,
    equipment_type: row.equipment_type,
    equipment_tag: row.equipment_tag,
    cadet_id: row.cadet_id,
    cadet_name: `${row.cadet_first_name} ${row.cadet_last_name}`,
    cadet_company: row.cadet_company,
    checked_out_at: row.checked_out_at,
    checked_in_at: row.checked_in_at,
  };
}

export function serializeEquipment(row: EquipmentRow) {
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
    has_sheath: hasSheath,
    has_pompom: hasPompom,
    size: row.size,
    is_ps_rifle: !!row.is_ps_rifle,
    is_black_sl_bayonet: !!row.is_black_sl_bayonet,
  };
}
