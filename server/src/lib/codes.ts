import { randomInt, randomBytes } from "node:crypto";
import { normalizePhone } from "./phone.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReservationCode(): string {
  let body = "";
  for (let i = 0; i < 6; i++) body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `RU-${body}`;
}

export function normalizeReservationCode(raw: string): string {
  const compact = raw.replace(/[\s._-]/g, "").toUpperCase();
  if (compact.startsWith("RU") && compact.length > 2) {
    return `RU-${compact.slice(2, 8)}`;
  }
  return compact.slice(0, 9);
}

/** Code SMS : RU-XXXXXX suivi du numéro national (8 chiffres). */
export function presentationToken(code: string, phone: string): string {
  return `${normalizeReservationCode(code)} ${nationalNumber(phone)}`;
}

export function nationalNumber(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return digits.slice(-8);
}

export function parseCodeAndPhone(codeRaw: string, phoneRaw?: string): { code: string; phone: string } {
  const compact = codeRaw.replace(/[\s._-]/g, "").toUpperCase();
  const code = normalizeReservationCode(codeRaw);
  let phone = (phoneRaw ?? "").trim();
  if (!phone && compact.startsWith("RU") && compact.length > 8) {
    phone = compact.slice(8);
  }
  return { code, phone: phone ? normalizePhone(phone) : "" };
}

export function generateSessionId(): string {
  return randomBytes(16).toString("hex");
}

export function generateTransactionId(provider: string): string {
  return `${provider.toUpperCase()}-TEST-${randomBytes(8).toString("hex")}`;
}
