import { getDb } from "../db/client.js";
import { generateSessionId } from "../lib/codes.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import type { ServiceKind, UssdResponse } from "../types.js";
import { getMenuForRestaurant } from "./menuService.js";
import {
  assignRestaurant,
  getOrCreateStudent,
  getRestaurant,
  listActiveCities,
  listActiveRestaurants,
} from "./studentService.js";
import {
  confirmPayment,
  createPendingReservation,
  initiateSimulatedPayment,
} from "./reservationService.js";
import { isEnrolled } from "./enrollmentService.js";
import { maxAllowedQuantity, quotaForStudent } from "./quotaService.js";
import { presentationToken } from "../lib/codes.js";

type Step =
  | "START"
  | "SELECT_CITY"
  | "SELECT_RESTAURANT"
  | "SELECT_SERVICE"
  | "SELECT_DISH"
  | "SELECT_QUANTITY"
  | "CUSTOM_QUANTITY"
  | "CONFIRM"
  | "PAYMENT"
  | "DONE";

type SessionRow = {
  id: number;
  phone: string;
  session_id: string;
  current_step: Step;
  city_id: number | null;
  restaurant_id: number | null;
  service: ServiceKind | null;
  dish_id: number | null;
  quantity: number | null;
  reservation_id: number | null;
  status: string;
  last_message: string | null;
  created_at: string;
  updated_at: string;
};

