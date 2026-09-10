import { useAuth } from "./lib/auth.tsx";
import Login from "./pages/Login.tsx";
import CortesApp from "./pages/CortesApp.tsx";

export default function App() {
  const { session, profile, status } = useAuth();

  if (status === "loading") {
    return (
      <div className="app-shell">
        <div className="loading">Cargando…</div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (!profile) {
    return (
      <div className="app-shell">
        <div className="full-page-msg">
          Tu cuenta no tiene un perfil configurado todavía. Pide al encargado que te dé de alta desde Supabase.
        </div>
      </div>
    );
  }

  return <CortesApp profile={profile} />;
}
