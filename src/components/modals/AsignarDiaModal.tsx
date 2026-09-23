import { useState } from "react";
import { UserRound } from "lucide-react";
import { Empty, Sheet } from "../ui";
import type { DayData, EmpleadoEntry } from "../../lib/types";

export function AsignarDiaModal({
  onClose,
  fechaLabel,
  empleados,
  asignadoA,
  hechoPor,
  onAsignar,
  onQuitar,
}: {
  onClose: () => void;
  fechaLabel: string;
  // Solo personal con acceso a la app (staffProfileId) ya creado desde
  // Personal — asignar un día no crea una cuenta nueva.
  empleados: EmpleadoEntry[];
  asignadoA: DayData["asignadoA"];
  hechoPor: DayData["hechoPor"];
  onAsignar: (empleado: EmpleadoEntry) => Promise<void>;
  onQuitar: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conAcceso = empleados.filter((e) => e.staffProfileId);

  async function asignar(empleado: EmpleadoEntry) {
    setError(null);
    setBusy(true);
    try {
      await onAsignar(empleado);
      onClose();
    } catch {
      setError("No se pudo asignar el día. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function quitar() {
    setError(null);
    setBusy(true);
    try {
      await onQuitar();
      onClose();
    } catch {
      setError("No se pudo quitar la asignación. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Asignar día" onClose={onClose}>
      <p className="hint">
        Elige a quién de tu personal le toca capturar el corte de <strong>{fechaLabel}</strong>. Le va a aparecer la opción
        "Corte" en su cuenta, acotada a este día.
      </p>
      {error && <div className="auth-error">{error}</div>}

      {asignadoA && (
        <div className="asignado-actual">
          <span>
            Asignado a <strong>{asignadoA.nombre}</strong>
          </span>
          <button className="link-btn" disabled={busy} onClick={quitar}>
            Quitar
          </button>
        </div>
      )}
      {hechoPor && (
        <p className="hint">
          El corte de este día lo capturó <strong>{hechoPor.nombre}</strong>.
        </p>
      )}

      {conAcceso.length === 0 ? (
        <Empty
          icon={<UserRound size={26} strokeWidth={1.3} />}
          text="Ninguna persona de tu Personal tiene acceso a la app todavía. Dale acceso desde Equipo > Personal primero."
        />
      ) : (
        <div className="horario-emp-list">
          {conAcceso.map((e) => (
            <button key={e.id} className="horario-emp-item" disabled={busy || asignadoA?.empleadoId === e.id} onClick={() => asignar(e)}>
              {e.nombre}
              {asignadoA?.empleadoId === e.id && " (ya asignado)"}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
