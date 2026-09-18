import { useState } from "react";
import { Sheet, Field, SumInput } from "../ui";
import { money, sumFromText, uid } from "../../lib/dataModel";
import type { EmpleadoEntry } from "../../lib/types";

export function EmpleadoModal({
  onClose,
  onSave,
  onDelete,
  editing,
}: {
  onClose: () => void;
  onSave: (entry: EmpleadoEntry) => void;
  onDelete?: () => void;
  editing?: EmpleadoEntry;
}) {
  const [nombre, setNombre] = useState(editing?.nombre || "");
  const [sueldoDiarioText, setSueldoDiarioText] = useState(editing?.sueldoDiario ? String(editing.sueldoDiario) : "");

  const sueldoDiario = sumFromText(sueldoDiarioText);

  function save() {
    if (!nombre.trim()) return;
    onSave({ id: editing?.id || uid(), nombre: nombre.trim(), sueldoDiario: sueldoDiario || undefined });
    onClose();
  }

  return (
    <Sheet title={editing ? "Editar empleado" : "Nuevo empleado"} onClose={onClose} onDelete={onDelete}>
      <Field label="Nombre">
        <input
          className="text-input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Carlos"
          autoFocus
        />
      </Field>
      <Field label="Sueldo diario">
        <SumInput value={sueldoDiarioText} onChange={setSueldoDiarioText} placeholder="0.00" />
      </Field>
      <Field label="Sueldo semanal (6 días + descanso, no editable)">
        <div className="readonly-value">{money(sueldoDiario * 7)}</div>
      </Field>
      <p className="hint">
        La nómina de cada semana se calcula sola en Equipo &gt; Nómina, según el horario de cada quien: Z paga doble, O/X pagan
        normal, y el descanso (OFF) solo se paga si se trabajaron los otros 6 días.
      </p>
      <button className="btn-primary" onClick={save} disabled={!nombre.trim()}>
        Guardar
      </button>
    </Sheet>
  );
}
