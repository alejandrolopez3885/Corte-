import { useState } from "react";
import { Sheet, Field } from "../ui";

export function MonthModal({
  onClose,
  onSave,
  existing,
}: {
  onClose: () => void;
  onSave: (monthKey: string) => void;
  existing: string[];
}) {
  const now = new Date();
  const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [value, setValue] = useState(def);
  return (
    <Sheet title="Agregar mes" onClose={onClose}>
      <Field label="Mes y año">
        <input type="month" className="month-input" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      {existing.includes(value) && <p className="hint">Ese mes ya existe, lo abriremos.</p>}
      <button className="btn-primary" onClick={() => onSave(value)}>
        Guardar
      </button>
    </Sheet>
  );
}
