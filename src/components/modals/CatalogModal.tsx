import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet, Field } from "../ui";
import { uid } from "../../lib/dataModel";
import type { MeseroCatalogEntry } from "../../lib/types";

export function CatalogModal({
  onClose,
  meseros,
  onSave,
  onRemove,
}: {
  onClose: () => void;
  meseros: MeseroCatalogEntry[];
  onSave: (entry: MeseroCatalogEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [nombre, setNombre] = useState("");

  function add() {
    if (!nombre.trim()) return;
    onSave({ id: uid(), nombre: nombre.trim() });
    setNombre("");
  }

  return (
    <Sheet title="Lista de meseros" onClose={onClose}>
      <p className="hint">Aquí administras a tu equipo. La propina se elige después, al hacer cada corte.</p>
      <div className="catalog-list">
        {meseros.length === 0 && <p className="hint">Aún no agregas a nadie.</p>}
        {meseros.map((m) => (
          <div key={m.id} className="catalog-row">
            <strong>{m.nombre}</strong>
            <button className="icon-btn" onClick={() => onRemove(m.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="field-row">
        <Field label="Nombre">
          <input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nuevo mesero" />
        </Field>
      </div>
      <button className="btn-primary" onClick={add} disabled={!nombre.trim()}>
        Agregar a la lista
      </button>
    </Sheet>
  );
}
