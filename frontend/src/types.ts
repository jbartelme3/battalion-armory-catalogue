export type Condition = "green" | "yellow" | "red";

export type EquipmentType = "infantry_rifle" | "honor_guard_rifle" | "bayonet" | "dress_jacket" | "dress_cover";

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  infantry_rifle: "Infantry Rifles",
  honor_guard_rifle: "Honor Guard Rifles",
  bayonet: "Bayonet",
  dress_cover: "Dress Cover",
  dress_jacket: "Dress Jacket",
};

// Display order for the Equipment tab, per spec: Infantry Rifles, Honor Guard
// Rifles, Bayonet, Dress Cover, Dress Jacket, then Needs Repair (handled separately).
export const EQUIPMENT_TYPE_ORDER: EquipmentType[] = [
  "infantry_rifle",
  "honor_guard_rifle",
  "bayonet",
  "dress_cover",
  "dress_jacket",
];

export const PLATOON_SERGEANT_POSITION = "Platoon Sergeant";
export const SQUAD_LEADER_POSITION = "Squad Leader";

// Fixed tag prefix per equipment type — users only ever enter the number that
// follows. Bayonet has two prefixes depending on the Black SL Bayonet flag.
export const TAG_PREFIXES: Record<EquipmentType, string> = {
  infantry_rifle: "IR-",
  honor_guard_rifle: "HGR-",
  bayonet: "BAY-",
  dress_cover: "DC-",
  dress_jacket: "DJ-",
};

export const BAYONET_TAG_PREFIX_BLACK_SL = "BSL-";

export function tagPrefixFor(type: EquipmentType, isBlackSlBayonet?: boolean): string {
  if (type === "bayonet" && isBlackSlBayonet) return BAYONET_TAG_PREFIX_BLACK_SL;
  return TAG_PREFIXES[type];
}

// Strips whichever known prefix (for this type) the tag starts with, leaving
// just the number part for editing. Falls back to the raw tag if it doesn't
// match any known prefix (e.g. legacy/custom tags).
export function tagNumberPart(type: EquipmentType, tag: string): string {
  const prefixes = type === "bayonet" ? [BAYONET_TAG_PREFIX_BLACK_SL, TAG_PREFIXES.bayonet] : [TAG_PREFIXES[type]];
  for (const prefix of prefixes) {
    if (tag.startsWith(prefix)) return tag.slice(prefix.length);
  }
  return tag;
}

// The only Honor Guard members who do NOT carry an Honor Guard Rifle (they're
// also exempt from the Bayonet, but still get the Jacket and Cover).
export const HG_LEADERSHIP_RANKS = ["Commander", "Executive Officer", "First Sergeant", "Color Sergeant"] as const;

// Line ranks within the Honor Guard (distinct from a cadet's overall battalion
// rank) — these carry rifles/bayonets like any other Guardsman.
export const HG_LINE_RANKS = [
  "Lieutenant",
  "Staff Sergeant",
  "Sergeant",
  "Corporal",
  "Private First Class",
  "Private",
] as const;

export const HG_RANK_ABBREVIATIONS: Record<string, string> = {
  Commander: "COM",
  "Executive Officer": "XO",
  "First Sergeant": "1SGT",
  "Color Sergeant": "CS",
  Lieutenant: "LT",
  "Staff Sergeant": "SSG",
  Sergeant: "SGT",
  Corporal: "CPL",
  "Private First Class": "PFC",
  Private: "PVT",
};

export function formatHgRank(rank: string | null): string | null {
  if (!rank) return null;
  const abbrev = HG_RANK_ABBREVIATIONS[rank];
  return abbrev ? `${rank} (${abbrev})` : rank;
}

// Cadet rank (separate from duty position). Rank alone doesn't determine
// rifle eligibility — that's driven entirely by position (see ALL_POSITIONS)
// — but officer-tier ranks (2LT/1LT/CPT) will typically belong to cadets
// holding an exempt Commissioned Officer position.
export const RANKS = [
  "New Cadet",
  "Private",
  "Private First Class",
  "Lance Corporal",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Second Lieutenant",
  "First Lieutenant",
  "Captain",
];

export const RANK_ABBREVIATIONS: Record<string, string> = {
  "New Cadet": "NC",
  Private: "PVT",
  "Private First Class": "PFC",
  "Lance Corporal": "LCPL",
  Corporal: "CPL",
  Sergeant: "SGT",
  "Staff Sergeant": "SSG",
  "Second Lieutenant": "2LT",
  "First Lieutenant": "1LT",
  Captain: "CPT",
};

export function formatRank(rank: string | null): string {
  if (!rank) return "—";
  const abbrev = RANK_ABBREVIATIONS[rank];
  return abbrev ? `${rank} (${abbrev})` : rank;
}

export interface PositionOption {
  label: string;
  abbrev: string;
  exempt: boolean;
}

// Duty positions that carry a rifle (not exempt).
export const RIFLE_CARRYING_POSITIONS: PositionOption[] = [
  { label: "New Cadet", abbrev: "NC", exempt: false },
  { label: "Element", abbrev: "ELT", exempt: false },
  { label: "Team Leader", abbrev: "TL", exempt: false },
  { label: "Squad Leader", abbrev: "SL", exempt: false },
  { label: PLATOON_SERGEANT_POSITION, abbrev: "PS", exempt: false },
  { label: "Unit NCO", abbrev: "UNCO", exempt: false },
];

