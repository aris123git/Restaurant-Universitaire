import type { UssdInbound, UssdOutbound, UssdProvider } from "./UssdProvider.js";

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

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("226") && digits.length >= 11) return `+${digits}`;
  if (digits.length === 8) return `+226${digits}`;
  return digits.startsWith("0") ? `+226${digits.slice(1)}` : `+${digits}`;
}
