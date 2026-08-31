import { getDb } from "../db/client.js";

export type StudentRow = {
  id: number;
  phone: string;
  city_id: number | null;
  restaurant_id: number | null;
};

export function getOrCreateStudent(phone: string): StudentRow {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM students WHERE phone = ?").get(phone) as StudentRow | undefined;
  if (existing) return existing;
  const result = db.prepare("INSERT INTO students (phone) VALUES (?)").run(phone);
  return db.prepare("SELECT * FROM students WHERE id = ?").get(Number(result.lastInsertRowid)) as StudentRow;
}

export function findStudentByPhone(phone: string): StudentRow | undefined {
  return getDb().prepare("SELECT * FROM students WHERE phone = ?").get(phone) as StudentRow | undefined;
}

export function assignRestaurant(studentId: number, cityId: number, restaurantId: number): void {
  getDb()
    .prepare(
      `UPDATE students
       SET city_id = ?, restaurant_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(cityId, restaurantId, studentId);
}

export function listActiveCities() {
  return getDb()
    .prepare("SELECT id, name FROM cities WHERE active = 1 ORDER BY id")
    .all() as { id: number; name: string }[];
}

export function listActiveRestaurants(cityId: number) {
  return getDb()
    .prepare("SELECT id, name, code FROM restaurants WHERE city_id = ? AND active = 1 ORDER BY id")
    .all(cityId) as { id: number; name: string; code: string }[];
}

export function getRestaurant(id: number) {
  return getDb()
    .prepare(
      `SELECT r.*, c.name AS city_name
       FROM restaurants r
       JOIN cities c ON c.id = r.city_id
       WHERE r.id = ?`,
    )
    .get(id) as
    | {
        id: number;
        city_id: number;
        name: string;
        code: string;
        active: number;
        midi_starts: string;
        midi_ends: string;
        soir_starts: string;
        soir_ends: string;
        city_name: string;
      }
    | undefined;
}
