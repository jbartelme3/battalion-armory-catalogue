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
  "Color Corporal",
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
  "Color Corporal": "CCPL",
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

// Regimental "auxiliary" staff positions — everything on the Regimental Staff
// besides the Sergeants Major and the Commander/Adjutant/Operations Officer
// trio (already covered above). Senior-only, Staff-Sergeant-rank, rifle-exempt.
export const REGIMENTAL_AUXILIARY_POSITIONS: PositionOption[] = [
  { label: "Regimental Supply Officer", abbrev: "REGSUP", exempt: true },
  { label: "Regimental Athletic Officer", abbrev: "REGATH", exempt: true },
  { label: "Regimental Aide to Administration", abbrev: "REGADMIN", exempt: true },
  { label: "Regimental Aide to Admissions", abbrev: "REGADMISS", exempt: true },
  { label: "Regimental Aide to Academics", abbrev: "REGACAD", exempt: true },
  { label: "Regimental Aide to Spiritual Life", abbrev: "REGSPIR", exempt: true },
  { label: "Regimental Honor Officer", abbrev: "REGHONOR", exempt: true },
  { label: "Regimental Diversity Officer", abbrev: "REGDIV", exempt: true },
  { label: "Regimental Drum Major", abbrev: "REGDRUM", exempt: true },
  { label: "Regimental Honor Captain", abbrev: "REGHONCAP", exempt: true },
];

export const ALL_POSITIONS: PositionOption[] = [
  ...RIFLE_CARRYING_POSITIONS,
  ...SWORD_BEARING_NCO_POSITIONS,
  ...COMMISSIONED_OFFICER_POSITIONS,
  ...SUPPORT_EXEMPT_POSITIONS,
  ...REGIMENTAL_AUXILIARY_POSITIONS,
];

// Classmen (grade levels). 4th = Freshman, 3rd = Sophomore, 2nd = Junior, 1st = Senior.
export const CLASSMEN = ["4th Classman", "3rd Classman", "2nd Classman", "1st Classman"] as const;
export type Classman = (typeof CLASSMEN)[number];

export const CLASSMAN_LABELS: Record<Classman, string> = {
  "4th Classman": "4th Classman (Freshman)",
  "3rd Classman": "3rd Classman (Sophomore)",
  "2nd Classman": "2nd Classman (Junior)",
  "1st Classman": "1st Classman (Senior)",
};

export function formatClassman(classman: string | null): string {
  if (!classman) return "—";
  return CLASSMAN_LABELS[classman as Classman] ?? classman;
}

export const CLASSMAN_SHORT_LABELS: Record<Classman, string> = {
  "4th Classman": "Freshman",
  "3rd Classman": "Sophomore",
  "2nd Classman": "Junior",
  "1st Classman": "Senior",
};

export function formatClassmanShort(classman: string | null): string | null {
  if (!classman) return null;
  return CLASSMAN_SHORT_LABELS[classman as Classman] ?? classman;
}

// Which classmen may hold each rank. Soft guide only (not server-enforced) —
// used to filter/suggest dropdown options, per CMA's rank-by-grade rules.
export const RANK_ALLOWED_CLASSMEN: Record<string, Classman[]> = {
  "New Cadet": ["4th Classman", "3rd Classman", "2nd Classman"],
  Private: ["4th Classman", "3rd Classman", "2nd Classman", "1st Classman"],
  "Private First Class": ["4th Classman", "3rd Classman", "2nd Classman", "1st Classman"],
  "Lance Corporal": ["3rd Classman", "2nd Classman", "1st Classman"],
  Corporal: ["3rd Classman", "2nd Classman", "1st Classman"],
  "Color Corporal": ["3rd Classman"],
  Sergeant: ["2nd Classman", "1st Classman"],
  "Staff Sergeant": ["1st Classman"],
  "Second Lieutenant": ["1st Classman"],
  "First Lieutenant": ["1st Classman"],
  Captain: ["1st Classman"],
};

export interface PositionConstraint {
  classmen?: Classman[];
  ranks?: string[];
}

