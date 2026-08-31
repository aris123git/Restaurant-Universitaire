import { getDb } from "../db/client.js";
import { config } from "../config.js";
import { monthBounds, remainingDaysInMonth, todayIso } from "../lib/dates.js";
import type { ServiceKind } from "../types.js";

const COUNTABLE = `status <> 'CANCELLED' AND payment_status IN ('PENDING', 'PAID')`;

export type QuotaSnapshot = {
  dayUsed: number;
  dayRemaining: number;
  monthUsed: number;
  monthRemaining: number;
  maxPerDay: number;
  maxPerMonth: number;
  remainingDays: number;
};

/**
 * Plafond du jour : 3 plats, ramené à 2 en fin de mois
 * dès que 3 aujourd'hui ne laisserait plus 2 plats par jour restant.
 *
 * Exemple : 10 jours, 21 plats → 3 aujourd'hui, puis 18 / 9 jours = 2.
 */
export function dailyCeiling(remainingPlates: number, remainingDays: number): number {
  if (remainingDays <= 0 || remainingPlates <= 0) return 0;
  const maxDay = config.maxPlatesPerDay;
  const taper = config.taperedPlatesPerDay;
  const hard = Math.min(maxDay, remainingPlates);
  if (remainingDays === 1) return hard;
  const leftoverIfThree = remainingPlates - maxDay;
  const daysAfter = remainingDays - 1;
  if (leftoverIfThree >= taper * daysAfter) return hard;
  return Math.min(taper, remainingPlates);
}

export function quotaForStudent(
  studentId: number,
  _service: ServiceKind | null,
  dateIso = todayIso(),
): QuotaSnapshot {
  const db = getDb();
  const { start, end } = monthBounds(dateIso);
  const remainingDays = remainingDaysInMonth(dateIso);
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
  const monthRemaining = Math.max(0, config.maxPlatesPerMonth - monthUsed);
  const remainingAtStartOfDay = monthRemaining + dayUsed;
  const maxPerDay = dailyCeiling(remainingAtStartOfDay, remainingDays);
  return {
    dayUsed,
    dayRemaining: Math.max(0, maxPerDay - dayUsed),
    monthUsed,
    monthRemaining,
    maxPerDay,
    maxPerMonth: config.maxPlatesPerMonth,
    remainingDays,
  };
}

export function maxAllowedQuantity(studentId: number, service: ServiceKind, dateIso = todayIso()): number {
  const quota = quotaForStudent(studentId, service, dateIso);
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
  if (quota.monthRemaining <= 0) {
    throw new Error(`Quota mensuel atteint (${quota.maxPerMonth} plats ce mois).`);
  }
  if (quota.dayRemaining <= 0) {
    throw new Error(`Quota du jour atteint (${quota.maxPerDay} plat${quota.maxPerDay > 1 ? "s" : ""} aujourd'hui).`);
  }
  if (quantity > quota.dayRemaining) {
    throw new Error(
      `Il vous reste ${quota.dayRemaining} plat${quota.dayRemaining > 1 ? "s" : ""} aujourd'hui (max ${quota.maxPerDay}).`,
    );
  }
  if (quantity > quota.monthRemaining) {
    throw new Error(`Quota mensuel insuffisant (${quota.monthUsed}/${quota.maxPerMonth} plats ce mois).`);
  }
}
