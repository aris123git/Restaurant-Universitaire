import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type AuthUser } from "../../lib/api";

export function LoginPage({
  onLoggedIn,
}: {
  onLoggedIn: (user: AuthUser, token: string) => void;
}) {
  const [email, setEmail] = useState("ujkz@ru.bf");
  const [password, setPassword] = useState("Agent1234!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLoggedIn(data.user, data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-forest font-display text-lg text-paper">RU</div>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-moss">Plateforme centrale</p>
          <h1 className="font-display text-3xl">Restaurants universitaires</h1>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={submit} className="rounded-3xl bg-white p-8 shadow-tablet">
          <h2 className="font-display text-2xl">Connexion tablette</h2>
          <p className="mt-2 text-moss">Espace restaurant ou administration. L’étudiant n’utilise pas cette application.</p>
          <label className="mt-6 block text-sm font-semibold">E-mail</label>
          <input
            className="mt-1 w-full rounded-2xl border border-sand bg-paper px-4 py-3 text-lg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <label className="mt-4 block text-sm font-semibold">Mot de passe</label>
          <input
            type="password"
            className="mt-1 w-full rounded-2xl border border-sand bg-paper px-4 py-3 text-lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="mt-3 text-brick">{error}</p>}
          <button
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-forest py-4 text-lg font-semibold text-paper"
          >
            {loading ? "Connexion…" : "Entrer"}
          </button>
          <div className="mt-6 rounded-2xl bg-sand px-4 py-3 text-sm leading-6">
            <p className="font-semibold">Comptes de démonstration</p>
            <p>Agent UJKZ : ujkz@ru.bf / Agent1234!</p>
            <p>Agent Ouaga 2 : oua2@ru.bf / Agent1234!</p>
            <p>Admin : admin@ru.bf / Admin1234!</p>
          </div>
        </form>
        <aside className="rounded-3xl bg-forest p-8 text-paper">
          <p className="text-sm uppercase tracking-[0.2em] text-gold">Mode TEST</p>
          <h2 className="mt-2 font-display text-3xl">USSD · paiement · SMS simulés</h2>
          <p className="mt-4 text-lg leading-8 text-sand">
            Aucune intégration Orange n’est active. Les étudiants commandent par USSD, reçoivent un code, puis
            retirent un jeton physique au restaurant.
          </p>
          <Link
            to="/simulateur"
            className="mt-8 inline-flex rounded-2xl bg-gold px-5 py-3 font-semibold text-ink"
          >
            Ouvrir le simulateur étudiant
          </Link>
        </aside>
      </div>
    </div>
  );
}
