import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Enrolled = {
  id: number;
  phone: string;
  student_number: string | null;
  full_name: string | null;
  source: string;
  active: number;
};

export function AdminEnrolled() {
  const [rows, setRows] = useState<Enrolled[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ phone: "", studentNumber: "", fullName: "" });
  const [bulk, setBulk] = useState("");
  const [notice, setNotice] = useState("");

  async function load(q = query) {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    setRows(await api<Enrolled[]>(`/api/admin/enrollments${suffix}`));
  }

  useEffect(() => {
    void load("");
  }, []);

  return (
    <div>
      <h2 className="font-display text-3xl">Étudiants inscrits</h2>
      <p className="mt-2 max-w-3xl text-moss">
        Seuls les numéros présents ici peuvent réserver. Cette table est prévue pour recevoir l’export de la
        base universitaire. L’API officielle n’est pas encore branchée : importez un CSV en attendant.
      </p>
      <form
        className="mt-4 grid gap-3 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/api/admin/enrollments", { method: "POST", body: JSON.stringify(form) });
          setForm({ phone: "", studentNumber: "", fullName: "" });
          await load();
        }}
      >
        <input className="rounded-xl border px-3 py-2" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="rounded-xl border px-3 py-2" placeholder="Matricule" value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} />
        <input className="rounded-xl border px-3 py-2" placeholder="Nom" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <button className="rounded-xl bg-forest px-4 py-2 text-paper">Ajouter</button>
      </form>
      <form
        className="mt-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await api<{ received: number; inserted: number; updated: number; notice: string }>(
            "/api/admin/enrollments/import",
            { method: "POST", body: JSON.stringify({ text: bulk, source: "csv_import" }) },
          );
          setNotice(`${result.inserted} ajoutés, ${result.updated} mis à jour. ${result.notice}`);
          setBulk("");
          await load();
        }}
      >
        <label className="text-sm font-semibold">Import CSV (téléphone, matricule, nom)</label>
        <textarea
          className="mt-1 h-32 w-full rounded-2xl border px-3 py-2 font-mono text-sm"
          placeholder={"+22670111111,UJKZ-1001,Nom Prénom"}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <button className="mt-2 rounded-xl border border-forest px-4 py-2">Importer les numéros</button>
      </form>
      {notice && <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm">{notice}</p>}
      <div className="mt-6 flex gap-3">
        <input className="rounded-xl border px-3 py-2" placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="rounded-xl bg-forest px-4 py-2 text-paper" onClick={() => void load()}>
          Filtrer
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
            <div>
              <p className="font-semibold">{row.full_name || "Sans nom"} · {row.phone}</p>
              <p className="text-sm text-moss">{row.student_number ?? "—"} · {row.source} · {row.active ? "actif" : "inactif"}</p>
            </div>
            <button
              onClick={async () => {
                await api(`/api/admin/enrollments/${row.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ active: !row.active }),
                });
                await load();
              }}
            >
              {row.active ? "Désactiver" : "Activer"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