function save(session: SessionRow, step: Step, extra: Partial<SessionRow> = {}, message = ""): SessionRow {
  const db = getDb();
  db.prepare(
    `UPDATE ussd_sessions
     SET current_step = ?, city_id = ?, restaurant_id = ?, service = ?, dish_id = ?,
         quantity = ?, reservation_id = ?, status = ?, last_message = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    step,
    extra.city_id !== undefined ? extra.city_id : session.city_id,
    extra.restaurant_id !== undefined ? extra.restaurant_id : session.restaurant_id,
    extra.service !== undefined ? extra.service : session.service,
    extra.dish_id !== undefined ? extra.dish_id : session.dish_id,
    extra.quantity !== undefined ? extra.quantity : session.quantity,
    extra.reservation_id !== undefined ? extra.reservation_id : session.reservation_id,
    extra.status ?? session.status,
    message,
    session.id,
  );
  return db.prepare("SELECT * FROM ussd_sessions WHERE id = ?").get(session.id) as SessionRow;
}

function numbered(lines: string[]): string {
  return lines.join("\n");
}

function isTimedOut(session: SessionRow): boolean {
  const raw = session.updated_at.includes("T") ? session.updated_at : `${session.updated_at.replace(" ", "T")}Z`;
  const updated = Date.parse(raw);
  if (Number.isNaN(updated)) return false;
  return Date.now() - updated > config.sessionTimeoutMs;
}

function serviceMenu(): string {
  return numbered(["Bienvenue.", "1. Midi", "2. Soir", "3. Modifier mon RU"]);
}

function quantityMenu(maxAllowed: number): string {
  if (maxAllowed <= 0) {
    return "Quota atteint. Vous ne pouvez plus réserver aujourd'hui.";
  }
  const lines = ["Nombre de plats :"];
  for (let n = 1; n <= maxAllowed; n++) {
    lines.push(`${n}. ${n} plat${n > 1 ? "s" : ""}`);
  }
  lines.push(`Reste aujourd'hui : ${maxAllowed} (max 2 / jour, midi + soir)`);
  return numbered(lines);
}

function dishMenu(restaurantId: number, service: ServiceKind) {
  const items = getMenuForRestaurant(restaurantId, service);
  if (items.length === 0) {
    return { text: "Aucun plat n'est prévu pour ce service aujourd'hui.\n0. Retour", items };
  }
  const lines = [`Menu ${service} :`, ...items.map((item) => `${item.position}. ${item.dishName} — ${item.priceFcfa} F`)];
  return { text: numbered(lines), items };
}

export class UssdSessionService {
  async startOrResume(phone: string, sessionId: string | undefined, text: string): Promise<UssdResponse> {
    if (!isEnrolled(phone)) {
      return {
        sessionId: sessionId || "",
        message: numbered([
          "Ce numéro n'est pas inscrit au service de restauration universitaire.",
          "Seuls les étudiants enregistrés dans la base de l'université peuvent réserver.",
        ]),
        continueSession: false,
        step: "DONE",
      };
    }

    const db = getDb();
    const student = getOrCreateStudent(phone);
    let session: SessionRow | undefined;

    if (sessionId) {
      session = db.prepare("SELECT * FROM ussd_sessions WHERE session_id = ?").get(sessionId) as SessionRow | undefined;
    }

    if (!session || session.status !== "ACTIVE" || isTimedOut(session)) {
      if (session && isTimedOut(session) && session.status === "ACTIVE") {
        db.prepare("UPDATE ussd_sessions SET status = 'EXPIRED', updated_at = datetime('now') WHERE id = ?").run(
          session.id,
        );
      }
      const sid = generateSessionId();
      const inserted = db
        .prepare(
          `INSERT INTO ussd_sessions (phone, session_id, current_step, city_id, restaurant_id, status)
           VALUES (?, ?, 'START', ?, ?, 'ACTIVE')`,
        )
        .run(phone, sid, student.city_id, student.restaurant_id);
      session = db.prepare("SELECT * FROM ussd_sessions WHERE id = ?").get(Number(inserted.lastInsertRowid)) as SessionRow;
      return this.fromStart(session, student.restaurant_id);
    }

    try {
      return await this.handleInput(session, text.trim());
    } catch (err) {
      logger.error("ussd.error", { error: err instanceof Error ? err.message : String(err) });
      return {
        sessionId: session.session_id,
        message: "Une erreur est survenue. Réessayez.",
        continueSession: false,
        step: session.current_step,
      };
    }
  }

  private fromStart(session: SessionRow, restaurantId: number | null): UssdResponse {
    if (!restaurantId) {
      const cities = listActiveCities();
      const msg = numbered([
        "Bienvenue au service de réservation RU.",
        "Choisissez votre ville :",
        ...cities.map((c, i) => `${i + 1}. ${c.name}`),
      ]);
      save(session, "SELECT_CITY", {}, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_CITY" };
    }
    const msg = serviceMenu();
    save(session, "SELECT_SERVICE", { restaurant_id: restaurantId }, msg);
    return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_SERVICE" };
  }

  private async handleInput(session: SessionRow, text: string): Promise<UssdResponse> {
    if (text === "0" && session.current_step !== "PAYMENT" && session.current_step !== "DONE") {
      return this.fromStart(session, session.restaurant_id);
    }

    switch (session.current_step) {
      case "START":
        return this.fromStart(session, session.restaurant_id);
      case "SELECT_CITY":
        return this.selectCity(session, text);
      case "SELECT_RESTAURANT":
        return this.selectRestaurant(session, text);
      case "SELECT_SERVICE":
        return this.selectService(session, text);
      case "SELECT_DISH":
        return this.selectDish(session, text);
      case "SELECT_QUANTITY":
        return this.selectQuantity(session, text);
      case "CUSTOM_QUANTITY":
        return this.customQuantity(session, text);
      case "CONFIRM":
        return this.confirm(session, text);
      case "PAYMENT":
        return this.payment(session, text);
      default:
        return this.end(session, "Session terminée.");
    }
  }

  private selectCity(session: SessionRow, text: string): UssdResponse {
    const cities = listActiveCities();
    const city = cities[Number(text) - 1];
    if (!city) {
      const msg = numbered([
        "Choix invalide.",
        "Choisissez votre ville :",
        ...cities.map((c, i) => `${i + 1}. ${c.name}`),
      ]);
      save(session, "SELECT_CITY", {}, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_CITY" };
    }
    const restaurants = listActiveRestaurants(city.id);
    if (restaurants.length === 0) {
      return this.end(session, "Aucun restaurant actif dans cette ville.");
    }
    const msg = numbered(["Choisissez votre RU :", ...restaurants.map((r, i) => `${i + 1}. ${r.name}`)]);
    save(session, "SELECT_RESTAURANT", { city_id: city.id }, msg);
    return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_RESTAURANT" };
  }

  private selectRestaurant(session: SessionRow, text: string): UssdResponse {
    if (!session.city_id) return this.fromStart(session, null);
    const restaurants = listActiveRestaurants(session.city_id);
    const restaurant = restaurants[Number(text) - 1];
    if (!restaurant) {
      const msg = numbered([
        "Choix invalide.",
        "Choisissez votre RU :",
        ...restaurants.map((r, i) => `${i + 1}. ${r.name}`),
      ]);
      save(session, "SELECT_RESTAURANT", {}, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_RESTAURANT" };
    }
    const student = getOrCreateStudent(session.phone);
    assignRestaurant(student.id, session.city_id, restaurant.id);
    const msg = serviceMenu();
    save(session, "SELECT_SERVICE", { restaurant_id: restaurant.id, city_id: session.city_id }, msg);
    return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_SERVICE" };
  }

  private selectService(session: SessionRow, text: string): UssdResponse {
    if (text === "3") {
      const cities = listActiveCities();
      const msg = numbered([
        "Modifier votre RU.",
        "Choisissez votre ville :",
        ...cities.map((c, i) => `${i + 1}. ${c.name}`),
      ]);
      save(session, "SELECT_CITY", { restaurant_id: null, city_id: null }, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_CITY" };
    }
    const service: ServiceKind | undefined = text === "1" ? "MIDI" : text === "2" ? "SOIR" : undefined;
    if (!service || !session.restaurant_id) {
      const msg = numbered(["Choix invalide.", serviceMenu()]);
      save(session, "SELECT_SERVICE", {}, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_SERVICE" };
    }
    const quota = quotaForStudent(getOrCreateStudent(session.phone).id, service);
    if (quota.serviceAlreadyBooked) {
      const msg = numbered([
        `Vous avez déjà réservé le ${service === "MIDI" ? "midi" : "soir"} aujourd'hui.`,
        "1. Midi",
        "2. Soir",
        "3. Modifier mon RU",
      ]);
      save(session, "SELECT_SERVICE", { service: null }, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_SERVICE" };
    }
    if (quota.dayRemaining <= 0) {
      return this.end(
        session,
        `Quota du jour atteint (${quota.maxPerDay} plats : midi et soir). Revenez demain.`,
      );
    }
    if (quota.monthRemaining <= 0) {
      return this.end(session, `Quota mensuel atteint (${quota.maxPerMonth} plats).`);
    }
    const { text: menuText, items } = dishMenu(session.restaurant_id, service);
    if (items.length === 0) {
      save(session, "SELECT_SERVICE", { service: null }, menuText);
      return { sessionId: session.session_id, message: menuText, continueSession: true, step: "SELECT_SERVICE" };
    }
    save(session, "SELECT_DISH", { service }, menuText);
    return { sessionId: session.session_id, message: menuText, continueSession: true, step: "SELECT_DISH" };
  }

  private selectDish(session: SessionRow, text: string): UssdResponse {
    if (!session.restaurant_id || !session.service) return this.fromStart(session, session.restaurant_id);
    const items = getMenuForRestaurant(session.restaurant_id, session.service);
    const item = items.find((d) => String(d.position) === text) ?? items[Number(text) - 1];
    if (!item) {
      const { text: menuText } = dishMenu(session.restaurant_id, session.service);
      const msg = numbered(["Choix invalide.", menuText]);
      save(session, "SELECT_DISH", {}, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_DISH" };
    }
    const allowed = maxAllowedQuantity(getOrCreateStudent(session.phone).id, session.service);
    if (allowed <= 0) {
      return this.end(session, "Quota atteint pour aujourd'hui.");
    }
    const msg = quantityMenu(allowed);
    save(session, "SELECT_QUANTITY", { dish_id: item.dishId }, msg);
    return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_QUANTITY" };
  }

  private selectQuantity(session: SessionRow, text: string): UssdResponse {
    if (!session.service) return this.fromStart(session, session.restaurant_id);
    const allowed = maxAllowedQuantity(getOrCreateStudent(session.phone).id, session.service);
    const qty = Number(text);
    if (!Number.isInteger(qty) || qty < 1 || qty > allowed) {
      const msg = numbered(["Choix invalide.", quantityMenu(allowed)]);
      save(session, "SELECT_QUANTITY", {}, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "SELECT_QUANTITY" };
    }
    return this.showConfirm(session, qty);
  }

  private customQuantity(session: SessionRow, text: string): UssdResponse {
    return this.selectQuantity(session, text);
  }

  private showConfirm(session: SessionRow, quantity: number): UssdResponse {
    const restaurant = session.restaurant_id ? getRestaurant(session.restaurant_id) : undefined;
    const items =
      session.restaurant_id && session.service
        ? getMenuForRestaurant(session.restaurant_id, session.service)
        : [];
    const dish = items.find((d) => d.dishId === session.dish_id);
    const amount = (dish?.priceFcfa ?? 0) * quantity;
    const msg = numbered([
      "Confirmation :",
      `RU : ${restaurant?.name ?? ""}`,
      `Service : ${session.service}`,
      `Plat : ${dish?.dishName ?? ""}`,
      `Nombre : ${quantity} plat${quantity > 1 ? "s" : ""}`,
      `Montant : ${amount} FCFA`,
      "",
      "1. Confirmer",
      "2. Annuler",
    ]);
    save(session, "CONFIRM", { quantity }, msg);
    return { sessionId: session.session_id, message: msg, continueSession: true, step: "CONFIRM" };
  }

  private async confirm(session: SessionRow, text: string): Promise<UssdResponse> {
    if (text === "2") {
      save(session, "DONE", { status: "CANCELLED" }, "Réservation annulée.");
      return this.end(session, "Réservation annulée.");
    }
    if (text !== "1") {
      const msg = numbered(["Choix invalide.", "1. Confirmer", "2. Annuler"]);
      save(session, "CONFIRM", {}, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "CONFIRM" };
    }
    if (!session.restaurant_id || !session.city_id || !session.service || !session.dish_id || !session.quantity) {
      return this.end(session, "Session incomplète. Recommencez.");
    }
    const student = getOrCreateStudent(session.phone);
    if (!student.city_id) assignRestaurant(student.id, session.city_id, session.restaurant_id);
    let created;
    try {
      created = createPendingReservation({
        studentId: student.id,
        restaurantId: session.restaurant_id,
        cityId: session.city_id,
        service: session.service,
        dishId: session.dish_id,
        quantity: session.quantity,
        phone: session.phone,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Réservation impossible.";
      return this.end(session, message);
    }
    await initiateSimulatedPayment(created.reservation.id, session.phone);
    const msg = numbered([
      "PAIEMENT (MODE TEST)",
      `Montant : ${created.reservation.amount} FCFA`,
      "",
      "Aucune API opérateur n'est active.",
      "1. Simuler un paiement réussi",
      "2. Simuler un paiement refusé",
    ]);
    save(session, "PAYMENT", { reservation_id: created.reservation.id }, msg);
    return { sessionId: session.session_id, message: msg, continueSession: true, step: "PAYMENT" };
  }

  private async payment(session: SessionRow, text: string): Promise<UssdResponse> {
    if (!session.reservation_id) return this.end(session, "Paiement introuvable.");
    if (text === "2") {
      await confirmPayment(session.reservation_id, "FAILED");
      save(session, "DONE", { status: "CANCELLED" }, "Paiement refusé.");
      return this.end(session, "Paiement refusé. Réservation non créée.");
    }
    if (text !== "1") {
      const msg = numbered([
        "Choix invalide.",
        "1. Simuler un paiement réussi",
        "2. Simuler un paiement refusé",
      ]);
      save(session, "PAYMENT", {}, msg);
      return { sessionId: session.session_id, message: msg, continueSession: true, step: "PAYMENT" };
    }
    const paid = await confirmPayment(session.reservation_id, "SUCCESS");
    if (!paid.ok) {
      save(session, "DONE", { status: "CANCELLED" }, "Paiement refusé.");
      return this.end(session, "Paiement refusé.");
    }
    const code = paid.reservation.reservation_code;
    const token = presentationToken(code, session.phone);
    const msg = numbered([
      "Réservation confirmée.",
      `Code + numéro :`,
      token,
      "Un SMS simulé a été envoyé.",
      "Présentez le code suivi de votre numéro au RU.",
    ]);
    save(session, "DONE", { status: "COMPLETED" }, msg);
    return { sessionId: session.session_id, message: msg, continueSession: false, step: "DONE" };
  }

  private end(session: SessionRow, message: string): UssdResponse {
    getDb()
      .prepare("UPDATE ussd_sessions SET status = 'CLOSED', last_message = ?, updated_at = datetime('now') WHERE id = ?")
      .run(message, session.id);
    return { sessionId: session.session_id, message, continueSession: false, step: "DONE" };
  }
}

export const ussdSessionService = new UssdSessionService();
