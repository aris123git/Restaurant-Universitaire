/** Burkina Faso is UTC+0 — calendar dates match Africa/Ouagadougou. */

export type ServiceKind = "MIDI" | "SOIR";

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function weekdayFromIso(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00Z`).getUTCDay();
}

export function weekdayLabelFr(weekday: number): string {
  return ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][weekday] ?? "";
}

export function formatDateFr(dateIso: string): string {
  const [y, m, d] = dateIso.split("-");
  return `${d}/${m}/${y}`;
}

export function serviceWindow(service: ServiceKind, dateIso: string, restaurant: {
  midi_starts: string;
  midi_ends: string;
  soir_starts: string;
  soir_ends: string;
}): { startsAt: Date; endsAt: Date } {
  const start = service === "MIDI" ? restaurant.midi_starts : restaurant.soir_starts;
  const end = service === "MIDI" ? restaurant.midi_ends : restaurant.soir_ends;
  return {
    startsAt: new Date(`${dateIso}T${start}:00Z`),
    endsAt: new Date(`${dateIso}T${end}:00Z`),
  };
}

export function isExpired(expiresAt: string, now = new Date()): boolean {
  return new Date(expiresAt).getTime() < now.getTime();
}

export function defaultExpiresAt(service: ServiceKind, dateIso: string): string {
  const end = service === "MIDI" ? "15:00:00" : "22:00:00";
  return new Date(`${dateIso}T${end}Z`).toISOString();
}
