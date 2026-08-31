import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Dash = {
  date: string;
  totals: { reservations: number; plates: number; payments: number; served: number; notPickedUp: number };
  byCity: Array<{ cityName: string; restaurantName: string; plates: number }>;
  byService: Array<{ service: string; plates: number }>;
};

export function AdminDashboard() {
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    void api<Dash>("/api/admin/dashboard").then(setData);
  }, []);

  if (!data) return <p>Chargement…</p>;
  const grouped = data.byCity.reduce((acc, row) => {
    const list = acc.get(row.cityName) ?? [];
    list.push(row);
    acc.set(row.cityName, list);
    return acc;
  }, new Map<string, typeof data.byCity>());

  return (
    <div>
      <h2 className="font-display text-3xl">Aujourd’hui</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Réservations" value={data.totals.reservations} />
        <Stat label="Plats" value={data.totals.plates} />
        <Stat label="Paiements (F)" value={data.totals.payments} />
        <Stat label="Plats servis" value={data.totals.served} />
        <Stat label="Non retirés" value={data.totals.notPickedUp} />
      </div>
      <div className="mt-6 flex gap-4">
        {data.byService.map((s) => (
          <div key={s.service} className="rounded-2xl bg-white px-5 py-4 shadow-tablet">
            <p className="text-sm text-moss">{s.service}</p>
            <p className="font-display text-3xl">{s.plates} plats</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {[...grouped.entries()].map(([city, rows]) => (
          <section key={city} className="rounded-3xl bg-white p-5 shadow-tablet">
            <h3 className="font-display text-2xl">{city}</h3>
            <ul className="mt-3 space-y-2">
              {rows.map((row) => (
                <li key={row.restaurantName} className="flex justify-between rounded-xl bg-paper px-3 py-2">
                  <span>{row.restaurantName}</span>
                  <strong>{row.plates} plats</strong>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-tablet">
      <p className="text-sm text-moss">{label}</p>
      <p className="font-display text-3xl">{value}</p>
    </div>
  );
}
