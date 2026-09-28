import { test } from "node:test";
import assert from "node:assert/strict";
import { STAFF_KINDS, validateStaffData } from "../worker/lib/staffKinds.ts";

const kind = (key: string) => STAFF_KINDS.find((k) => k.key === key)!;

test("every record type's special fields name real fields", () => {
  for (const k of STAFF_KINDS) {
    const keys = k.fields.map((f) => f.key);
    for (const ref of [k.titleField, k.dateField, k.companyField, k.statusField]) {
      if (ref) assert.ok(keys.includes(ref), `${k.key}: ${ref} is not a field`);
    }
    for (const s of k.openStatuses ?? []) {
      const status = k.fields.find((f) => f.key === k.statusField)!;
      assert.ok(status.options?.includes(s), `${k.key}: open status "${s}" is not an option`);
    }
  }
});

test("required fields, selects, dates and companies are enforced; unknown keys dropped", () => {
  const orders = kind("orders");
  const base = { type: "Order", title: "T", body: "B", effective: "2026-09-28" };
  assert.equal(validateStaffData(orders, { ...base, title: " " }).ok, false);
  assert.equal(validateStaffData(orders, { ...base, type: "Memo" }).ok, false);
  assert.equal(validateStaffData(orders, { ...base, effective: "9/28/2026" }).ok, false);
  assert.equal(validateStaffData(orders, { ...base, audience: "D" }).ok, false);
  const ok = validateStaffData(orders, { ...base, audience: "", extra: "x" });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.data.audience, null);
    assert.equal("extra" in ok.data, false);
  }
});

test("First Sergeant's reports must balance", () => {
  const r = kind("first_sgt_reports");
  const base = { date: "2026-09-27", company: "B", formation: "Retreat", assigned: 53, submitted: "Submitted" };
  assert.equal(validateStaffData(r, { ...base, present: 50, excused: 1, unexcused: 1 }).ok, false);
  assert.equal(validateStaffData(r, { ...base, present: 50, excused: 2, unexcused: 1 }).ok, true);
});

test("laundry pickup needs a time, not before notification", () => {
  const l = kind("laundry");
  const base = { notified: "2026-09-26T09:00", company: "B", items: 6 };
  assert.equal(validateStaffData(l, { ...base, status: "Picked up" }).ok, false);
  assert.equal(validateStaffData(l, { ...base, status: "Picked up", picked_up: "2026-09-25T09:00" }).ok, false);
  assert.equal(validateStaffData(l, { ...base, status: "Picked up", picked_up: "2026-09-26T20:00" }).ok, true);
});

test("completed work orders need a completion date", () => {
  const w = kind("work_orders");
  const base = { submitted: "2026-09-27", location: "Room 214", category: "Plumbing", description: "Leak" };
  assert.equal(validateStaffData(w, { ...base, status: "Completed" }).ok, false);
  assert.equal(validateStaffData(w, { ...base, status: "Completed", completed: "2026-09-28" }).ok, true);
});
