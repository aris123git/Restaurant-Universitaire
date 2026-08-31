import type { UssdInbound, UssdOutbound, UssdProvider } from "./UssdProvider.js";
import { normalizePhone } from "../../lib/phone.js";

export { normalizePhone };

/** Adaptateur interne pour le simulateur de démonstration. */
export class SimulatedUssdProvider implements UssdProvider {
  readonly name = "simulated";
  readonly implemented = true;

  parseInbound(payload: unknown): UssdInbound {
    const body = payload as { sessionId?: string; phone?: string; text?: string };
    if (!body.phone) throw new Error("Numéro de téléphone requis");
    return {
      sessionId: body.sessionId ?? "",
      phone: normalizePhone(body.phone),
      text: (body.text ?? "").trim(),
    };
  }

  formatOutbound(response: UssdOutbound): UssdOutbound {
    return response;
  }
}

