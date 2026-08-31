import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

if (!process.env.DATABASE_PATH) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ru-quota-"));
  process.env.DATABASE_PATH = path.join(dir, "quota.db");
}

const { dailyCeiling } = await import("../src/services/quotaService.js");
const { remainingDaysInMonth } = await import("../src/lib/dates.js");

test("10 jours et 21 plats : 3 aujourd'hui, puis 2", () => {
  assert.equal(dailyCeiling(21, 10), 3);
  assert.equal(dailyCeiling(18, 9), 2);
  assert.equal(dailyCeiling(16, 8), 2);
  assert.equal(dailyCeiling(2, 1), 2);
});

test("assez de plats pour 3 par jour jusqu'à la fin", () => {
  assert.equal(dailyCeiling(30, 10), 3);
  assert.equal(dailyCeiling(70, 31), 3);
});

test("dernier jour : jusqu'à 3, limité au reste", () => {
  assert.equal(dailyCeiling(70, 1), 3);
  assert.equal(dailyCeiling(1, 1), 1);
  assert.equal(dailyCeiling(0, 5), 0);
});

test("22 au 31 août = 10 jours restants", () => {
  assert.equal(remainingDaysInMonth("2026-08-22"), 10);
  assert.equal(remainingDaysInMonth("2026-08-31"), 1);
});
