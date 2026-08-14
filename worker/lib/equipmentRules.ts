// Single source of truth for eligibility and condition logic, per the Battalion
// Armory Catalogue spec. Every read path (cadet profile, equipment list) must
// go through these functions rather than re-deriving the rules inline.

export type Condition = "green" | "yellow" | "red";

export type EquipmentType =
  | "infantry_rifle"
  | "honor_guard_rifle"
  | "bayonet"
  | "dress_jacket"
  | "dress_cover";

export const EQUIPMENT_TYPES: EquipmentType[] = [
  "infantry_rifle",
  "honor_guard_rifle",
  "bayonet",
  "dress_jacket",
  "dress_cover",
];

// Platoon Sergeants carry a specific blank-firing rifle (a designated subset of
// Infantry Rifles), and only Platoon Sergeants may be assigned one.
export const PLATOON_SERGEANT_POSITION = "Platoon Sergeant";

// Honor Guard Squad Leaders carry a specific black bayonet (a designated
// subset of Bayonets), and only Honor Guard Squad Leaders may be assigned one.
export const SQUAD_LEADER_POSITION = "Squad Leader";

// Positions exempt from carrying a rifle (sword-bearing NCOs and Commissioned
// Officers, battalion level). Not every one of these will be in use in the
// Infantry battalion specifically, but any cadet whose position matches one
// of these is treated as rifle-exempt.
export const SWORD_BEARING_NCO_POSITIONS = [
  "First Sergeant",
  "Operations Sergeant",
  "Battalion Sergeant Major",
  "Regimental Sergeant Major",
  "Regimental Operations Sergeant Major",
  "Regimental Color Sergeant Major",
] as const;

export const COMMISSIONED_OFFICER_POSITIONS = [
  "Platoon Leader",
  "Executive Officer",
  "Unit Commander",
  "Battalion Operations Officer",
  "Battalion Adjutant",
  "Battalion Commander",
  "Regimental Operations Officer",
  "Regimental Adjutant",
  "Regimental Commander",
] as const;

// Additional rifle-exempt battalion/unit support positions confirmed against
// the Culver Student Handbook's CMA Leadership Positions section: the Battalion
// Armory Officer/NCO manages rifle accountability rather than carrying one, the
// Guidon Bearer carries the unit's guidon flag in formation instead of a rifle,
// and Battalion Supply Officer / Battalion Athletic Officer are staff billets.
// (Unit NCO carries an Infantry Rifle like any other Guardsman/line position —
// not exempt. Unit Athletic/Supply/Academic Officer, Branch Insignia Officer,
// and Unit Clerk are collateral duties held alongside a cadet's primary
// position, so they aren't separate selectable positions here — eligibility
// follows whatever primary position the cadet actually holds.)
export const SUPPORT_EXEMPT_POSITIONS = [
  "Battalion Armory Officer/NCO",
  "Guidon Bearer",
  "Battalion Supply Officer",
  "Battalion Athletic Officer",
] as const;

// Regimental "auxiliary" staff positions (everything on the Regimental Staff
// other than the Sergeants Major and the Commander/Adjutant/Operations
// Officer trio, which already live in the lists above). Senior-only,
// Staff-Sergeant-rank billets — rifle-exempt like the rest of Regimental staff.
export const REGIMENTAL_AUXILIARY_POSITIONS = [
  "Regimental Supply Officer",
  "Regimental Athletic Officer",
  "Regimental Aide to Administration",
  "Regimental Aide to Admissions",
  "Regimental Aide to Academics",
  "Regimental Aide to Spiritual Life",
  "Regimental Honor Officer",
  "Regimental Diversity Officer",
  "Regimental Drum Major",
  "Regimental Honor Captain",
] as const;

const EXEMPT_POSITIONS = new Set<string>([
  ...SWORD_BEARING_NCO_POSITIONS,
  ...COMMISSIONED_OFFICER_POSITIONS,
  ...SUPPORT_EXEMPT_POSITIONS,
  ...REGIMENTAL_AUXILIARY_POSITIONS,
]);

// The four Honor Guard leadership ranks. Cadets holding one of these are
// exempt from both rifles AND the bayonet, but still get the jacket + cover.
export const HG_LEADERSHIP_RANKS = [
  "Commander",
  "Executive Officer",
  "First Sergeant",
  "Color Sergeant",
] as const;

// Line ranks within the Honor Guard (as distinct from a cadet's overall
// battalion rank) — these carry rifles/bayonets like any other Guardsman.
// Informational only; they don't affect eligibility.
export const HG_LINE_RANKS = ["Lieutenant", "Staff Sergeant", "Sergeant", "Corporal", "Private First Class", "Private"] as const;

