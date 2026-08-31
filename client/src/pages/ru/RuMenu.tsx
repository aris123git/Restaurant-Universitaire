import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Item = { position: number; dishId: number; dishName: string; priceFcfa: number };
type Menu = { date: string; midi: Item[]; soir: Item[] };

export function RuMenu() {
  const [menu, setMenu] = useState<Menu | null>(null);

  useEffect(() => {
    void api<Menu>("/api/ru/menu").then(setMenu);
  }, []);

  if (!menu) return <p>Chargement du menu…</p>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <MenuList title="Midi" items={menu.midi} />
      <MenuList title="Soir" items={menu.soir} />
    </div>
  );
}

function MenuList({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-tablet">
      <h3 className="font-display text-3xl">{title}</h3>
      <p className="text-moss">Emploi du temps du restaurant · 4 plats</p>
      <ol className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.dishId} className="flex items-center justify-between rounded-2xl bg-paper px-4 py-4">
            <span className="flex items-center gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-forest text-paper">{item.position}</span>
              <span className="text-xl font-semibold">{item.dishName}</span>
            </span>
            <span className="text-moss">{item.priceFcfa} F</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
