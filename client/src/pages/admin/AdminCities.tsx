import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type City = { id: number; name: string; active: number };

export function AdminCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [name, setName] = useState("");

  async function load() {
    setCities(await api<City[]>("/api/admin/cities"));
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <h2 className="font-display text-3xl">Villes</h2>
      <form
        className="mt-4 flex gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/api/admin/cities", { method: "POST", body: JSON.stringify({ name }) });
          setName("");
          await load();
        }}
      >
        <input className="rounded-xl border border-sand px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle ville" />
        <button className="rounded-xl bg-forest px-4 py-2 text-paper">Créer</button>
      </form>
      <ul className="mt-6 space-y-2">
        {cities.map((city) => (
          <li key={city.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
            <span>{city.name}</span>
            <button
              className="text-sm text-moss"
              onClick={async () => {
                await api(`/api/admin/cities/${city.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ active: !city.active }),
                });
                await load();
              }}
            >
              {city.active ? "Désactiver" : "Activer"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
