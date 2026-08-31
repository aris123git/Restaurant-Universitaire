import { getDb } from "../db/client.js";
import { normalizePhone } from "../lib/phone.js";
import { logger } from "../lib/logger.js";

export type EnrolledStudent = {
  id: number;
  phone: string;
  student_number: string | null;
  full_name: string | null;
  source: string;
  active: number;
};

export function isEnrolled(phone: string): boolean {
  const row = getDb()
    .prepare("SELECT id FROM enrolled_students WHERE phone = ? AND active = 1")
    .get(normalizePhone(phone));
  return Boolean(row);
}

export function listEnrolled(query?: string): EnrolledStudent[] {
  const db = getDb();
  if (query && query.trim()) {
    const q = `%${query.trim()}%`;
    return db
      .prepare(
        `SELECT * FROM enrolled_students
         WHERE phone LIKE ? OR IFNULL(student_number,'') LIKE ? OR IFNULL(full_name,'') LIKE ?
         ORDER BY id DESC LIMIT 200`,
      )
      .all(q, q, q) as EnrolledStudent[];
  }
  return db.prepare("SELECT * FROM enrolled_students ORDER BY id DESC LIMIT 200").all() as EnrolledStudent[];
}

export function upsertEnrolled(input: {
  phone: string;
  studentNumber?: string;
  fullName?: string;
  source?: string;
}): { inserted: boolean; id: number } {
  const db = getDb();
  const phone = normalizePhone(input.phone);
  const existing = db.prepare("SELECT id FROM enrolled_students WHERE phone = ?").get(phone) as
    | { id: number }
    | undefined;
  if (existing) {
    db.prepare(
      `UPDATE enrolled_students
       SET student_number = COALESCE(?, student_number),
           full_name = COALESCE(?, full_name),
           source = ?,
           active = 1,
           imported_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(input.studentNumber ?? null, input.fullName ?? null, input.source ?? "manual", existing.id);
    return { inserted: false, id: existing.id };
  }
  const result = db
    .prepare(
      `INSERT INTO enrolled_students (phone, student_number, full_name, source, active, imported_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'))`,
    )
    .run(phone, input.studentNumber ?? null, input.fullName ?? null, input.source ?? "manual");
  return { inserted: true, id: Number(result.lastInsertRowid) };
}

export function setEnrolledActive(id: number, active: boolean): void {
  getDb()
    .prepare("UPDATE enrolled_students SET active = ?, updated_at = datetime('now') WHERE id = ?")
    .run(active ? 1 : 0, id);
}

export function importEnrolledStudents(
  records: Array<{ phone: string; studentNumber?: string; fullName?: string }>,
  source: string,
  filename?: string,
): { received: number; inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;
  const db = getDb();
  const tx = db.transaction(() => {
    for (const record of records) {
      if (!record.phone || record.phone.replace(/\D/g, "").length < 8) continue;
      const result = upsertEnrolled({ ...record, source });
      if (result.inserted) inserted += 1;
      else updated += 1;
    }
    db.prepare(
      `INSERT INTO enrollment_imports (source, filename, received_count, inserted_count, updated_count, status, notes)
       VALUES (?, ?, ?, ?, ?, 'SUCCESS', ?)`,
    ).run(
      source,
      filename ?? null,
      records.length,
      inserted,
      updated,
      "Import manuel — l'API universitaire n'est pas encore branchée.",
    );
  });
  tx();
  logger.info("enrollment.imported", { source, received: records.length, inserted, updated });
  return { received: records.length, inserted, updated };
}

export function parseEnrollmentText(raw: string): Array<{ phone: string; studentNumber?: string; fullName?: string }> {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("phone") || header.includes("tel") || header.includes("numero");
  const rows = hasHeader ? lines.slice(1) : lines;
  return rows.map((line) => {
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    return {
      phone: parts[0] ?? "",
      studentNumber: parts[1] || undefined,
      fullName: parts[2] || undefined,
    };
  });
}
