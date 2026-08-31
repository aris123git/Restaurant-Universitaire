import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Sms = { id: number; phone: string; message: string; provider: string; status: string; created_at: string };

export function AdminSms() {
  const [rows, setRows] = useState<Sms[]>([]);
  useEffect(() => {
    void api<Sms[]>("/api/admin/sms").then(setRows);
  }, []);
  return (
    <div>
      <h2 className="font-display text-3xl">SMS simulés</h2>
      <p className="text-moss">Aucun fournisseur SMS réel n’est connecté. Les messages s’affichent ici pour la démonstration.</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-white p-4">
            <p className="text-sm text-moss">{row.phone} · {row.created_at} · {row.status}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans">{row.message}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
