import { useEffect, useState } from "react";
import { Delete, ArrowLeft } from "lucide-react";
import { getStaffDirectory, signInWithPin, PIN_LENGTH, type StaffDirectoryEntry } from "../lib/staffAccounts";

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function PinLogin({ onBack }: { onBack: () => void }) {
  const [directory, setDirectory] = useState<StaffDirectoryEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<StaffDirectoryEntry | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getStaffDirectory()
      .then(setDirectory)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !selected) return;
    setSubmitting(true);
    setError(null);
    signInWithPin(selected.login_slug, pin).then(({ error }) => {
      setSubmitting(false);
      if (error) {
        setError("PIN incorrecto.");
        setPin("");
      }
    });
  }, [pin, selected]);

  function press(key: string) {
    if (submitting) return;
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === "") return;
    setError(null);
    setPin((p) => (p.length < PIN_LENGTH ? p + key : p));
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <button type="button" className="link-btn" onClick={selected ? () => { setSelected(null); setPin(""); setError(null); } : onBack}>
          <ArrowLeft size={14} style={{ verticalAlign: "-2px" }} /> {selected ? "Elegir otra persona" : "Volver"}
        </button>

        {!selected ? (
          <>
            <h1 className="auth-title">¿Quién eres?</h1>
            <p className="auth-subtitle">Toca tu nombre para capturar tu corte del día.</p>
            {loadError && <div className="auth-error">No se pudo cargar la lista. Revisa tu conexión.</div>}
            {!loadError && directory === null && <p className="hint">Cargando…</p>}
            {directory && directory.length === 0 && (
              <p className="hint">Aún no hay cuentas de equipo creadas. Pide al dueño que te dé de alta desde la app.</p>
            )}
            <div className="staff-name-grid">
              {directory?.map((s) => (
                <button key={s.id} className="staff-name-btn" onClick={() => setSelected(s)}>
                  {s.display_name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title">Hola, {selected.display_name}</h1>
            <p className="auth-subtitle">Ingresa tu PIN de {PIN_LENGTH} dígitos.</p>
            {error && <div className="auth-error">{error}</div>}
            <div className="pin-dots">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <span key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
              ))}
            </div>
            <div className="pin-keypad">
              {KEYPAD.map((key, i) =>
                key === "" ? (
                  <span key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    className="pin-key"
                    disabled={submitting}
                    onClick={() => press(key)}
                    aria-label={key === "del" ? "Borrar" : key}
                  >
                    {key === "del" ? <Delete size={18} /> : key}
                  </button>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
