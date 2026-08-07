import type { CadetRow, EquipmentRow } from "../types";
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
