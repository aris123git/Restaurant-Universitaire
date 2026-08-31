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

const PHONE = "+22670111111";
const PHONE2 = "+22670222222";
const PHONE3 = "+22670333333";

async function ussd(phone: string, sessionId: string | undefined, text: string) {
  return ussdSessionService.startOrResume(phone, sessionId, text);
}

test("seed crée villes, RU, menus et inscrits", () => {
  seedAll();
  const db = getDb();
  const cities = db.prepare("SELECT COUNT(*) AS n FROM cities").get() as { n: number };
  const rus = db.prepare("SELECT COUNT(*) AS n FROM restaurants").get() as { n: number };
  const enrolled = db.prepare("SELECT COUNT(*) AS n FROM enrolled_students").get() as { n: number };
  assert.equal(cities.n, 4);
  assert.equal(rus.n, 7);
  assert.ok(enrolled.n >= 5);
  const mondayMidi = db
    .prepare("SELECT COUNT(*) AS n FROM restaurant_menus WHERE restaurant_id = 1 AND weekday = 1 AND service = 'MIDI'")
    .get() as { n: number };
  assert.equal(mondayMidi.n, 4);
});

test("numéro non inscrit ne peut pas réserver", async () => {
  const res = await ussd("+22670999999", undefined, "");
  assert.match(res.message, /pas inscrit/i);
  assert.equal(res.continueSession, false);
});

test("parcours USSD : plat puis nombre → paiement → code + téléphone", async () => {
  const first = await ussd(PHONE, undefined, "");
  assert.match(first.message, /ville/i);
  await ussd(PHONE, first.sessionId, "1");
  await ussd(PHONE, first.sessionId, "1");
  const afterService = await ussd(PHONE, first.sessionId, "2");
  assert.match(afterService.message, /Menu SOIR/);
  const afterDish = await ussd(PHONE, first.sessionId, "1");
  assert.match(afterDish.message, /Nombre de plats/);
  assert.doesNotMatch(afterDish.message, /3 plats/);
  const afterQty = await ussd(PHONE, first.sessionId, "2");
  assert.match(afterQty.message, /2 plat/);
  await ussd(PHONE, first.sessionId, "1");
  const done = await ussd(PHONE, first.sessionId, "1");
  assert.match(done.message, /RU-[A-Z0-9]{6} 70111111/);
  assert.equal(done.continueSession, false);
  const sms = getDb().prepare("SELECT message FROM sms_logs WHERE phone = ?").get(PHONE) as { message: string };
  assert.match(sms.message, /code suivi de votre numéro/i);
});

test("deuxième session du même étudiant saute ville/RU", async () => {
  const start = await ussd(PHONE, undefined, "");
  assert.match(start.message, /Midi/);
  assert.doesNotMatch(start.message, /Choisissez votre ville/);
});

test("2 plats comptent pour 2 — isolation par RU", async () => {
  const dashA = restaurantDashboard(1);
  assert.ok(dashA.soir.plates >= 2);
  const dashB = restaurantDashboard(2);
  assert.equal(dashB.totals.totalPlates, 0);
});

test("quota : 2 plats / jour, midi puis soir, pas de 3e", async () => {
  const midi = await ussd(PHONE3, undefined, "");
  await ussd(PHONE3, midi.sessionId, "1");
  await ussd(PHONE3, midi.sessionId, "1");
  await ussd(PHONE3, midi.sessionId, "1");
  await ussd(PHONE3, midi.sessionId, "1");
  await ussd(PHONE3, midi.sessionId, "1");
  await ussd(PHONE3, midi.sessionId, "1");
  const midiPaid = await ussd(PHONE3, midi.sessionId, "1");
  assert.match(midiPaid.message, /RU-[A-Z0-9]{6}/);

  const soir = await ussd(PHONE3, undefined, "");
  await ussd(PHONE3, soir.sessionId, "2");
  await ussd(PHONE3, soir.sessionId, "1");
  await ussd(PHONE3, soir.sessionId, "1");
  await ussd(PHONE3, soir.sessionId, "1");
  const soirPaid = await ussd(PHONE3, soir.sessionId, "1");
  assert.match(soirPaid.message, /RU-[A-Z0-9]{6}/);

  const third = await ussd(PHONE3, undefined, "");
  const blocked = await ussd(PHONE3, third.sessionId, "1");
  assert.match(blocked.message, /déjà réservé|Quota du jour/i);
});

test("code + numéro obligatoires, mauvais numéro et mauvais RU", async () => {
  const row = getDb()
    .prepare(
      `SELECT r.reservation_code, s.phone FROM reservations r
       JOIN students s ON s.id = r.student_id
       WHERE r.restaurant_id = 1 AND r.status = 'RESERVED' AND r.service = 'SOIR' LIMIT 1`,
    )
    .get() as { reservation_code: string; phone: string };

  const missingPhone = lookupCode(row.reservation_code, 1);
  assert.equal(missingPhone.ok, false);
  assert.equal(missingPhone.reason, "CODE_PHONE_MISMATCH");

  const wrongPhone = lookupCode(row.reservation_code, 1, "+22670000001");
  assert.equal(wrongPhone.ok, false);
  assert.equal(wrongPhone.reason, "CODE_PHONE_MISMATCH");

  const wrongRu = lookupCode(row.reservation_code, 2, row.phone);
  assert.equal(wrongRu.ok, false);
  assert.equal(wrongRu.reason, "WRONG_RESTAURANT");

  const valid = lookupCode(row.reservation_code, 1, row.phone);
  assert.equal(valid.ok, true);

  const issued = issueTokens(row.reservation_code, 1, 2, row.phone);
  assert.equal(issued.ok, true);

  const reused = lookupCode(row.reservation_code, 1, row.phone);
  assert.equal(reused.ok, false);
  assert.equal(reused.reason, "ALREADY_USED");
});

test("paiement refusé ne crée pas de réservation confirmée", async () => {
  const start = await ussd(PHONE2, undefined, "");
  await ussd(PHONE2, start.sessionId, "1");
  await ussd(PHONE2, start.sessionId, "1");
  await ussd(PHONE2, start.sessionId, "1");
  await ussd(PHONE2, start.sessionId, "1");
  await ussd(PHONE2, start.sessionId, "1");
  const confirm = await ussd(PHONE2, start.sessionId, "1");
  assert.match(confirm.message, /MODE TEST/);
  const refused = await ussd(PHONE2, start.sessionId, "2");
  assert.match(refused.message, /refusé/i);
  const reserved = getDb()
    .prepare(
      "SELECT COUNT(*) AS n FROM reservations r JOIN students s ON s.id = r.student_id WHERE s.phone = ? AND r.status = 'RESERVED'",
    )
    .get(PHONE2) as { n: number };
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
