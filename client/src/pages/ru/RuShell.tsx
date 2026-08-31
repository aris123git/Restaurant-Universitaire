import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import type { AuthUser } from "../../lib/api";

export function RuShell({
  user,
  onLogout,
  children,
}: {
  user: AuthUser;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-sand bg-forest text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Restaurant universitaire</p>
            <h1 className="font-display text-2xl leading-tight">{user.restaurantName}</h1>
            <p className="text-sm text-sand">{user.cityName} · {user.fullName}</p>
          </div>
          <button onClick={onLogout} className="rounded-xl border border-gold/40 px-4 py-2 text-sm">
            Verrouiller
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 px-6 pb-4">
          <Tab to="/dashboard">Aujourd’hui</Tab>
          <Tab to="/verify">Vérifier un code</Tab>
          <Tab to="/menu">Menu du jour</Tab>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}

function Tab({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-2xl px-5 py-3 text-base font-semibold ${
          isActive ? "bg-gold text-ink" : "bg-white/10 text-paper"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
