import { getDb } from "../db/client.js";
import { config } from "../config.js";
import { monthBounds, todayIso } from "../lib/dates.js";
import type { ServiceKind } from "../types.js";

const COUNTABLE = `status <> 'CANCELLED' AND payment_status IN ('PENDING', 'PAID')`;

export type QuotaSnapshot = {
  dayUsed: number;
  dayRemaining: number;
  monthUsed: number;
  monthRemaining: number;
  maxPerDay: number;
  maxPerMonth: number;
  serviceAlreadyBooked: boolean;
};

export function quotaForStudent(
  studentId: number,
  service: ServiceKind | null,
  dateIso = todayIso(),
): QuotaSnapshot {
  const db = getDb();
  const { start, end } = monthBounds(dateIso);
  const dayUsed = Number(
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(quantity), 0) AS n FROM reservations
           WHERE student_id = ? AND date = ? AND ${COUNTABLE}`,
        )
        .get(studentId, dateIso) as { n: number }
    ).n,
  );
  const monthUsed = Number(
    (
      db
        .prepare(
          `SELECT COALESCE(SUM(quantity), 0) AS n FROM reservations
           WHERE student_id = ? AND date BETWEEN ? AND ? AND ${COUNTABLE}`,
        )
        .get(studentId, start, end) as { n: number }
    ).n,
  );
  const serviceAlreadyBooked = service
    ? Boolean(
        db
          .prepare(
            `SELECT id FROM reservations
             WHERE student_id = ? AND date = ? AND service = ? AND ${COUNTABLE}
             LIMIT 1`,
          )
          .get(studentId, dateIso, service),
      )
    : false;
  return {
    dayUsed,
    dayRemaining: Math.max(0, config.maxPlatesPerDay - dayUsed),
    monthUsed,
    monthRemaining: Math.max(0, config.maxPlatesPerMonth - monthUsed),
    maxPerDay: config.maxPlatesPerDay,
    maxPerMonth: config.maxPlatesPerMonth,
    serviceAlreadyBooked,
  };
}

export function maxAllowedQuantity(studentId: number, service: ServiceKind, dateIso = todayIso()): number {
  const quota = quotaForStudent(studentId, service, dateIso);
  if (quota.serviceAlreadyBooked) return 0;
  return Math.min(config.maxQuantity, quota.dayRemaining, quota.monthRemaining);
}

export function assertCanReserve(
  studentId: number,
  service: ServiceKind,
  quantity: number,
  dateIso = todayIso(),
): void {
  if (quantity < 1) throw new Error("La quantité doit être au moins 1 plat.");
  const quota = quotaForStudent(studentId, service, dateIso);
  if (quota.serviceAlreadyBooked) {
    throw new Error(`Vous avez déjà une réservation ${service === "MIDI" ? "midi" : "soir"} aujourd'hui.`);
  }
  if (quota.dayRemaining <= 0) {
    throw new Error(`Quota du jour atteint (${quota.maxPerDay} plats : midi et soir).`);
  }
  if (quantity > quota.dayRemaining) {
    throw new Error(`Il vous reste ${quota.dayRemaining} plat${quota.dayRemaining > 1 ? "s" : ""} aujourd'hui (midi + soir, max ${quota.maxPerDay}).`);
  }
  if (quantity > quota.monthRemaining) {
    throw new Error(`Quota mensuel atteint ou insuffisant (${quota.monthUsed}/${quota.maxPerMonth} plats ce mois).`);
  }
}
