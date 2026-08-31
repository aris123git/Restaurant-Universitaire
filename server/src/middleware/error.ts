import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { getDb } from "../db/client.js";
import { logger } from "../lib/logger.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Données invalides", details: err.flatten() });
    return;
  }
  const message = err instanceof Error ? err.message : "Erreur serveur";
  logger.error("http.error", { message });
  res.status(400).json({ error: message });
}

export function writeAudit(
  actorUserId: number | null,
  restaurantId: number | null,
  action: string,
  details?: Record<string, unknown>,
): void {
  getDb()
    .prepare("INSERT INTO audit_logs (actor_user_id, restaurant_id, action, details) VALUES (?, ?, ?, ?)")
    .run(actorUserId, restaurantId, action, details ? JSON.stringify(details) : null);
}
