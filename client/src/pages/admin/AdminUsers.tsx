import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type User = { id: number; email: string; full_name: string; role: string; active: number; restaurant_name: string | null };
type Restaurant = { id: number; name: string };

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [form, setForm] = useState({
    email: "",
    password: "Agent1234!",
    fullName: "",
    role: "RU_AGENT",
    restaurantId: 1,
  });

  async function load() {
    setUsers(await api<User[]>("/api/admin/users"));
    setRestaurants(await api<Restaurant[]>("/api/admin/restaurants"));
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <h2 className="font-display text-3xl">Comptes</h2>
      <form
        className="mt-4 grid gap-3 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/api/admin/users", {
            method: "POST",
            body: JSON.stringify({ ...form, restaurantId: Number(form.restaurantId) }),
          });
          await load();
        }}
      >
        <input className="rounded-xl border px-3 py-2" placeholder="Nom" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input className="rounded-xl border px-3 py-2" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="rounded-xl border px-3 py-2" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className="rounded-xl border px-3 py-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="RU_AGENT">Agent RU</option>
          <option value="RU_MANAGER">Responsable RU</option>
          <option value="CENTRAL_ADMIN">Admin central</option>
        </select>
        <select className="rounded-xl border px-3 py-2" value={form.restaurantId} onChange={(e) => setForm({ ...form, restaurantId: Number(e.target.value) })}>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <button className="rounded-xl bg-forest px-4 py-2 text-paper">Créer le compte</button>
      </form>
      <ul className="mt-6 space-y-2">
        {users.map((u) => (
          <li key={u.id} className="flex justify-between rounded-2xl bg-white px-4 py-3">
            <div>
              <p className="font-semibold">{u.full_name}</p>
              <p className="text-sm text-moss">{u.email} · {u.role} · {u.restaurant_name ?? "central"}</p>
            </div>
            <button
              onClick={async () => {
                await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) });
                await load();
              }}
            >
              {u.active ? "Désactiver" : "Activer"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
