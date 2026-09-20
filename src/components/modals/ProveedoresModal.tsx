import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet, Field, Toggle } from "../ui";
import { uid } from "../../lib/dataModel";
import type { InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

export function ProveedoresModal({
  onClose,
  proveedores,
  insumos,
  onSave,
  onToggleJueves,
  onRemove,
}: {
  onClose: () => void;
  proveedores: ProveedorCatalogEntry[];
  insumos: InsumoEntry[];
  onSave: (entry: ProveedorCatalogEntry) => void;
  onToggleJueves: (id: string, incluyeJueves: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const [nombre, setNombre] = useState("");

  function add() {
    if (!nombre.trim()) return;
    onSave({ id: uid(), nombre: nombre.trim() });
    setNombre("");
  }

  return (
    <Sheet title="Proveedores" onClose={onClose}>
      <p className="hint">
        Los mismos proveedores que usas en el Catálogo de Bar/Cocina y en Inventario. Un proveedor con insumos asignados
        no se puede eliminar.
      </p>
      <div className="catalog-list">
        {proveedores.length === 0 && <p className="hint">Aún no agregas proveedores.</p>}
        {proveedores.map((p) => {
          const enUso = insumos.some((i) => i.proveedorId === p.id);
          return (
            <div className="proveedor-row" key={p.id}>
              <div className="proveedor-row-top">
                <strong>{p.nombre}</strong>
                <button
                  className="icon-btn"
                  onClick={() => onRemove(p.id)}
                  disabled={enUso}
                  aria-label={enUso ? `${p.nombre} tiene insumos asignados, no se puede eliminar` : `Eliminar ${p.nombre}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <Toggle
                checked={!!p.incluyeJueves}
                onChange={(v) => onToggleJueves(p.id, v)}
                label="También se pide los jueves"
              />
              {enUso && <p className="proveedor-row-hint">Tiene insumos en el catálogo — no se puede eliminar.</p>}
            </div>
          );
        })}
      </div>
      <div className="field-row">
        <Field label="Nombre">
          <input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nuevo proveedor" />
        </Field>
      </div>
      <button className="btn-primary" onClick={add} disabled={!nombre.trim()}>
        Agregar proveedor
      </button>
    </Sheet>
  );
}
