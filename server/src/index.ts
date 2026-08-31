import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { getDb } from "./db/client.js";
import { seedIfEmpty } from "./db/seed.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { ussdRouter } from "./routes/ussd.js";
import { ruRouter } from "./routes/ru.js";
import { adminRouter } from "./routes/admin.js";
import { logger } from "./lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(
  "/api/ussd",
  rateLimit({
    windowMs: 60_000,
    limit: 40,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    operatorsIntegrated: false,
    notice: config.operatorsNotIntegratedMessage,
  });
});

app.use("/api/auth", authRouter);
app.use("/api/ussd", ussdRouter);
app.use("/api/ru", ruRouter);
app.use("/api/admin", adminRouter);

const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(errorHandler);

getDb();
seedIfEmpty();

app.listen(config.port, "0.0.0.0", () => {
  logger.info("server.started", { port: config.port, db: config.dbPath });
});
