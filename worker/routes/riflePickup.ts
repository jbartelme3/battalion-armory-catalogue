import { Hono } from "hono";
import type { CadetRow, Env, EquipmentHistoryRow, EquipmentRow } from "../types";
import { PLATOON_SERGEANT_POSITION, effectiveCondition, resolveEligibleSlots } from "../lib/equipmentRules";
import { performAssignment } from "../lib/assignment";
import { serializeCadet, serializeHistory } from "../lib/serialize";

export const riflePickup = new Hono<{ Bindings: Env }>();

// The leading run of digits in a tag, e.g. "01A" -> 1, "12B" -> 12. Infantry
// Rifle tags are numbered first, company letter last, so "lowest available"
// means lowest leading number. Tags with no leading digits sort last
// (Infinity) rather than erroring out.
function numericTagRank(tag: string): number {
  const match = tag.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : Infinity;
}

type PickupOutcome =
  | { status: "unmatched"; scanned_id: string }
  | { status: "not_found" }
  | { status: "ineligible"; cadet: ReturnType<typeof serializeCadet>; reason: string }
  | { status: "none_available"; cadet: ReturnType<typeof serializeCadet> }
  | { status: "checked_in" | "checked_out"; cadet: ReturnType<typeof serializeCadet>; item: { id: number; tag: string } }
  | { status: "error"; error: string };

// Shared core for /scan, /manual, and /link: given a resolved cadet, either
// return their currently-checked-out Infantry Rifle (if they have one) or
// issue the lowest-numbered eligible one available. This is exactly what
// scanning the same person's ID twice on pickup day should do — check out,
// then check back in on the way out.
async function checkInOrOutInfantryRifle(DB: D1Database, cadet: CadetRow): Promise<PickupOutcome> {
  const eligible = resolveEligibleSlots({ ...cadet, is_honor_guard: !!cadet.is_honor_guard });
  if (!eligible.infantry_rifle) {
    return {
      status: "ineligible",
      cadet: serializeCadet(cadet),
      reason: `${cadet.first_name} ${cadet.last_name} (${cadet.position}) isn't eligible for an Infantry Rifle.`,
    };
  }

  const current = await DB.prepare("SELECT * FROM equipment_items WHERE type = 'infantry_rifle' AND owner_cadet_id = ?")
    .bind(cadet.id)
    .first<EquipmentRow>();

  if (current) {
    const result = await performAssignment(DB, current.id, null);
    if (!result.ok) return { status: "error", error: result.error };
    return { status: "checked_in", cadet: serializeCadet(cadet), item: { id: result.item.id, tag: result.item.tag } };
  }

  const isPs = cadet.position === PLATOON_SERGEANT_POSITION;
  const { results: candidates } = await DB.prepare(
    "SELECT * FROM equipment_items WHERE type = 'infantry_rifle' AND owner_cadet_id IS NULL AND is_ps_rifle = ? AND company = ?",
  )
    .bind(isPs ? 1 : 0, cadet.company)
    .all<EquipmentRow>();

  const pick = candidates
    .filter((item) => effectiveCondition({ type: "infantry_rifle", manual_condition: item.manual_condition, has_sheath: null, has_pompom: null }) !== "red")
    .sort((a, b) => numericTagRank(a.tag) - numericTagRank(b.tag))[0];

  if (!pick) return { status: "none_available", cadet: serializeCadet(cadet) };

  const result = await performAssignment(DB, pick.id, cadet.id);
  if (!result.ok) return { status: "error", error: result.error };
  return { status: "checked_out", cadet: serializeCadet(cadet), item: { id: result.item.id, tag: result.item.tag } };
}

// POST /api/rifle-pickup/scan — the primary entry point, fed by the ID scanner.
riflePickup.post("/scan", async (c) => {
  const body = await c.req.json<{ scanned_id?: string }>();
  const scannedId = body.scanned_id?.trim();
  if (!scannedId) return c.json({ error: "scanned_id is required" }, 400);

  const { DB } = c.env;
  const cadet = await DB.prepare("SELECT * FROM cadets WHERE student_id = ?").bind(scannedId).first<CadetRow>();
  if (!cadet) return c.json({ status: "unmatched", scanned_id: scannedId } satisfies PickupOutcome);

  const outcome = await checkInOrOutInfantryRifle(DB, cadet);
  if (outcome.status === "error") return c.json({ error: outcome.error }, 400);
  return c.json(outcome);
});

// POST /api/rifle-pickup/manual — the "look up by name" fallback for a lost/forgotten ID.
riflePickup.post("/manual", async (c) => {
  const body = await c.req.json<{ cadet_id?: number }>();
  if (!body.cadet_id) return c.json({ error: "cadet_id is required" }, 400);

  const { DB } = c.env;
  const cadet = await DB.prepare("SELECT * FROM cadets WHERE id = ?").bind(body.cadet_id).first<CadetRow>();
  if (!cadet) return c.json({ status: "not_found" } satisfies PickupOutcome, 404);

  const outcome = await checkInOrOutInfantryRifle(DB, cadet);
  if (outcome.status === "error") return c.json({ error: outcome.error }, 400);
  return c.json(outcome);
});

// POST /api/rifle-pickup/link — resolves an unmatched scan to a cadet (saving
// the scan for next time) and immediately performs the checkout/check-in.
riflePickup.post("/link", async (c) => {
  const body = await c.req.json<{ cadet_id?: number; scanned_id?: string }>();
  const scannedId = body.scanned_id?.trim();
  if (!body.cadet_id || !scannedId) return c.json({ error: "cadet_id and scanned_id are required" }, 400);

  const { DB } = c.env;
  const cadet = await DB.prepare("SELECT * FROM cadets WHERE id = ?").bind(body.cadet_id).first<CadetRow>();
  if (!cadet) return c.json({ status: "not_found" } satisfies PickupOutcome, 404);

  try {
    await DB.prepare("UPDATE cadets SET student_id = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(scannedId, body.cadet_id)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return c.json({ error: "That scanned ID is already linked to a different cadet." }, 400);
    }
    throw err;
  }

  const outcome = await checkInOrOutInfantryRifle(DB, { ...cadet, student_id: scannedId });
  if (outcome.status === "error") return c.json({ error: outcome.error }, 400);
  return c.json(outcome);
});

// GET /api/rifle-pickup/activity?limit=50 — recent Infantry Rifle checkouts/returns, newest first.
riflePickup.get("/activity", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const { DB } = c.env;
  const { results } = await DB.prepare(
    "SELECT * FROM equipment_assignment_history WHERE equipment_type = 'infantry_rifle' ORDER BY checked_out_at DESC, id DESC LIMIT ?",
  )
    .bind(limit)
    .all<EquipmentHistoryRow>();
  return c.json(results.map(serializeHistory));
});
