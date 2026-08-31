import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Restaurant = { id: number; name: string };
type Dish = { id: number; name: string };
type Weekly = { weekday: number; service: string; position: number; dish_id: number; dish_name: string; price_fcfa: number };

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function AdminMenus() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [restaurantId, setRestaurantId] = useState<number>();
  const [weekday, setWeekday] = useState(1);
  const [service, setService] = useState<"MIDI" | "SOIR">("MIDI");
  const [weekly, setWeekly] = useState<Weekly[]>([]);
  const [slots, setSlots] = useState([1, 1, 1, 1]);
  const [newDish, setNewDish] = useState("");

  async function loadMeta() {
    const [rus, ds] = await Promise.all([
      api<Restaurant[]>("/api/admin/restaurants"),
      api<Dish[]>("/api/admin/dishes"),
    ]);
    setRestaurants(rus);
    setDishes(ds);
    setRestaurantId(rus[0]?.id);
  }

  async function loadMenu(id: number) {
    const data = await api<{ weekly: Weekly[] }>(`/api/admin/restaurants/${id}/menu`);
    setWeekly(data.weekly);
  }

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (restaurantId) void loadMenu(restaurantId);
  }, [restaurantId]);

  useEffect(() => {
    const current = weekly.filter((w) => w.weekday === weekday && w.service === service);
    if (current.length) setSlots(current.sort((a, b) => a.position - b.position).map((c) => c.dish_id));
  }, [weekly, weekday, service]);

  return (
    <div>
      <h2 className="font-display text-3xl">Emploi du temps des plats</h2>
      <p className="mt-1 text-moss">Quatre plats par service, selon le restaurant et le jour.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <select className="rounded-xl border px-3 py-2" value={restaurantId} onChange={(e) => setRestaurantId(Number(e.target.value))}>
          {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="rounded-xl border px-3 py-2" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <select className="rounded-xl border px-3 py-2" value={service} onChange={(e) => setService(e.target.value as "MIDI" | "SOIR")}>
          <option value="MIDI">Midi</option>
          <option value="SOIR">Soir</option>
        </select>
      </div>
      <div className="mt-6 grid gap-3">
        {slots.map((dishId, i) => (
          <label key={i} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
            <span className="w-8 font-display text-xl">{i + 1}</span>
            <select
              className="flex-1 rounded-xl border px-3 py-2"
              value={dishId}
              onChange={(e) => {
                const next = [...slots];
                next[i] = Number(e.target.value);
                setSlots(next);
              }}
            >
              {dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      <button
        className="mt-4 rounded-xl bg-forest px-5 py-3 text-paper"
        onClick={async () => {
          if (!restaurantId) return;
          await api(`/api/admin/restaurants/${restaurantId}/menu`, {
            method: "PUT",
            body: JSON.stringify({
              weekday,
              service,
              items: slots.map((dishId, i) => ({ position: i + 1, dishId, priceFcfa: 200 })),
            }),
          });
          await loadMenu(restaurantId);
        }}
      >
        Enregistrer ce service
      </button>
      <form
        className="mt-8 flex gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/api/admin/dishes", { method: "POST", body: JSON.stringify({ name: newDish }) });
          setNewDish("");
          await loadMeta();
        }}
      >
        <input className="rounded-xl border px-3 py-2" placeholder="Nouveau plat" value={newDish} onChange={(e) => setNewDish(e.target.value)} />
        <button className="rounded-xl border border-forest px-4 py-2">Ajouter un plat au catalogue</button>
      </form>
    </div>
  );
}
