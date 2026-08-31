import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, getToken, setToken, type AuthUser } from "./lib/api";
import { LoginPage } from "./pages/auth/LoginPage";
import { UssdSimulatorPage } from "./pages/UssdSimulatorPage";
import { RuShell } from "./pages/ru/RuShell";
import { RuDashboard } from "./pages/ru/RuDashboard";
import { RuVerify } from "./pages/ru/RuVerify";
import { RuMenu } from "./pages/ru/RuMenu";
import { AdminShell } from "./pages/admin/AdminShell";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminCities } from "./pages/admin/AdminCities";
import { AdminRestaurants } from "./pages/admin/AdminRestaurants";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminMenus } from "./pages/admin/AdminMenus";
import { AdminSms } from "./pages/admin/AdminSms";
import { AdminHistory } from "./pages/admin/AdminHistory";
import { AdminEnrolled } from "./pages/admin/AdminEnrolled";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api<{ user: AuthUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="grid min-h-screen place-items-center text-forest">Chargement…</div>;
  }

  return (
    <Routes>
      <Route path="/simulateur" element={<UssdSimulatorPage />} />
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={user.role === "CENTRAL_ADMIN" ? "/admin" : "/dashboard"} replace />
          ) : (
            <LoginPage
              onLoggedIn={(u, token) => {
                setToken(token);
                setUser(u);
              }}
            />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireRu user={user}>
            <RuShell user={user!} onLogout={() => { setToken(null); setUser(null); }}>
              <RuDashboard />
            </RuShell>
          </RequireRu>
        }
      />
      <Route
        path="/verify"
        element={
          <RequireRu user={user}>
            <RuShell user={user!} onLogout={() => { setToken(null); setUser(null); }}>
              <RuVerify />
            </RuShell>
          </RequireRu>
        }
      />
      <Route
        path="/menu"
        element={
          <RequireRu user={user}>
            <RuShell user={user!} onLogout={() => { setToken(null); setUser(null); }}>
              <RuMenu />
            </RuShell>
          </RequireRu>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin user={user}>
            <AdminShell user={user!} onLogout={() => { setToken(null); setUser(null); }} />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="villes" element={<AdminCities />} />
        <Route path="restaurants" element={<AdminRestaurants />} />
        <Route path="comptes" element={<AdminUsers />} />
        <Route path="menus" element={<AdminMenus />} />
        <Route path="inscrits" element={<AdminEnrolled />} />
        <Route path="sms" element={<AdminSms />} />
        <Route path="historique" element={<AdminHistory />} />
        <Route path="simulateur" element={<UssdSimulatorPage embedded />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? (user.role === "CENTRAL_ADMIN" ? "/admin" : "/dashboard") : "/login"} replace />} />
    </Routes>
  );
}

function RequireRu({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "CENTRAL_ADMIN") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function RequireAdmin({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "CENTRAL_ADMIN") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
