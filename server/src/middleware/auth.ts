import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { getDb } from "../db/client.js";
import type { AuthUser, Role } from "../types.js";

export type AuthedRequest = Request & { user: AuthUser };

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function loadAuthUser(userId: number): AuthUser | null {
  const row = getDb()
    .prepare(
      `SELECT u.id, u.email, u.full_name, u.role, u.active,
              ru.restaurant_id, r.name AS restaurant_name, r.code AS restaurant_code, c.name AS city_name
       FROM users u
       LEFT JOIN restaurant_users ru ON ru.user_id = u.id
       LEFT JOIN restaurants r ON r.id = ru.restaurant_id
       LEFT JOIN cities c ON c.id = r.city_id
       WHERE u.id = ?`,
    )
    .get(userId) as
    | {
        id: number;
        email: string;
        full_name: string;
        role: Role;
        active: number;
        restaurant_id: number | null;
        restaurant_name: string | null;
        restaurant_code: string | null;
        city_name: string | null;
      }
    | undefined;
  if (!row || !row.active) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    restaurantId: row.role === "CENTRAL_ADMIN" ? null : row.restaurant_id,
    restaurantName: row.restaurant_name,
    restaurantCode: row.restaurant_code,
    cityName: row.city_name,
  };
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser } | null> {
  const row = getDb()
    .prepare("SELECT id, password_hash, active FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as { id: number; password_hash: string; active: number } | undefined;
  if (!row || !row.active) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  const user = loadAuthUser(row.id);
  if (!user) return null;
  return { token: signToken(user), user };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    const user = loadAuthUser(payload.id);
    if (!user) {
      res.status(401).json({ error: "Compte inactif" });
      return;
    }
    (req as AuthedRequest).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Session invalide" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthedRequest).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    next();
  };
}

/** restaurant_id comes from the session, never from the client. */
export function requireRestaurantScope(req: Request, res: Response, next: NextFunction): void {
  const user = (req as AuthedRequest).user;
  if (user.role === "CENTRAL_ADMIN") {
    res.status(403).json({ error: "Utilisez l'interface d'administration centrale" });
    return;
  }
  if (!user.restaurantId) {
    res.status(403).json({ error: "Aucun restaurant associé à ce compte" });
    return;
  }
  next();
}

export function scopedRestaurantId(req: Request): number {
  const user = (req as AuthedRequest).user;
  if (!user.restaurantId) throw new Error("Restaurant non associé");
  return user.restaurantId;
}