const HG_LEADERSHIP_SET = new Set<string>(HG_LEADERSHIP_RANKS);

export interface CadetLike {
  position: string;
  is_honor_guard: boolean;
  hg_rank: string | null;
  company: string;
}

export function isBattalionExempt(cadet: CadetLike): boolean {
  return EXEMPT_POSITIONS.has(cadet.position);
}

export function isHgLeadership(cadet: CadetLike): boolean {
  return cadet.is_honor_guard && !!cadet.hg_rank && HG_LEADERSHIP_SET.has(cadet.hg_rank);
}

export interface EligibleSlots {
  infantry_rifle: boolean;
  honor_guard_rifle: boolean;
  bayonet: boolean;
  dress_jacket: boolean;
  dress_cover: boolean;
}

/**
 * Which equipment types a cadet should be assigned, per the doc's rules:
 * - Infantry Rifle eligible for every cadet unless battalion-exempt or HG
 *   leadership. Being an Honor Guard member does NOT by itself exclude a
 *   cadet from the Infantry Rifle: a line-rank Guardsman (e.g. a PFC in
 *   both their regular position and the Honor Guard) carries both.
 * - Honor Guard Rifle eligible for HG members who are not battalion-exempt
 *   or HG leadership.
 * - Bayonet eligible for HG members who are not HG leadership.
 * - Jacket/Cover eligible for all HG members, regardless of exemptions.
 * - Non-HG cadets never get Honor Guard equipment.
 */
export function resolveEligibleSlots(cadet: CadetLike): EligibleSlots {
  const battalionExempt = isBattalionExempt(cadet);
  const hgLeadership = isHgLeadership(cadet);
  const rifleEligible = !battalionExempt && !hgLeadership;

  return {
    infantry_rifle: rifleEligible,
    honor_guard_rifle: cadet.is_honor_guard && rifleEligible,
    bayonet: cadet.is_honor_guard && !hgLeadership,
    dress_jacket: cadet.is_honor_guard,
    dress_cover: cadet.is_honor_guard,
  };
}

export interface AssignableEquipmentLike {
  type: EquipmentType;
  is_ps_rifle?: boolean;
  is_black_sl_bayonet?: boolean;
  company?: string | null;
}

/**
 * Whether the given cadet can hold the given equipment item — general slot
 * eligibility (from resolveEligibleSlots) plus the PS Rifle / Black SL Bayonet
 * sub-type constraints. Returns an error message, or null if the assignment
 * is valid. Shared by both the assign route and any update that could change
 * a sub-type flag on an item that's currently assigned.
 */
export function validateAssignment(cadet: CadetLike, item: AssignableEquipmentLike): string | null {
  const eligible = resolveEligibleSlots(cadet);
  if (!eligible[item.type]) {
    return `This cadet isn't eligible to hold a ${item.type.replace(/_/g, " ")}.`;
  }

  if (item.type === "infantry_rifle") {
    const cadetIsPs = cadet.position === PLATOON_SERGEANT_POSITION;
    const itemIsPs = !!item.is_ps_rifle;
    if (cadetIsPs && !itemIsPs) return "Platoon Sergeants must be assigned a PS Rifle.";
    if (!cadetIsPs && itemIsPs) return "PS Rifles can only be assigned to a Platoon Sergeant.";
    if (item.company && item.company !== cadet.company) {
      return `This rifle belongs to Company ${item.company}'s pool; the cadet is in Company ${cadet.company}.`;
    }
  }

  if (item.type === "bayonet") {
    const cadetIsSl = cadet.position === SQUAD_LEADER_POSITION;
    const itemIsBlack = !!item.is_black_sl_bayonet;
    if (cadetIsSl && !itemIsBlack) return "Honor Guard Squad Leaders must be assigned the Black SL Bayonet.";
    if (!cadetIsSl && itemIsBlack) return "The Black SL Bayonet can only be assigned to a Honor Guard Squad Leader.";
  }

  return null;
}

export interface EquipmentItemLike {
  type: EquipmentType;
  manual_condition: Condition;
  has_sheath: boolean | null;
  has_pompom: boolean | null;
}

/**
 * The condition actually shown/sorted on, after applying the auto-red rules:
 * a bayonet missing its sheath, or a dress cover missing its pompom, is
 * always Red regardless of the manually-set condition.
 */
export function effectiveCondition(item: EquipmentItemLike): Condition {
  if (item.type === "bayonet" && item.has_sheath === false) return "red";
  if (item.type === "dress_cover" && item.has_pompom === false) return "red";
  return item.manual_condition;
}

const CONDITION_SORT_RANK: Record<Condition, number> = { red: 0, yellow: 1, green: 2 };

export function conditionSortRank(condition: Condition): number {
  return CONDITION_SORT_RANK[condition];
}
