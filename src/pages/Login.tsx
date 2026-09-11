import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import PinLogin from "./PinLogin";

export default function Login() {
  const [mode, setMode] = useState<"owner" | "pin">("owner");

  if (mode === "pin") return <PinLogin onBack={() => setMode("owner")} />;

  return <OwnerLogin onSwitchToPin={() => setMode("pin")} />;
}

function OwnerLogin({ onSwitchToPin }: { onSwitchToPin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Correo o contraseña incorrectos.");
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Cortes</h1>
        <p className="auth-subtitle">Inicia sesión para capturar el corte del día.</p>
        {error && <div className="auth-error">{error}</div>}
        <label className="field">
          <span>Correo</span>
          <input
            className="text-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            className="text-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
        <button type="button" className="link-btn" style={{ textAlign: "center" }} onClick={onSwitchToPin}>
          Soy del equipo, tengo un PIN
        </button>
      </form>
    </div>
  );
}
