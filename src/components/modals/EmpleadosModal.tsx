import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet, Field } from "../ui";
import { uid } from "../../lib/dataModel";
import type { EmpleadoEntry } from "../../lib/types";

export function EmpleadosModal({
  onClose,
  empleados,
  onSave,
  onRemove,
}: {
  onClose: () => void;
  empleados: EmpleadoEntry[];
  onSave: (entry: EmpleadoEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [nombre, setNombre] = useState("");

  function add() {
    if (!nombre.trim()) return;
    onSave({ id: uid(), nombre: nombre.trim() });
    setNombre("");
  }

  return (
    <Sheet title="Personal" onClose={onClose}>
      <p className="hint">
        Lista de tu personal — por ahora solo el nombre. Es independiente del catálogo de meseros (ese es para el corte). Más
        adelante aquí mismo vas a poder armar horarios y nómina para cada quien.
      </p>

      <div className="catalog-list">
        {empleados.length === 0 && <p className="hint">Aún no agregas a nadie.</p>}
        {empleados.map((e) => (
          <div key={e.id} className="catalog-row">
            <strong>{e.nombre}</strong>
            <button className="icon-btn" onClick={() => onRemove(e.id)} aria-label={`Quitar a ${e.nombre}`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="field-row">
        <Field label="Nombre">
          <input
            className="text-input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nuevo empleado"
          />
        </Field>
      </div>
      <button className="btn-primary" onClick={add} disabled={!nombre.trim()}>
        Agregar a la lista
      </button>
    </Sheet>
  );
}
