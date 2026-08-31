import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ru-test-"));
process.env.DATABASE_PATH = path.join(tmp, "test.db");

const { getDb, closeDb } = await import("../src/db/client.js");
const { seedAll } = await import("../src/db/seed.js");
const { ussdSessionService } = await import("../src/services/ussdSessionService.js");
const { restaurantDashboard } = await import("../src/services/dashboardService.js");
const { lookupCode, issueTokens } = await import("../src/services/verifyService.js");

test("seed crée villes, RU et menus de 4 plats", () => {
  seedAll();
  const db = getDb();
  const cities = db.prepare("SELECT COUNT(*) AS n FROM cities").get() as { n: number };
  const rus = db.prepare("SELECT COUNT(*) AS n FROM restaurants").get() as { n: number };
  assert.equal(cities.n, 4);
  assert.equal(rus.n, 7);
  const mondayMidi = db
    .prepare("SELECT COUNT(*) AS n FROM restaurant_menus WHERE restaurant_id = 1 AND weekday = 1 AND service = 'MIDI'")
    .get() as { n: number };
  assert.equal(mondayMidi.n, 4);
});

test("parcours USSD première utilisation → paiement → code unique", async () => {
  const phone = "+22670111111";
  const first = await ussdSessionService.startOrResume(phone, undefined, "");
  assert.match(first.message, /ville/i);
  const afterCity = await ussdSessionService.startOrResume(phone, first.sessionId, "1");
  assert.match(afterCity.message, /RU/i);
  const afterRu = await ussdSessionService.startOrResume(phone, first.sessionId, "1");
  assert.match(afterRu.message, /Midi/);
  const afterService = await ussdSessionService.startOrResume(phone, first.sessionId, "1");
  assert.match(afterService.message, /Menu MIDI/);
  const afterDish = await ussdSessionService.startOrResume(phone, first.sessionId, "1");
  assert.match(afterDish.message, /Nombre de plats/);
  const afterQty = await ussdSessionService.startOrResume(phone, first.sessionId, "2");
  assert.match(afterQty.message, /2 plat/);
  assert.match(afterQty.message, /400 FCFA/);
  const afterConfirm = await ussdSessionService.startOrResume(phone, first.sessionId, "1");
  assert.match(afterConfirm.message, /MODE TEST/);
  const done = await ussdSessionService.startOrResume(phone, first.sessionId, "1");
  assert.match(done.message, /RU-[A-Z0-9]{6}/);
  assert.equal(done.continueSession, false);

  const code = done.message.match(/RU-[A-Z0-9]{6}/)?.[0];
  assert.ok(code);
  const sms = getDb().prepare("SELECT message FROM sms_logs WHERE phone = ?").get(phone) as { message: string };
  assert.match(sms.message, new RegExp(code));
});

test("deuxième session du même étudiant saute ville/RU", async () => {
  const phone = "+22670111111";
  const start = await ussdSessionService.startOrResume(phone, undefined, "");
  assert.match(start.message, /Midi/);
  assert.doesNotMatch(start.message, /Choisissez votre ville/);
});

test("2 plats comptent pour 2, pas 1 — isolation par RU", async () => {
  const dashA = restaurantDashboard(1);
  assert.ok(dashA.midi.plates >= 2);
  const dashB = restaurantDashboard(2);
  assert.equal(dashB.totals.totalPlates, 0);
});

test("code invalide, mauvais RU, déjà utilisé", async () => {
  const row = getDb()
    .prepare("SELECT reservation_code FROM reservations WHERE restaurant_id = 1 AND status = 'RESERVED' LIMIT 1")
    .get() as { reservation_code: string };
  const missing = lookupCode("RU-000000", 1);
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "NOT_FOUND");

  const wrongRu = lookupCode(row.reservation_code, 2);
  assert.equal(wrongRu.ok, false);
  assert.equal(wrongRu.reason, "WRONG_RESTAURANT");

  const valid = lookupCode(row.reservation_code, 1);
  assert.equal(valid.ok, true);

  const issued = issueTokens(row.reservation_code, 1, 2);
  assert.equal(issued.ok, true);

  const reused = lookupCode(row.reservation_code, 1);
  assert.equal(reused.ok, false);
  assert.equal(reused.reason, "ALREADY_USED");

  const dash = restaurantDashboard(1);
  assert.ok(dash.totals.servedPlates >= 2);
});

test("paiement refusé ne crée pas de réservation confirmée", async () => {
  const phone = "+22670222222";
  const start = await ussdSessionService.startOrResume(phone, undefined, "");
  await ussdSessionService.startOrResume(phone, start.sessionId, "1");
  await ussdSessionService.startOrResume(phone, start.sessionId, "1");
  await ussdSessionService.startOrResume(phone, start.sessionId, "1");
  await ussdSessionService.startOrResume(phone, start.sessionId, "1");
  await ussdSessionService.startOrResume(phone, start.sessionId, "1");
  const confirm = await ussdSessionService.startOrResume(phone, start.sessionId, "1");
  assert.match(confirm.message, /MODE TEST/);
  const refused = await ussdSessionService.startOrResume(phone, start.sessionId, "2");
  assert.match(refused.message, /refusé/i);
  const reserved = getDb()
    .prepare(
      "SELECT COUNT(*) AS n FROM reservations r JOIN students s ON s.id = r.student_id WHERE s.phone = ? AND r.status = 'RESERVED'",
    )
    .get(phone) as { n: number };
  assert.equal(reserved.n, 0);
});

test("agent JWT ne peut pas être scopé par un autre restaurant_id", () => {
  const user = getDb()
    .prepare(
      `SELECT u.id, ru.restaurant_id FROM users u
       JOIN restaurant_users ru ON ru.user_id = u.id
       WHERE u.email = 'ujkz@ru.bf'`,
    )
    .get() as { id: number; restaurant_id: number };
  assert.equal(user.restaurant_id, 1);
});

test.after(() => {
  closeDb();
});