// Which classmen (and, for some billets, which ranks) each position is
// restricted to. Positions not listed here are unconstrained by classman
// (e.g. Element, Team Leader, Squad Leader, Unit NCO — "vary based on unit").
export const POSITION_CONSTRAINTS: Record<string, PositionConstraint> = {
  "New Cadet": { classmen: ["4th Classman", "3rd Classman", "2nd Classman"] },
  [PLATOON_SERGEANT_POSITION]: { classmen: ["2nd Classman", "1st Classman"] },
  "First Sergeant": { classmen: ["2nd Classman"] },
  "Operations Sergeant": { classmen: ["2nd Classman"] },
  "Battalion Sergeant Major": { classmen: ["2nd Classman"] },
  "Regimental Sergeant Major": { classmen: ["2nd Classman"] },
  "Regimental Operations Sergeant Major": { classmen: ["2nd Classman"] },
  "Regimental Color Sergeant Major": { classmen: ["2nd Classman"] },
  "Platoon Leader": { classmen: ["1st Classman"] },
  "Executive Officer": { classmen: ["1st Classman"] },
  "Unit Commander": { classmen: ["1st Classman"] },
  "Battalion Operations Officer": { classmen: ["1st Classman"] },
  "Battalion Adjutant": { classmen: ["1st Classman"] },
  "Battalion Commander": { classmen: ["1st Classman"] },
  "Regimental Operations Officer": { classmen: ["1st Classman"] },
  "Regimental Adjutant": { classmen: ["1st Classman"] },
  "Regimental Commander": { classmen: ["1st Classman"] },
  "Battalion Armory Officer/NCO": { classmen: ["2nd Classman"] },
  "Guidon Bearer": { classmen: ["3rd Classman"] },
  "Battalion Supply Officer": { classmen: ["1st Classman"], ranks: ["Sergeant", "Staff Sergeant"] },
  "Battalion Athletic Officer": { classmen: ["2nd Classman"] },
  ...Object.fromEntries(
    REGIMENTAL_AUXILIARY_POSITIONS.map((p) => [p.label, { classmen: ["1st Classman"], ranks: ["Staff Sergeant"] }]),
  ),
};

// Platoon Sergeant rank is dictated by classman: a Junior PS is a Sergeant,
// a Senior PS is a Staff Sergeant.
export function platoonSergeantAutoRank(classman: string | null): string | null {
  if (classman === "2nd Classman") return "Sergeant";
  if (classman === "1st Classman") return "Staff Sergeant";
  return null;
}

// Rank/position options filtered (softly) by the selected classman. Always
// includes the current value even if it falls outside the filter, so editing
// existing data never hides its own current selection.
export function ranksForClassman(classman: string | null, currentValue?: string | null, allowedRanks?: string[]): string[] {
  return RANKS.filter((r) => {
    if (r === currentValue) return true;
    if (allowedRanks && !allowedRanks.includes(r)) return false;
    if (!classman) return true;
    const allowed = RANK_ALLOWED_CLASSMEN[r];
    return !allowed || allowed.includes(classman as Classman);
  });
}

export function positionsForClassman(classman: string | null, currentValue?: string | null): PositionOption[] {
  return ALL_POSITIONS.filter((p) => {
    if (p.label === currentValue) return true;
    if (!classman) return true;
    const allowed = POSITION_CONSTRAINTS[p.label]?.classmen;
    return !allowed || allowed.includes(classman as Classman);
  });
}

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
  classman: string | null;
  is_honor_guard: boolean;
  hg_rank: string | null;
  student_id: string | null;
  rifle?: CadetRifle | null;
}

// A single checkout/return record from equipment_assignment_history — shown
// on both the cadet profile's and the equipment item's "History" sections,
// and on the Rifle Pickup activity feed. checked_in_at === null means the
// assignment is still active (the item hasn't been returned yet).
export interface HistoryEntry {
  id: number;
  equipment_id: number | null;
  equipment_type: EquipmentType;
  equipment_tag: string;
  cadet_id: number | null;
  cadet_name: string;
  cadet_company: string;
  checked_out_at: string;
  checked_in_at: string | null;
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

// D1's datetime('now') yields "YYYY-MM-DD HH:MM:SS" in UTC, not full ISO —
// normalize to something the Date constructor parses reliably everywhere.
export function parseSqliteUtc(sqliteUtc: string): Date {
  const iso = sqliteUtc.includes("T") ? sqliteUtc : `${sqliteUtc.replace(" ", "T")}Z`;
  return new Date(iso);
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
