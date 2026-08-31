import bcrypt from "bcryptjs";
import { getDb } from "./client.js";
import { logger } from "../lib/logger.js";

const DISHES = [
  "Riz sauce",
  "Riz gras",
  "Tô",
  "Spaghetti",
  "Haricots",
  "Riz sauce arachide",
  "Riz sauce tomate",
  "Alloco riz",
];

const CITIES = ["Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Kaya"];

const RESTAURANTS: Array<{ city: string; name: string; code: string }> = [
  { city: "Ouagadougou", name: "RU Université Joseph Ki-Zerbo", code: "UJKZ" },
  { city: "Ouagadougou", name: "RU Ouaga 2", code: "OUA2" },
  { city: "Ouagadougou", name: "RU ISGE", code: "ISGE" },
  { city: "Bobo-Dioulasso", name: "RU Université Nazi Boni", code: "UNB" },
  { city: "Bobo-Dioulasso", name: "RU Bobo 2", code: "BOB2" },
  { city: "Koudougou", name: "RU Université Norbert Zongo", code: "UNZ" },
  { city: "Kaya", name: "RU Kaya", code: "KAYA" },
];

/** 4 plats par service — emploi du temps hebdomadaire, légèrement rotatif. */
function weekMenu(seed: number): Array<{ weekday: number; service: "MIDI" | "SOIR"; dishes: number[] }> {
  const slots: Array<{ weekday: number; service: "MIDI" | "SOIR"; dishes: number[] }> = [];
  for (let day = 0; day <= 6; day++) {
    for (const service of ["MIDI", "SOIR"] as const) {
      const offset = (seed + day + (service === "SOIR" ? 2 : 0)) % DISHES.length;
      const dishes = [0, 1, 2, 3].map((i) => ((offset + i) % DISHES.length) + 1);
      slots.push({ weekday: day, service, dishes });
    }
  }
  return slots;
}

export function seedIfEmpty(): void {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS n FROM cities").get() as { n: number };
  if (count.n === 0) seedAll();
  seedEnrollmentsIfMissing();
}

const DEMO_ENROLLED = [
  { phone: "+22670111111", studentNumber: "UJKZ-1001", fullName: "Étudiant Demo 1" },
  { phone: "+22670222222", studentNumber: "UJKZ-1002", fullName: "Étudiant Demo 2" },
  { phone: "+22670000001", studentNumber: "UJKZ-1003", fullName: "Étudiant Simulateur" },
  { phone: "+22670000999", studentNumber: "UJKZ-1004", fullName: "Étudiant Test" },
  { phone: "+22670333333", studentNumber: "UJKZ-1005", fullName: "Étudiant Quota" },
];

export function seedEnrollmentsIfMissing(): void {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS n FROM enrolled_students").get() as { n: number };
  if (count.n > 0) return;
  const insert = db.prepare(
    `INSERT INTO enrolled_students (phone, student_number, full_name, source, active, imported_at)
     VALUES (?, ?, ?, 'demo_seed', 1, datetime('now'))`,
  );
  const tx = db.transaction(() => {
    for (const row of DEMO_ENROLLED) {
      insert.run(row.phone, row.studentNumber, row.fullName);
    }
  });
  tx();
  logger.info("db.enrolled_seeded", { count: DEMO_ENROLLED.length });
}

export function seedAll(): void {
  const db = getDb();
  const hash = bcrypt.hashSync("Admin1234!", 10);
  const agentHash = bcrypt.hashSync("Agent1234!", 10);

  const insertCity = db.prepare("INSERT INTO cities (name) VALUES (?)");
  const insertRu = db.prepare("INSERT INTO restaurants (city_id, name, code) VALUES (?, ?, ?)");
  const insertDish = db.prepare("INSERT INTO dishes (name) VALUES (?)");
  const insertUser = db.prepare("INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)");
  const insertRuUser = db.prepare(
    "INSERT INTO restaurant_users (user_id, restaurant_id, role) VALUES (?, ?, ?)",
  );
  const insertMenu = db.prepare(
    `INSERT INTO restaurant_menus (restaurant_id, weekday, service, position, dish_id, price_fcfa)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    const cityIds = new Map<string, number>();
    for (const name of CITIES) {
      cityIds.set(name, Number(insertCity.run(name).lastInsertRowid));
    }
    for (const name of DISHES) insertDish.run(name);

    insertUser.run("admin@ru.bf", hash, "Administration centrale", "CENTRAL_ADMIN");

    RESTAURANTS.forEach((ru, index) => {
      const cityId = cityIds.get(ru.city);
      if (!cityId) return;
      const ruId = Number(insertRu.run(cityId, ru.name, ru.code).lastInsertRowid);
      const email = `${ru.code.toLowerCase()}@ru.bf`;
      const userId = Number(
        insertUser.run(email, agentHash, `Agent ${ru.name}`, "RU_AGENT").lastInsertRowid,
      );
      insertRuUser.run(userId, ruId, "AGENT");
      if (index === 0) {
        const managerId = Number(
          insertUser.run("responsable.ujkz@ru.bf", agentHash, "Responsable UJKZ", "RU_MANAGER").lastInsertRowid,
        );
        insertRuUser.run(managerId, ruId, "MANAGER");
      }
      for (const slot of weekMenu(index)) {
        slot.dishes.forEach((dishId, pos) => {
          insertMenu.run(ruId, slot.weekday, slot.service, pos + 1, dishId, 200);
        });
      }
    });
  });

  tx();
  seedEnrollmentsIfMissing();
  logger.info("db.seeded", {
    admin: "admin@ru.bf",
    agentExample: "ujkz@ru.bf",
    passwordAdmin: "Admin1234!",
    passwordAgent: "Agent1234!",
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty();
  console.log("Base initialisée.");
}
