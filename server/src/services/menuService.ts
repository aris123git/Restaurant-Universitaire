import { getDb } from "../db/client.js";
import { todayIso, weekdayFromIso } from "../lib/dates.js";
import type { MenuItem, ServiceKind } from "../types.js";

export function getMenuForRestaurant(
  restaurantId: number,
  service: ServiceKind,
  dateIso = todayIso(),
): MenuItem[] {
  const db = getDb();
  const weekday = weekdayFromIso(dateIso);
  const overrides = db
    .prepare(
      `SELECT o.position, o.dish_id AS dishId, d.name AS dishName, o.price_fcfa AS priceFcfa
       FROM restaurant_menu_overrides o
       JOIN dishes d ON d.id = o.dish_id
       WHERE o.restaurant_id = ? AND o.date = ? AND o.service = ?
       ORDER BY o.position`,
    )
    .all(restaurantId, dateIso, service) as MenuItem[];
  if (overrides.length > 0) return overrides;

  return db
    .prepare(
      `SELECT m.position, m.dish_id AS dishId, d.name AS dishName, m.price_fcfa AS priceFcfa
       FROM restaurant_menus m
       JOIN dishes d ON d.id = m.dish_id
       WHERE m.restaurant_id = ? AND m.weekday = ? AND m.service = ? AND m.active = 1 AND d.active = 1
       ORDER BY m.position`,
    )
    .all(restaurantId, weekday, service) as MenuItem[];
}

export function getDayMenu(restaurantId: number, dateIso = todayIso()) {
  return {
    date: dateIso,
    midi: getMenuForRestaurant(restaurantId, "MIDI", dateIso),
    soir: getMenuForRestaurant(restaurantId, "SOIR", dateIso),
  };
}

export function findMenuItem(
  restaurantId: number,
  service: ServiceKind,
  dishId: number,
  dateIso = todayIso(),
): MenuItem | undefined {
  return getMenuForRestaurant(restaurantId, service, dateIso).find((item) => item.dishId === dishId);
}
