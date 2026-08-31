import { getDb } from "../db/client.js";
import { todayIso } from "../lib/dates.js";
import { expireIfNeeded, type ReservationRow } from "./reservationService.js";
import { getDayMenu } from "./menuService.js";

function expireOpenForRestaurant(restaurantId: number, dateIso: string): void {
  const rows = getDb()
    .prepare(
      `SELECT * FROM reservations
       WHERE restaurant_id = ? AND date = ? AND status = 'RESERVED'`,
    )
    .all(restaurantId, dateIso) as ReservationRow[];
  for (const row of rows) expireIfNeeded(row);
}

export function restaurantDashboard(restaurantId: number, dateIso = todayIso()) {
  expireOpenForRestaurant(restaurantId, dateIso);
  const db = getDb();
  const restaurant = db
    .prepare(
      `SELECT r.id, r.name, r.code, c.name AS city_name
       FROM restaurants r JOIN cities c ON c.id = r.city_id
       WHERE r.id = ?`,
    )
    .get(restaurantId) as { id: number; name: string; code: string; city_name: string };

  const breakdown = db
    .prepare(
      `SELECT r.service, r.dish_id AS dishId, d.name AS dishName,
              COUNT(*) AS reservationCount,
              COALESCE(SUM(r.quantity), 0) AS plates,
              COALESCE(SUM(CASE WHEN r.status = 'SERVED' THEN r.quantity ELSE 0 END), 0) AS servedPlates,
              COALESCE(SUM(CASE WHEN r.status IN ('RESERVED','CODE_USED','TOKEN_ISSUED') THEN r.quantity ELSE 0 END), 0) AS pendingPlates,
              COALESCE(SUM(CASE WHEN r.status = 'EXPIRED' THEN r.quantity ELSE 0 END), 0) AS expiredPlates
       FROM reservations r
       JOIN dishes d ON d.id = r.dish_id
       WHERE r.restaurant_id = ? AND r.date = ? AND r.payment_status = 'PAID'
         AND r.status NOT IN ('CANCELLED', 'PENDING_PAYMENT')
       GROUP BY r.service, r.dish_id, d.name
       ORDER BY r.service, d.name`,
    )
    .all(restaurantId, dateIso) as Array<{
    service: "MIDI" | "SOIR";
    dishId: number;
    dishName: string;
    reservationCount: number;
    plates: number;
    servedPlates: number;
    pendingPlates: number;
    expiredPlates: number;
  }>;

  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(quantity), 0) AS totalPlates,
         COALESCE(SUM(CASE WHEN service = 'MIDI' THEN quantity ELSE 0 END), 0) AS midiPlates,
         COALESCE(SUM(CASE WHEN service = 'SOIR' THEN quantity ELSE 0 END), 0) AS soirPlates,
         COALESCE(SUM(CASE WHEN status = 'SERVED' THEN quantity ELSE 0 END), 0) AS servedPlates,
         COALESCE(SUM(CASE WHEN status IN ('RESERVED','CODE_USED','TOKEN_ISSUED') THEN quantity ELSE 0 END), 0) AS waitingPlates,
         COUNT(*) AS reservationCount,
         COALESCE(SUM(amount), 0) AS totalAmount
       FROM reservations
       WHERE restaurant_id = ? AND date = ? AND payment_status = 'PAID'
         AND status NOT IN ('CANCELLED', 'PENDING_PAYMENT')`,
    )
    .get(restaurantId, dateIso) as {
    totalPlates: number;
    midiPlates: number;
    soirPlates: number;
    servedPlates: number;
    waitingPlates: number;
    reservationCount: number;
    totalAmount: number;
  };

  const menu = getDayMenu(restaurantId, dateIso);

  const byService = (service: "MIDI" | "SOIR") => {
    const dishes = breakdown.filter((b) => b.service === service);
    const menuItems = service === "MIDI" ? menu.midi : menu.soir;
    const merged = menuItems.map((item) => {
      const found = dishes.find((d) => d.dishId === item.dishId);
      return {
        dishId: item.dishId,
        dishName: item.dishName,
        priceFcfa: item.priceFcfa,
        position: item.position,
        plates: found?.plates ?? 0,
        servedPlates: found?.servedPlates ?? 0,
        pendingPlates: found?.pendingPlates ?? 0,
      };
    });
    for (const extra of dishes) {
      if (!merged.some((m) => m.dishId === extra.dishId)) {
        merged.push({
          dishId: extra.dishId,
          dishName: extra.dishName,
          priceFcfa: 0,
          position: 99,
          plates: extra.plates,
          servedPlates: extra.servedPlates,
          pendingPlates: extra.pendingPlates,
        });
      }
    }
    return {
      service,
      plates: dishes.reduce((sum, d) => sum + d.plates, 0),
      dishes: merged,
    };
  };

  return {
    restaurant,
    date: dateIso,
    totals,
    midi: byService("MIDI"),
    soir: byService("SOIR"),
    menu,
  };
}

export function restaurantHistory(restaurantId: number, limit = 30) {
  return getDb()
    .prepare(
      `SELECT date, service,
              SUM(quantity) AS plates,
              SUM(CASE WHEN status = 'SERVED' THEN quantity ELSE 0 END) AS served,
              SUM(CASE WHEN status = 'EXPIRED' THEN quantity ELSE 0 END) AS noShow
       FROM reservations
       WHERE restaurant_id = ? AND payment_status = 'PAID' AND status NOT IN ('CANCELLED', 'PENDING_PAYMENT')
       GROUP BY date, service
       ORDER BY date DESC, service
       LIMIT ?`,
    )
    .all(restaurantId, limit);
}

export function centralDashboard(dateIso = todayIso()) {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS reservations,
         COALESCE(SUM(quantity), 0) AS plates,
         COALESCE(SUM(amount), 0) AS payments,
         COALESCE(SUM(CASE WHEN status = 'SERVED' THEN quantity ELSE 0 END), 0) AS served,
         COALESCE(SUM(CASE WHEN status IN ('RESERVED','CODE_USED','TOKEN_ISSUED') THEN quantity ELSE 0 END), 0) AS notPickedUp
       FROM reservations
       WHERE date = ? AND payment_status = 'PAID' AND status NOT IN ('CANCELLED', 'PENDING_PAYMENT')`,
    )
    .get(dateIso);

  const byCity = db
    .prepare(
      `SELECT c.id AS cityId, c.name AS cityName, r.id AS restaurantId, r.name AS restaurantName,
              COALESCE(SUM(res.quantity), 0) AS plates
       FROM restaurants r
       JOIN cities c ON c.id = r.city_id
       LEFT JOIN reservations res
         ON res.restaurant_id = r.id AND res.date = ? AND res.payment_status = 'PAID'
        AND res.status NOT IN ('CANCELLED', 'PENDING_PAYMENT')
       WHERE r.active = 1
       GROUP BY c.id, c.name, r.id, r.name
       ORDER BY c.name, r.name`,
    )
    .all(dateIso);

  const byService = db
    .prepare(
      `SELECT service, COALESCE(SUM(quantity), 0) AS plates
       FROM reservations
       WHERE date = ? AND payment_status = 'PAID' AND status NOT IN ('CANCELLED', 'PENDING_PAYMENT')
       GROUP BY service`,
    )
    .all(dateIso);

  return { date: dateIso, totals, byCity, byService };
}
