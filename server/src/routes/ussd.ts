import { Router } from "express";
import { z } from "zod";
import { SimulatedUssdProvider } from "../integrations/ussd/SimulatedUssdAdapter.js";
import { ussdSessionService } from "../services/ussdSessionService.js";
import { config } from "../config.js";

export const ussdRouter = Router();
const provider = new SimulatedUssdProvider();

ussdRouter.post("/simulate", async (req, res, next) => {
  try {
    const body = z
      .object({
        phone: z.string().min(8),
        text: z.string().optional().default(""),
        sessionId: z.string().optional(),
      })
      .parse(req.body);
    const inbound = provider.parseInbound(body);
    const response = await ussdSessionService.startOrResume(inbound.phone, inbound.sessionId || undefined, inbound.text);
    res.json({
      ...provider.formatOutbound({ message: response.message, continueSession: response.continueSession }),
      sessionId: response.sessionId,
      step: response.step,
      notice: config.operatorsNotIntegratedMessage,
      provider: provider.name,
    });
  } catch (err) {
    next(err);
  }
});
