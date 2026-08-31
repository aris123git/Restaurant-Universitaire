import { getDb, withTransaction } from "../db/client.js";
import { generateReservationCode } from "../lib/codes.js";
import { defaultExpiresAt, isExpired, todayIso } from "../lib/dates.js";
import { logger } from "../lib/logger.js";
import { SimulatedPaymentProvider } from "../integrations/payment/SimulatedPaymentProvider.js";
import { SimulatedSmsProvider } from "../integrations/sms/SimulatedSmsProvider.js";
import type { ServiceKind } from "../types.js";
import { findMenuItem } from "./menuService.js";
import { getRestaurant } from "./studentService.js";

const paymentProvider = new SimulatedPaymentProvider();
const smsProvider = new SimulatedSmsProvider();

export type ReservationRow = {
  id: number;
  student_id: number;
  restaurant_id: number;
  city_id: number;
  service: ServiceKind;
  date: string;
  dish_id: number;
  quantity: number;
  amount: number;
  reservation_code: string;
  payment_status: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  used_at: string | null;
  token_issued_at: string | null;
  served_at: string | null;
  expires_at: string;
};

export function expireIfNeeded(row: ReservationRow, now = new Date()): ReservationRow {
  if (
    row.status === "RESERVED" &&
    isExpired(row.expires_at, now)
  ) {
    getDb()
      .prepare("UPDATE reservations SET status = 'EXPIRED' WHERE id = ? AND status = 'RESERVED'")
      .run(row.id);
    return { ...row, status: "EXPIRED" };
  }
  return row;
}

function uniqueCode(): string {
  const db = getDb();
  for (let i = 0; i < 20; i++) {
    const code = generateReservationCode();
    const exists = db.prepare("SELECT id FROM reservations WHERE reservation_code = ?").get(code);
    if (!exists) return code;
  }
  throw new Error("Impossible de générer un code unique");
}

export function createPendingReservation(input: {
  studentId: number;
  restaurantId: number;
  cityId: number;
  service: ServiceKind;
  dishId: number;
  quantity: number;
  phone: string;
}): { reservation: ReservationRow; paymentId: number; transactionId: string } {
  const menuItem = findMenuItem(input.restaurantId, input.service, input.dishId);
  if (!menuItem) throw new Error("Ce plat n'est pas au menu aujourd'hui");
  const amount = menuItem.priceFcfa * input.quantity;
  const date = todayIso();
  const code = uniqueCode();
  const expiresAt = defaultExpiresAt(input.service, date);

  return withTransaction((db) => {
    const inserted = db
      .prepare(
        `INSERT INTO reservations (
          student_id, restaurant_id, city_id, service, date, dish_id, quantity, amount,
          reservation_code, payment_status, status, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING_PAYMENT', ?)`,
      )
      .run(
        input.studentId,
        input.restaurantId,
        input.cityId,
        input.service,
        date,
        input.dishId,
        input.quantity,
        amount,
        code,
        expiresAt,
      );
    const reservationId = Number(inserted.lastInsertRowid);
    const payment = db
      .prepare(
        `INSERT INTO payments (reservation_id, provider, transaction_id, amount, status)
         VALUES (?, 'simulated', NULL, ?, 'PENDING')`,
      )
      .run(reservationId, amount);
    const reservation = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId) as ReservationRow;
    return {
      reservation,
      paymentId: Number(payment.lastInsertRowid),
      transactionId: "",
    };
  });
}

export async function initiateSimulatedPayment(reservationId: number, phone: string) {
  const reservation = getDb().prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId) as
    | ReservationRow
    | undefined;
  if (!reservation) throw new Error("Réservation introuvable");
  const result = await paymentProvider.initiate({
    reservationId,
    amount: reservation.amount,
    phone,
    reference: reservation.reservation_code,
  });
  getDb()
    .prepare(
      `UPDATE payments SET transaction_id = ?, updated_at = datetime('now')
       WHERE reservation_id = ? AND status = 'PENDING'`,
    )
    .run(result.transactionId, reservationId);
  return result;
}

export async function confirmPayment(reservationId: number, outcome: "SUCCESS" | "FAILED") {
  const db = getDb();
  const reservation = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId) as
    | ReservationRow
    | undefined;
  if (!reservation) throw new Error("Réservation introuvable");
  if (reservation.payment_status === "PAID") {
    throw new Error("Paiement déjà confirmé");
  }
  if (reservation.status !== "PENDING_PAYMENT") {
    throw new Error("Cette réservation n'est plus en attente de paiement");
  }

  if (outcome === "FAILED") {
    withTransaction((tx) => {
      tx.prepare(
        `UPDATE payments SET status = 'FAILED', updated_at = datetime('now')
         WHERE reservation_id = ? AND status = 'PENDING'`,
      ).run(reservationId);
      tx.prepare(
        `UPDATE reservations SET payment_status = 'FAILED', status = 'CANCELLED' WHERE id = ?`,
      ).run(reservationId);
    });
    logger.info("payment.failed", { reservationId, simulated: true });
    return { ok: false as const, reservationId };
  }

  withTransaction((tx) => {
    const pay = tx
      .prepare(
        `UPDATE payments SET status = 'SUCCESS', updated_at = datetime('now')
         WHERE reservation_id = ? AND status = 'PENDING'`,
      )
      .run(reservationId);
    if (pay.changes !== 1) throw new Error("Paiement déjà traité");
    tx.prepare(
      `UPDATE reservations
       SET payment_status = 'PAID', status = 'RESERVED', paid_at = datetime('now')
       WHERE id = ? AND payment_status = 'PENDING'`,
    ).run(reservationId);
  });

  const paid = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId) as ReservationRow;
  const student = db.prepare("SELECT phone FROM students WHERE id = ?").get(paid.student_id) as { phone: string };
  const restaurant = getRestaurant(paid.restaurant_id);
  const dish = db.prepare("SELECT name FROM dishes WHERE id = ?").get(paid.dish_id) as { name: string };

  const sms = [
    "Votre réservation est confirmée.",
    "",
    `RU : ${restaurant?.name ?? ""}`,
    `Service : ${paid.service}`,
    `Plat : ${dish.name}`,
    `Nombre de plats : ${paid.quantity}`,
    "",
    "Code de retrait :",
    paid.reservation_code,
    "",
    "Présentez ce code au restaurant universitaire.",
    "Un jeton physique vous sera remis.",
    "",
    "[TEST] SMS simulé — aucun opérateur n'est intégré.",
  ].join("\n");

  await smsProvider.send({ phone: student.phone, body: sms, reservationId: paid.id });
  logger.info("payment.success", { reservationId, code: paid.reservation_code, simulated: true });
  return { ok: true as const, reservation: paid };
}