// Sword-bearing NCO positions — exempt from rifles (battalion level).
export const SWORD_BEARING_NCO_POSITIONS: PositionOption[] = [
  { label: "First Sergeant", abbrev: "1SGT", exempt: true },
  { label: "Operations Sergeant", abbrev: "OPS", exempt: true },
  { label: "Battalion Sergeant Major", abbrev: "BSM", exempt: true },
  { label: "Regimental Sergeant Major", abbrev: "RSM", exempt: true },
  { label: "Regimental Operations Sergeant Major", abbrev: "ROSM", exempt: true },
  { label: "Regimental Color Sergeant Major", abbrev: "RCSM", exempt: true },
];

// Commissioned Officer positions — exempt from rifles (battalion level).
export const COMMISSIONED_OFFICER_POSITIONS: PositionOption[] = [
  { label: "Platoon Leader", abbrev: "PL", exempt: true },
  { label: "Executive Officer", abbrev: "XO", exempt: true },
  { label: "Unit Commander", abbrev: "UC", exempt: true },
  { label: "Battalion Operations Officer", abbrev: "BATOPS", exempt: true },
  { label: "Battalion Adjutant", abbrev: "BATADJ", exempt: true },
  { label: "Battalion Commander", abbrev: "BATCOM", exempt: true },
  { label: "Regimental Operations Officer", abbrev: "REGOPS", exempt: true },
  { label: "Regimental Adjutant", abbrev: "REGADJ", exempt: true },
  { label: "Regimental Commander", abbrev: "REGCOM", exempt: true },
];

// Additional rifle-exempt battalion/unit support positions, confirmed against
// the Culver Student Handbook's CMA Leadership Positions section. (Unit NCO
// carries an Infantry Rifle like any other Guardsman/line position — see
// RIFLE_CARRYING_POSITIONS. Unit Athletic/Supply/Academic Officer, Branch
// Insignia Officer, and Unit Clerk are collateral duties held alongside a
// cadet's primary position, so they aren't separate selectable positions here
// — eligibility follows the primary position.)
export const SUPPORT_EXEMPT_POSITIONS: PositionOption[] = [
  { label: "Battalion Armory Officer/NCO", abbrev: "ARMORER", exempt: true },
  { label: "Guidon Bearer", abbrev: "GUIDON", exempt: true },
  { label: "Battalion Supply Officer", abbrev: "BATSUP", exempt: true },
  { label: "Battalion Athletic Officer", abbrev: "BATATH", exempt: true },
];

export const ALL_POSITIONS: PositionOption[] = [
  ...RIFLE_CARRYING_POSITIONS,
  ...SWORD_BEARING_NCO_POSITIONS,
  ...COMMISSIONED_OFFICER_POSITIONS,
  ...SUPPORT_EXEMPT_POSITIONS,
];

export function formatPosition(position: string): string {
  const found = ALL_POSITIONS.find((p) => p.label === position);
  return found ? `${found.label} (${found.abbrev})` : position;
}

export interface CadetRifle {
  type: EquipmentType;
  tag: string;
  condition: Condition;
}

export interface Cadet {
  id: number;
  first_name: string;
  last_name: string;
  company: "A" | "B" | "C";
  position: string;
  rank: string | null;
  is_honor_guard: boolean;
  hg_rank: string | null;
  rifle?: CadetRifle | null;
}

export const CONDITION_TEXT_COLOR: Record<Condition, string> = {
  green: "text-green-700",
  yellow: "text-yellow-700",
  red: "text-red-700",
};

export interface EligibleSlots {
  infantry_rifle: boolean;
  honor_guard_rifle: boolean;
  bayonet: boolean;
  dress_jacket: boolean;
  dress_cover: boolean;
}

export interface EquipmentItem {
  id: number;
  type: EquipmentType;
  tag: string;
  manual_condition: Condition;
  condition: Condition;
  owner_cadet_id: number | null;
  owner_name?: string | null;
  owner_company?: "A" | "B" | "C" | null;
  has_sheath: boolean | null;
  has_pompom: boolean | null;
  size: string | null;
  is_ps_rifle: boolean;
  is_black_sl_bayonet: boolean;
}

export interface CadetProfile extends Cadet {
  eligible_slots: EligibleSlots;
  equipment: EquipmentItem[];
}

// Mirrors worker/lib/equipmentRules.ts — kept in sync by hand since the
// frontend and worker are separate build contexts.
export function isHgLeadershipCadet(cadet: Pick<Cadet, "is_honor_guard" | "hg_rank">): boolean {
  return cadet.is_honor_guard && !!cadet.hg_rank && (HG_LEADERSHIP_RANKS as readonly string[]).includes(cadet.hg_rank);
}

export function isBattalionExemptCadet(cadet: Pick<Cadet, "position">): boolean {
  return ALL_POSITIONS.find((p) => p.label === cadet.position)?.exempt ?? false;
}

export function isCadetEligibleForEquipmentType(
  cadet: Pick<Cadet, "position" | "is_honor_guard" | "hg_rank">,
  type: EquipmentType,
): boolean {
  const battalionExempt = isBattalionExemptCadet(cadet);
  const hgLeadership = isHgLeadershipCadet(cadet);
  const rifleEligible = !battalionExempt && !hgLeadership;

  if (cadet.is_honor_guard) {
    switch (type) {
      case "honor_guard_rifle":
        return rifleEligible;
      case "bayonet":
        return !hgLeadership;
      case "dress_jacket":
      case "dress_cover":
        return true;
      case "infantry_rifle":
        return false;
    }
  }

  return type === "infantry_rifle" ? rifleEligible : false;
}
