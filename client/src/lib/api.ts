export type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  role: "CENTRAL_ADMIN" | "RU_MANAGER" | "RU_AGENT";
  restaurantId: number | null;
  restaurantName: string | null;
  restaurantCode: string | null;
  cityName: string | null;
};

const TOKEN_KEY = "ru_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Erreur réseau");
  }
  return data as T;
}
