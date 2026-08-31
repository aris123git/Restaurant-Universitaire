import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type City = { id: number; name: string };
type Restaurant = {
  id: number;
  name: string;
  code: string;
  city_id: number;
  city_name: string;
  active: number;
};

export function AdminRestaurants() {
  const [list, setList] = useState<Restaurant[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({ cityId: 1, name: "", code: "" });

  async function load() {
    const [restaurants, cityRows] = await Promise.all([
      api<Restaurant[]>("/api/admin/restaurants"),
      api<City[]>("/api/admin/cities"),
    ]);
    setList(restaurants);
    setCities(cityRows);
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <h2 className="font-display text-3xl">Restaurants universitaires</h2>
      <form
        className="mt-4 grid gap-3 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/api/admin/restaurants", {
            method: "POST",
            body: JSON.stringify({ ...form, cityId: Number(form.cityId) }),
          });
          setForm({ ...form, name: "", code: "" });
          await load();
        }}
      >
        <select
          className="rounded-xl border border-sand px-3 py-2"
          value={form.cityId}
          onChange={(e) => setForm({ ...form, cityId: Number(e.target.value) })}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input className="rounded-xl border border-sand px-3 py-2" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded-xl border border-sand px-3 py-2" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <button className="rounded-xl bg-forest px-4 py-2 text-paper">Créer</button>
      </form>
      <ul className="mt-6 space-y-2">
        {list.map((ru) => (
          <li key={ru.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
            <div>
              <p className="font-semibold">{ru.name}</p>
              <p className="text-sm text-moss">{ru.city_name} · {ru.code}</p>
            </div>
            <button
              className="text-sm"
              onClick={async () => {
                await api(`/api/admin/restaurants/${ru.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ active: !ru.active }),
                });
                await load();
              }}
            >
              {ru.active ? "Désactiver" : "Activer"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
