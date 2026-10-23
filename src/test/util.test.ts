import test from "node:test";
import assert from "node:assert/strict";
import { isIsoDate, daysUntil, sha256 } from "../util.js";

test("validates calendar dates strictly", () => {
  assert.equal(isIsoDate("2026-10-23"), true);
  assert.equal(isIsoDate("2026-10-22T22:49:00.000Z"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("not-a-date"), false);
});

test("shutdown day boundaries are calculated in UTC calendar days", () => {
  assert.equal(daysUntil("2026-10-23", new Date("2026-10-22T23:59:00.000Z")), 1);
  assert.equal(daysUntil("2026-10-23", new Date("2026-10-23T00:00:00.000Z")), 0);
  assert.equal(daysUntil("2026-10-22", new Date("2026-10-23T00:00:00.000Z")), -1);
});

test("SHA-256 helper produces a stable digest", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
