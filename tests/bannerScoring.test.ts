// Run with `npm test`. Node strips the TypeScript types itself, so these
// import the worker's scoring module directly with no build step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreWeek, type ScoringEvent } from "../worker/lib/bannerScoring.ts";

const WEEK = { strength_a: 54, strength_b: 53, strength_c: 53 };

function ev(category: string, a: number, b: number, c: number, inspected: [number | null, number | null, number | null] = [null, null, null]): ScoringEvent {
  return { category, gigs_a: a, gigs_b: b, gigs_c: c, inspected_a: inspected[0], inspected_b: inspected[1], inspected_c: inspected[2] };
}

test("an empty week ties everyone at 12 and shares the banner", () => {
  const r = scoreWeek(WEEK, []);
  assert.deepEqual(r.scores, { A: 12, B: 12, C: 12 });
  assert.deepEqual(r.winners, ["A", "B", "C"]);
  assert.match(r.tiebreakNotes[0], /still tied/);
});

test("category ties share the better place and skip the next (1, 1, 3)", () => {
  const r = scoreWeek(WEEK, [ev("atvs", 4, 4, 1)]);
  const atvs = r.categories.find((c) => c.key === "atvs")!;
  assert.deepEqual(atvs.ranks, { A: 2, B: 2, C: 1 });
  const bed = scoreWeek(WEEK, [ev("bed_checks", 0, 0, 3)]).categories.find((c) => c.key === "bed_checks")!;
  assert.deepEqual(bed.ranks, { A: 1, B: 1, C: 3 });
});

test("room inspections are scored per cadet, using cadets inspected when given", () => {
  // Same 20 gigs each, but B only had 40 cadets inspected: 0.370, 0.5, 0.377.
  const rooms = scoreWeek(WEEK, [ev("rooms", 20, 20, 20, [null, 40, null])]).categories.find((c) => c.key === "rooms")!;
  assert.deepEqual(rooms.ranks, { A: 1, B: 3, C: 2 });
  // A count category with the same numbers is a three-way tie.
  const atvs = scoreWeek(WEEK, [ev("atvs", 20, 20, 20)]).categories.find((c) => c.key === "atvs")!;
  assert.deepEqual(atvs.ranks, { A: 1, B: 1, C: 1 });
});

test("per-cadet totals that are equal after division still tie (no floating-point noise)", () => {
  // 1/3 + 1/3 + 1/3 vs 1: equal in exact arithmetic, not in floating point.
  const w = { strength_a: 3, strength_b: 1, strength_c: 1 };
  const rooms = scoreWeek(w, [ev("rooms", 1, 1, 1), ev("rooms", 1, 0, 0), ev("rooms", 1, 0, 0)]).categories.find((c) => c.key === "rooms")!;
  assert.deepEqual(rooms.ranks, { A: 1, B: 1, C: 1 });
});

test("tied scores are broken by ATVs first", () => {
  // A: ATVs 3rd, bed checks 1st, rooms 1st. C: 2nd, 2nd, 1st. Both 14.
  const r = scoreWeek(WEEK, [ev("atvs", 2, 0, 1), ev("bed_checks", 0, 5, 1), ev("rooms", 0, 30, 0)]);
  assert.deepEqual(r.scores, { A: 14, B: 16, C: 14 });
  assert.equal(r.places.C, 1);
  assert.equal(r.places.A, 2);
  assert.match(r.tiebreakNotes.join(" "), /broken by ATVs/);
});

test("ATVs outrank Laundry when the two tie-breakers disagree", () => {
  // A and C tie; A has fewer ATVs but more laundry gigs. ATVs decide.
  const r = scoreWeek(WEEK, [ev("atvs", 1, 0, 2), ev("laundry", 3, 0, 1)]);
  assert.equal(r.scores.A, r.scores.C);
  assert.equal(r.places.A, 2);
  assert.equal(r.places.C, 3);
});

test("falls through to Laundry when ATVs are also tied", () => {
  const r = scoreWeek(WEEK, [ev("laundry", 2, 0, 1), ev("bed_checks", 0, 5, 0)]);
  assert.deepEqual(r.scores, { A: 14, B: 14, C: 13 });
  assert.equal(r.places.C, 1);
  // A and B tie at 14 with equal ATVs; B has fewer laundry gigs.
  assert.equal(r.places.B, 2);
  assert.equal(r.places.A, 3);
  assert.match(r.tiebreakNotes.join(" "), /broken by Laundry Bags/);
});

// Real weeks from the BSM Bat Banner spreadsheet (see migration 0004).
test("Sep 13-20 recalculates exactly as the spreadsheet recorded it", () => {
  const r = scoreWeek(WEEK, [
    ev("rooms", 36, 42, 28),
    ev("rooms", 4, 7, 4),
    ev("accountability", 0, 2, 0),
    ev("atvs", 2, 3, 2),
    ev("common_area", 2, 3, 0),
    ev("bat_staff", 0, 3, 2),
    ev("bsm_brc", 1, 0, 0, [11, null, null]),
    ev("bsm_brc", 0, 1, 1, [null, 8, 12]),
  ]);
  assert.deepEqual(r.scores, { A: 15, B: 24, C: 13 });
  assert.deepEqual(r.places, { A: 2, B: 3, C: 1 });
});

test("Sep 20-27: B's typed-over Parade score is caught and the A/C tie goes to C on ATVs", () => {
  const r = scoreWeek(WEEK, [
    ev("rooms", 23, 41, 18),
    ev("atvs", 4, 4, 1),
    ev("common_area", 1, 3, 2),
    ev("parade_retreat", 1, 5, 3),
    ev("laundry", 1, 1, 1),
    ev("regimental", 0, 1, 0),
  ]);
  // The spreadsheet recorded B at 19 and A and C sharing the banner.
  assert.deepEqual(r.scores, { A: 14, B: 21, C: 14 });
  assert.deepEqual(r.winners, ["C"]);
});
