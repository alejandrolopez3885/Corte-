import { useAuth } from "./lib/auth.tsx";
import Login from "./pages/Login.tsx";
import EncuestaPublica from "./pages/EncuestaPublica.tsx";
import CortesApp from "./pages/CortesApp.tsx";
import { BarraTituloProvider } from "./components/BarraTitulo";

// Encuesta del cliente (QR): se abre sin iniciar sesión, antes de todo.
const tokenEncuesta = new URLSearchParams(window.location.search).get("e");

export default function App() {
  const { session, profile, status } = useAuth();

  if (tokenEncuesta) return <EncuestaPublica token={tokenEncuesta} />;

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

  return (
    <BarraTituloProvider>
      <CortesApp profile={profile} />
    </BarraTituloProvider>
  );
}
