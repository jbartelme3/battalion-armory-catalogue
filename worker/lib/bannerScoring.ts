// Weekly Battalion Banner scoring. Mirrors the BSM spreadsheet and CMA 3-1
// SOP 18 (Military Banner Competition):
//   - Each category's weekly total is the sum of its events. Per-cadet
//     categories divide each event's gigs by the cadets inspected (default:
//     the company's strength that week) so a bigger company isn't penalized
//     for having more rooms/cadets to gig.
//   - Companies are ranked 1-3 in every category, fewest first. Ties share
//     the better place and skip the next (two tied for first -> 1, 1, 3).
//   - A company's weekly score is the sum of its 12 category ranks; lowest wins.
//   - Tied scores are broken by ATVs, then Laundry, then BRC/DRC (SOP 18,
//     Encl. 1). Still tied -> the banner is shared.

export type Company = "A" | "B" | "C";
export const COMPANIES: Company[] = ["A", "B", "C"];

export interface BannerCategory {
  key: string;
  label: string;
  perCadet: boolean;
  hint?: string;
}

export const BANNER_CATEGORIES: BannerCategory[] = [
  { key: "rooms", label: "Room Inspections", perCadet: true },
  { key: "accountability", label: "Accountability", perCadet: false, hint: "Late = 0.5, Absent = 1" },
  { key: "atvs", label: "ATVs", perCadet: false },
  { key: "common_area", label: "Common Area / Major Inspection", perCadet: false },
  { key: "parade_retreat", label: "Parade / Retreat", perCadet: false },
  { key: "bed_checks", label: "Bed Checks", perCadet: false },
  { key: "brc_drc", label: "BRC / DRC Inspections", perCadet: false },
  { key: "laundry", label: "Laundry Bags", perCadet: false },
  { key: "bat_staff", label: "Battalion Staff Inspections", perCadet: false },
  { key: "regimental", label: "Regimental Inspections", perCadet: false },
  { key: "bulletin_board", label: "Bulletin Board", perCadet: false },
  { key: "bsm_brc", label: "BSM BRC Inspections", perCadet: true },
];

export const TIEBREAK_ORDER = ["atvs", "laundry", "brc_drc"];

export interface ScoringWeek {
  strength_a: number;
  strength_b: number;
  strength_c: number;
}

export interface ScoringEvent {
  category: string;
  gigs_a: number;
  gigs_b: number;
  gigs_c: number;
  inspected_a: number | null;
  inspected_b: number | null;
  inspected_c: number | null;
}

type PerCompany<T> = Record<Company, T>;

export interface CategoryResult {
  key: string;
  label: string;
  perCadet: boolean;
  eventCount: number;
  totals: PerCompany<number>;
  ranks: PerCompany<number>;
}

export interface WeekResult {
  categories: CategoryResult[];
  scores: PerCompany<number>;
  places: PerCompany<number>;
  winners: Company[];
  tiebreakNotes: string[];
}

// Category totals are sums of divided values, so compare at a fixed
// precision rather than trusting floating-point equality.
function norm(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

// Standard competition ranking over a sort key: lower is better, equal keys
// share the better place, and the next place skips accordingly.
function competitionRank(keys: PerCompany<number[]>): PerCompany<number> {
  const cmp = (x: number[], y: number[]) => {
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  const ranks = {} as PerCompany<number>;
  for (const c of COMPANIES) ranks[c] = 1 + COMPANIES.filter((o) => cmp(keys[o], keys[c]) < 0).length;
  return ranks;
}

export function eventValue(event: ScoringEvent, week: ScoringWeek, company: Company, perCadet: boolean): number {
  const lower = company.toLowerCase() as "a" | "b" | "c";
  const gigs = event[`gigs_${lower}`];
  if (!perCadet) return gigs;
  const inspected = event[`inspected_${lower}`] ?? week[`strength_${lower}`];
  return gigs / inspected;
}

export function scoreWeek(week: ScoringWeek, events: ScoringEvent[]): WeekResult {
  const categories: CategoryResult[] = BANNER_CATEGORIES.map((cat) => {
    const catEvents = events.filter((e) => e.category === cat.key);
    const totals = {} as PerCompany<number>;
    for (const c of COMPANIES) {
      totals[c] = norm(catEvents.reduce((sum, e) => sum + eventValue(e, week, c, cat.perCadet), 0));
    }
    const ranks = competitionRank({ A: [totals.A], B: [totals.B], C: [totals.C] });
    return { key: cat.key, label: cat.label, perCadet: cat.perCadet, eventCount: catEvents.length, totals, ranks };
  });

  const scores = {} as PerCompany<number>;
  for (const c of COMPANIES) scores[c] = categories.reduce((sum, cat) => sum + cat.ranks[c], 0);

  const tiebreakCats = TIEBREAK_ORDER.map((key) => categories.find((cat) => cat.key === key)!);
  const places = competitionRank({
    A: [scores.A, ...tiebreakCats.map((cat) => cat.totals.A)],
    B: [scores.B, ...tiebreakCats.map((cat) => cat.totals.B)],
    C: [scores.C, ...tiebreakCats.map((cat) => cat.totals.C)],
  });

  // Explain each tie on score: which tiebreaker separated it, or that it held.
  const tiebreakNotes: string[] = [];
  const seen = new Set<number>();
  for (const c of COMPANIES) {
    const score = scores[c];
    if (seen.has(score)) continue;
    seen.add(score);
    const tied = COMPANIES.filter((o) => scores[o] === score);
    if (tied.length < 2) continue;
    const names = tied.map((o) => `C${o}`).join(" and ");
    const decider = tiebreakCats.find((cat) => new Set(tied.map((o) => cat.totals[o])).size > 1);
    tiebreakNotes.push(
      decider
        ? `${names} tied at ${score}; broken by ${decider.label} (${tied.map((o) => `C${o} ${round3(decider.totals[o])}`).join(", ")}).`
        : `${names} tied at ${score} and still tied after ATVs, Laundry and BRC/DRC; place is shared.`,
    );
  }

  const winners = COMPANIES.filter((c) => places[c] === 1);
  return { categories, scores, places, winners, tiebreakNotes };
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
