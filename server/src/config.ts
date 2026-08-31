import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-in-production-ru-platform",
  jwtExpiresIn: "12h",
  dbPath: process.env.DATABASE_PATH ?? path.join(__dirname, "../data/ru.db"),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  sessionTimeoutMs: 3 * 60 * 1000,
  timezone: "Africa/Ouagadougou",
  maxQuantity: 2,
  maxPlatesPerDay: 2,
  maxPlatesPerMonth: 70,
  operatorsNotIntegratedMessage:
    "Aucune intégration opérateur n'est active. USSD, paiement et SMS sont en mode simulation (TEST).",
} as const;
