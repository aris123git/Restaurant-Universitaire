import { Router } from "express";
import { z } from "zod";
import { login, requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { config } from "../config.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const result = await login(body.email, body.password);
    if (!result) {
      res.status(401).json({ error: "Identifiants incorrects" });
      return;
    }
    res.json({ token: result.token, user: result.user, notice: config.operatorsNotIntegratedMessage });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: (req as AuthedRequest).user, notice: config.operatorsNotIntegratedMessage });
});
