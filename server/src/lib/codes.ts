import { randomInt, randomBytes } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReservationCode(): string {
  let body = "";
  for (let i = 0; i < 6; i++) body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `RU-${body}`;
}

export function normalizeReservationCode(raw: string): string {
  const compact = raw.replace(/[\s._-]/g, "").toUpperCase();
  if (compact.startsWith("RU") && compact.length > 2) return `RU-${compact.slice(2)}`;
  return compact;
}

export function generateSessionId(): string {
  return randomBytes(16).toString("hex");
}

export function generateTransactionId(provider: string): string {
  return `${provider.toUpperCase()}-TEST-${randomBytes(8).toString("hex")}`;
}
