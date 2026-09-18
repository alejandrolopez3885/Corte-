import { useState } from "react";
import { Sheet, Field } from "../ui";
import { uid } from "../../lib/dataModel";
import type { EmpleadoEntry } from "../../lib/types";

export function EmpleadoModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (entry: EmpleadoEntry) => void;
}) {
  const [nombre, setNombre] = useState("");

  function save() {
    if (!nombre.trim()) return;
    onSave({ id: uid(), nombre: nombre.trim() });
    onClose();
  }

  return (
    <Sheet title="Nuevo empleado" onClose={onClose}>
      <Field label="Nombre">
        <input
          className="text-input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Carlos"
          autoFocus
        />
      </Field>
      <button className="btn-primary" onClick={save} disabled={!nombre.trim()}>
        Guardar
      </button>
    </Sheet>
  );
}
