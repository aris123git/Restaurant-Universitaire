import { randomInt, randomBytes } from "node:crypto";

export function generateReservationCode(): string {
  const n = randomInt(100000, 1000000);
  return `RU-${n}`;
}

export function generateSessionId(): string {
  return randomBytes(16).toString("hex");
}

export function generateTransactionId(provider: string): string {
  return `${provider.toUpperCase()}-TEST-${randomBytes(8).toString("hex")}`;
}
