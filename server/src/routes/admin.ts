import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { centralDashboard, restaurantHistory } from "../services/dashboardService.js";
import { getDayMenu } from "../services/menuService.js";
import { todayIso } from "../lib/dates.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("CENTRAL_ADMIN"));

adminRouter.get("/dashboard", (req, res) => {
  const date = z.string().date().optional().parse(req.query.date) ?? todayIso();
  res.json(centralDashboard(date));
});

adminRouter.get("/cities", (_req, res) => {
  res.json(getDb().prepare("SELECT * FROM cities ORDER BY name").all());
});

adminRouter.post("/cities", (req, res) => {
  const { name } = z.object({ name: z.string().min(2) }).parse(req.body);
  const result = getDb().prepare("INSERT INTO cities (name) VALUES (?)").run(name.trim());
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

adminRouter.patch("/cities/:id", (req, res) => {
  const id = Number(req.params.id);
  const body = z.object({ name: z.string().min(2).optional(), active: z.boolean().optional() }).parse(req.body);
  if (body.name) getDb().prepare("UPDATE cities SET name = ? WHERE id = ?").run(body.name.trim(), id);
  if (body.active !== undefined) {
    getDb().prepare("UPDATE cities SET active = ? WHERE id = ?").run(body.active ? 1 : 0, id);
  }
  res.json({ ok: true });
});

adminRouter.get("/restaurants", (_req, res) => {
  res.json(
    getDb()
      .prepare(
        `SELECT r.*, c.name AS city_name
         FROM restaurants r JOIN cities c ON c.id = r.city_id
         ORDER BY c.name, r.name`,
      )
      .all(),
  );
});

adminRouter.post("/restaurants", (req, res) => {
  const body = z
    .object({
      cityId: z.number().int(),
      name: z.string().min(2),
      code: z.string().min(2).max(12),
      midiStarts: z.string().optional(),
      midiEnds: z.string().optional(),
      soirStarts: z.string().optional(),
      soirEnds: z.string().optional(),
    })
    .parse(req.body);
  const result = getDb()
    .prepare(
      `INSERT INTO restaurants (city_id, name, code, midi_starts, midi_ends, soir_starts, soir_ends)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      body.cityId,
      body.name.trim(),
      body.code.trim().toUpperCase(),
      body.midiStarts ?? "11:00",
      body.midiEnds ?? "15:00",
      body.soirStarts ?? "18:00",
      body.soirEnds ?? "21:30",
    );
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

adminRouter.patch("/restaurants/:id", (req, res) => {
  const id = Number(req.params.id);
  const body = z
    .object({
      name: z.string().min(2).optional(),
      active: z.boolean().optional(),
      midiStarts: z.string().optional(),
      midiEnds: z.string().optional(),
      soirStarts: z.string().optional(),
      soirEnds: z.string().optional(),
    })
    .parse(req.body);
  const current = getDb().prepare("SELECT * FROM restaurants WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!current) {
    res.status(404).json({ error: "Restaurant introuvable" });
    return;
  }
  getDb()
    .prepare(
      `UPDATE restaurants SET name = ?, active = ?, midi_starts = ?, midi_ends = ?, soir_starts = ?, soir_ends = ?
       WHERE id = ?`,
    )
    .run(
      body.name ?? current.name,
      body.active === undefined ? current.active : body.active ? 1 : 0,
      body.midiStarts ?? current.midi_starts,
      body.midiEnds ?? current.midi_ends,
      body.soirStarts ?? current.soir_starts,
      body.soirEnds ?? current.soir_ends,
      id,
    );
  res.json({ ok: true });
});

adminRouter.get("/users", (_req, res) => {
  res.json(
    getDb()
      .prepare(
        `SELECT u.id, u.email, u.full_name, u.role, u.active, ru.restaurant_id, r.name AS restaurant_name
         FROM users u
         LEFT JOIN restaurant_users ru ON ru.user_id = u.id
         LEFT JOIN restaurants r ON r.id = ru.restaurant_id
         ORDER BY u.full_name`,
      )
      .all(),
  );
});

adminRouter.post("/users", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      fullName: z.string().min(2),
      role: z.enum(["CENTRAL_ADMIN", "RU_MANAGER", "RU_AGENT"]),
      restaurantId: z.number().int().optional(),
    })
    .parse(req.body);
  if (body.role !== "CENTRAL_ADMIN" && !body.restaurantId) {
    res.status(400).json({ error: "Un restaurant est requis pour ce rôle" });
    return;
  }
  const hash = await bcrypt.hash(body.password, 10);
  const db = getDb();
  const created = db
    .prepare("INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)")
    .run(body.email.toLowerCase(), hash, body.fullName, body.role);
  const userId = Number(created.lastInsertRowid);
  if (body.restaurantId && body.role !== "CENTRAL_ADMIN") {
    db.prepare("INSERT INTO restaurant_users (user_id, restaurant_id, role) VALUES (?, ?, ?)").run(
      userId,
      body.restaurantId,
      body.role === "RU_MANAGER" ? "MANAGER" : "AGENT",
    );
  }
  res.status(201).json({ id: userId });
});

adminRouter.patch("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const body = z.object({ active: z.boolean() }).parse(req.body);
  getDb().prepare("UPDATE users SET active = ? WHERE id = ?").run(body.active ? 1 : 0, id);
  res.json({ ok: true });
});

adminRouter.get("/dishes", (_req, res) => {
  res.json(getDb().prepare("SELECT * FROM dishes ORDER BY name").all());
});

adminRouter.post("/dishes", (req, res) => {
  const { name } = z.object({ name: z.string().min(2) }).parse(req.body);
  const result = getDb().prepare("INSERT INTO dishes (name) VALUES (?)").run(name.trim());
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

adminRouter.get("/restaurants/:id/menu", (req, res) => {
  const id = Number(req.params.id);
  const date = z.string().date().optional().parse(req.query.date) ?? todayIso();
  const weekly = getDb()
    .prepare(
      `SELECT m.*, d.name AS dish_name FROM restaurant_menus m
       JOIN dishes d ON d.id = m.dish_id WHERE m.restaurant_id = ?
       ORDER BY m.weekday, m.service, m.position`,
    )
    .all(id);
  res.json({ weekly, today: getDayMenu(id, date) });
});

adminRouter.put("/restaurants/:id/menu", (req, res) => {
  const restaurantId = Number(req.params.id);
  const body = z
    .object({
      weekday: z.number().int().min(0).max(6),
      service: z.enum(["MIDI", "SOIR"]),
      items: z.array(
        z.object({
          position: z.number().int().min(1).max(8),
          dishId: z.number().int(),
          priceFcfa: z.number().int().min(0),
        }),
      ),
    })
    .parse(req.body);
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM restaurant_menus WHERE restaurant_id = ? AND weekday = ? AND service = ?").run(
      restaurantId,
      body.weekday,
      body.service,
    );
    const insert = db.prepare(
      `INSERT INTO restaurant_menus (restaurant_id, weekday, service, position, dish_id, price_fcfa)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const item of body.items) {
      insert.run(restaurantId, body.weekday, body.service, item.position, item.dishId, item.priceFcfa);
    }
  });
  tx();
  res.json({ ok: true });
});

adminRouter.get("/sms", (_req, res) => {
  res.json(getDb().prepare("SELECT * FROM sms_logs ORDER BY id DESC LIMIT 100").all());
});

adminRouter.get("/history/:restaurantId", (req, res) => {
  res.json(restaurantHistory(Number(req.params.restaurantId), 60));
});
