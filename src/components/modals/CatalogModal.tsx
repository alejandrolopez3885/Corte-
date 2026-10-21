import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet, Field, Toggle } from "../ui";
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
      <p className="hint">
        "Se acumula en el día" es para un usuario compartido del sistema, como "Para llevar": puede tener varios cortes en el
        mismo día y cada uno se captura con lo que marca el sistema; la app resta lo ya cortado (desde el 21 de octubre).
      </p>
      <div className="catalog-list">
        {meseros.length === 0 && <p className="hint">Aún no agregas a nadie.</p>}
        {meseros.map((m) => (
          <div key={m.id} className="catalog-row catalog-row-mesero">
            <div>
              <strong>
                {m.nombre} {m.acumulado && <span className="tag-acumulado">Acumulado</span>}
              </strong>
              <Toggle
                checked={!!m.acumulado}
                onChange={(v) => onSave({ ...m, acumulado: v || undefined })}
                label="Se acumula en el día (varios cortes)"
              />
            </div>
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
