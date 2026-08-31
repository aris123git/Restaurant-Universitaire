export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("226") && digits.length >= 11) return `+${digits}`;
  if (digits.length === 8) return `+226${digits}`;
  return digits.startsWith("0") ? `+226${digits.slice(1)}` : `+${digits}`;
}

export function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}
