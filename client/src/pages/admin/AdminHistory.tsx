import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Restaurant = { id: number; name: string };
type Row = { date: string; service: string; plates: number; served: number; noShow: number };

export function AdminHistory() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [id, setId] = useState<number>();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    void api<Restaurant[]>("/api/admin/restaurants").then((list) => {
      setRestaurants(list);
      setId(list[0]?.id);
    });
  }, []);

  useEffect(() => {
    if (id) void api<Row[]>(`/api/admin/history/${id}`).then(setRows);
  }, [id]);

  return (
    <div>
      <h2 className="font-display text-3xl">Historique</h2>
      <p className="text-moss">Base pour analyser la demande, les absences et, plus tard, les prévisions.</p>
      <select className="mt-4 rounded-xl border px-3 py-2" value={id} onChange={(e) => setId(Number(e.target.value))}>
        {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <table className="mt-4 w-full overflow-hidden rounded-2xl bg-white text-left">
        <thead className="bg-sand">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th>Service</th>
            <th>Plats</th>
            <th>Servis</th>
            <th>Non présentés</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.date}-${row.service}`} className="border-t border-sand">
              <td className="px-4 py-3">{row.date}</td>
              <td>{row.service}</td>
              <td>{row.plates}</td>
              <td>{row.served}</td>
              <td>{row.noShow}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
