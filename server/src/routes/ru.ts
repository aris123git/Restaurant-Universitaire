import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRestaurantScope, scopedRestaurantId, type AuthedRequest } from "../middleware/auth.js";
import { restaurantDashboard, restaurantHistory } from "../services/dashboardService.js";
import { getDayMenu } from "../services/menuService.js";
import { issueTokens, lookupCode } from "../services/verifyService.js";
import { todayIso } from "../lib/dates.js";

export const ruRouter = Router();
ruRouter.use(requireAuth, requireRestaurantScope);

ruRouter.get("/dashboard", (req, res) => {
  const date = z.string().date().optional().parse(req.query.date) ?? todayIso();
  res.json(restaurantDashboard(scopedRestaurantId(req), date));
});

ruRouter.get("/menu", (req, res) => {
  const date = z.string().date().optional().parse(req.query.date) ?? todayIso();
  res.json(getDayMenu(scopedRestaurantId(req), date));
});

ruRouter.get("/history", (req, res) => {
  res.json(restaurantHistory(scopedRestaurantId(req)));
});

ruRouter.post("/verify", (req, res) => {
  const { code } = z.object({ code: z.string().min(4) }).parse(req.body);
  const result = lookupCode(code, scopedRestaurantId(req));
  res.json(result);
});

ruRouter.post("/tokens", (req, res) => {
  const { code } = z.object({ code: z.string().min(4) }).parse(req.body);
  const user = (req as AuthedRequest).user;
  const result = issueTokens(code, scopedRestaurantId(req), user.id);
  res.json(result);
});
