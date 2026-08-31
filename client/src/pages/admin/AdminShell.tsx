import { NavLink, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import type { AuthUser } from "../../lib/api";

export function AdminShell({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="bg-forest p-5 text-paper">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">Administration</p>
        <h1 className="mt-1 font-display text-2xl">Pilotage central</h1>
        <p className="mt-1 text-sm text-sand">{user.fullName}</p>
        <nav className="mt-8 grid gap-1">
          <Item to="/admin" end>Aujourd’hui</Item>
          <Item to="/admin/villes">Villes</Item>
          <Item to="/admin/restaurants">Restaurants</Item>
          <Item to="/admin/comptes">Comptes</Item>
          <Item to="/admin/inscrits">Étudiants inscrits</Item>
          <Item to="/admin/menus">Menus</Item>
          <Item to="/admin/historique">Historique</Item>
          <Item to="/admin/sms">SMS simulés</Item>
          <Item to="/admin/simulateur">Simulateur USSD</Item>
        </nav>
        <button onClick={onLogout} className="mt-8 w-full rounded-xl border border-gold/40 py-2 text-sm">
          Déconnexion
        </button>
      </aside>
      <main className="px-6 py-6">
        <p className="mb-4 rounded-2xl bg-sand px-4 py-3 text-sm">
          Mode TEST : USSD, paiement et SMS sont simulés. Aucune intégration opérateur n’est fonctionnelle.
        </p>
        <Outlet />
      </main>
    </div>
  );
}

function Item({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `rounded-xl px-3 py-2 ${isActive ? "bg-gold text-ink" : "hover:bg-white/10"}`
      }
    >
      {children}
    </NavLink>
  );
}
