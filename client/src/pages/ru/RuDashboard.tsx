import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

type DishLine = {
  dishId: number;
  dishName: string;
  plates: number;
  servedPlates: number;
  pendingPlates: number;
};

type Dashboard = {
  restaurant: { name: string; city_name: string };
  date: string;
  totals: { totalPlates: number; midiPlates: number; soirPlates: number; servedPlates: number; waitingPlates: number };
  midi: { plates: number; dishes: DishLine[] };
  soir: { plates: number; dishes: DishLine[] };
};

export function RuDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await api<Dashboard>("/api/ru/dashboard"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, []);

  if (error) return <p className="text-brick">{error}</p>;
  if (!data) return <p>Chargement du tableau de bord…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-moss">À préparer aujourd’hui</p>
          <h2 className="font-display text-4xl">{data.totals.totalPlates} plats</h2>
          <p className="text-moss">Servis : {data.totals.servedPlates} · En attente : {data.totals.waitingPlates}</p>
        </div>
        <Link to="/verify" className="rounded-2xl bg-forest px-6 py-4 text-lg font-semibold text-paper">
          Vérifier un code
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <ServiceCard title="Midi" plates={data.midi.plates} dishes={data.midi.dishes} />
        <ServiceCard title="Soir" plates={data.soir.plates} dishes={data.soir.dishes} />
      </div>
    </div>
  );
}

function ServiceCard({ title, plates, dishes }: { title: string; plates: number; dishes: DishLine[] }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-tablet">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-3xl">{title}</h3>
        <p className="font-display text-4xl text-forest">{plates}</p>
      </div>
      <p className="text-sm uppercase tracking-widest text-moss">plats commandés</p>
      <ul className="mt-5 space-y-3">
        {dishes.map((dish) => (
          <li key={dish.dishId} className="flex items-center justify-between rounded-2xl bg-paper px-4 py-3">
            <div>
              <p className="text-lg font-semibold">{dish.dishName}</p>
              <p className="text-sm text-moss">dont {dish.servedPlates} servis</p>
            </div>
            <p className="font-display text-3xl">{dish.plates}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
