import { getDb, withTransaction } from "../db/client.js";
import { logger } from "../lib/logger.js";
import { parseCodeAndPhone } from "../lib/codes.js";
import { phonesMatch } from "../lib/phone.js";
import { expireIfNeeded, type ReservationRow } from "./reservationService.js";

export type VerifyOutcome =
  | { ok: true; reason: "VALID"; reservation: ReservationDetail }
  | {
      ok: false;
      reason:
        | "NOT_FOUND"
        | "CODE_PHONE_MISMATCH"
        | "WRONG_RESTAURANT"
        | "ALREADY_USED"
        | "EXPIRED"
        | "NOT_PAID"
        | "CANCELLED";
    };

export type ReservationDetail = {
  id: number;
  code: string;
  phone: string;
  service: string;
  date: string;
  dishName: string;
  quantity: number;
  amount: number;
  status: string;
  paymentStatus: string;
};

function toDetail(row: ReservationRow & { phone: string; dish_name: string }): ReservationDetail {
  return {
    id: row.id,
    code: row.reservation_code,
    phone: row.phone,
    service: row.service,
    date: row.date,
    dishName: row.dish_name,
    quantity: row.quantity,
    amount: row.amount,
    status: row.status,
    paymentStatus: row.payment_status,
  };
}

function loadByCode(code: string) {
  return getDb()
    .prepare(
      `SELECT r.*, s.phone, d.name AS dish_name
       FROM reservations r
       JOIN students s ON s.id = r.student_id
       JOIN dishes d ON d.id = r.dish_id
       WHERE r.reservation_code = ?`,
    )
    .get(code) as (ReservationRow & { phone: string; dish_name: string }) | undefined;
}

export function lookupCode(codeRaw: string, restaurantId: number, phoneRaw?: string): VerifyOutcome {
  const parsed = parseCodeAndPhone(codeRaw, phoneRaw);
  if (!parsed.phone) return { ok: false, reason: "CODE_PHONE_MISMATCH" };
  const row = loadByCode(parsed.code);
  if (!row) return { ok: false, reason: "CODE_PHONE_MISMATCH" };
  if (!phonesMatch(row.phone, parsed.phone)) return { ok: false, reason: "CODE_PHONE_MISMATCH" };
  if (row.restaurant_id !== restaurantId) return { ok: false, reason: "WRONG_RESTAURANT" };
  const current = expireIfNeeded(row);
  if (current.status === "EXPIRED") return { ok: false, reason: "EXPIRED" };
  if (current.status === "CANCELLED") return { ok: false, reason: "CANCELLED" };
  if (current.payment_status !== "PAID") return { ok: false, reason: "NOT_PAID" };
  if (["CODE_USED", "TOKEN_ISSUED", "SERVED"].includes(current.status)) {
    return { ok: false, reason: "ALREADY_USED" };
  }
  return { ok: true, reason: "VALID", reservation: toDetail({ ...row, ...current }) };
}

export function issueTokens(codeRaw: string, restaurantId: number, userId: number, phoneRaw?: string): VerifyOutcome {
  const looked = lookupCode(codeRaw, restaurantId, phoneRaw);
  if (!looked.ok) return looked;
  const parsed = parseCodeAndPhone(codeRaw, phoneRaw);

  const result = withTransaction((db) => {
    const updated = db
      .prepare(
        `UPDATE reservations
         SET status = 'SERVED', used_at = datetime('now'), token_issued_at = datetime('now'), served_at = datetime('now')
         WHERE reservation_code = ? AND restaurant_id = ? AND status = 'RESERVED' AND payment_status = 'PAID'`,
      )
      .run(parsed.code, restaurantId);
    if (updated.changes !== 1) return null;
    db.prepare(
      `INSERT INTO tokens_issued (reservation_id, quantity, issued_by_user_id) VALUES (?, ?, ?)`,
    ).run(looked.reservation.id, looked.reservation.quantity, userId);
    db.prepare(
      `INSERT INTO audit_logs (actor_user_id, restaurant_id, action, details) VALUES (?, ?, 'TOKEN_ISSUED', ?)`,
    ).run(
      userId,
      restaurantId,
      JSON.stringify({
        code: looked.reservation.code,
        phone: looked.reservation.phone,
        quantity: looked.reservation.quantity,
      }),
    );
    return looked.reservation;
  });

  if (!result) {
    return { ok: false, reason: "ALREADY_USED" };
  }
  logger.info("token.issued", { code: result.code, restaurantId, quantity: result.quantity });
  return { ok: true, reason: "VALID", reservation: { ...result, status: "SERVED" } };
}
