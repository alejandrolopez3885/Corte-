import { useState } from "react";
import { Sheet, Field, SumInput, Toggle } from "../ui";
import { sumFromText, uid } from "../../lib/dataModel";
import type { InsumoArea, InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

const NUEVO_PROVEEDOR = "__nuevo__";

export function InsumoModal({
  area,
  editing,
  proveedores,
  onClose,
  onSave,
  onDelete,
}: {
  area: InsumoArea;
  editing?: InsumoEntry;
  proveedores: ProveedorCatalogEntry[];
  onClose: () => void;
  onSave: (entry: InsumoEntry, nuevoProveedor?: ProveedorCatalogEntry) => void;
  onDelete?: () => void;
}) {
  const [nombre, setNombre] = useState(editing?.nombre || "");
  const [unidad, setUnidad] = useState(editing?.unidad || "");
  const [precioText, setPrecioText] = useState(editing?.precio ? String(editing.precio) : "");
  const [proveedorId, setProveedorId] = useState(editing?.proveedorId || "");
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [altaRotacion, setAltaRotacion] = useState(editing?.altaRotacion || false);

  // Si se está creando un proveedor nuevo, tiene que ir en el mismo guardado
  // que el insumo (una sola llamada, un solo persist) — guardarlos por
  // separado arriesga que el segundo persist se base en datos viejos y
  // borre al primero, porque ambos parten de un structuredClone(data)
  // tomado en el mismo instante.
  function save() {
    if (!nombre.trim() || !unidad.trim()) return;
    let finalProveedorId = proveedorId && proveedorId !== NUEVO_PROVEEDOR ? proveedorId : undefined;
    let nuevoProveedorEntry: ProveedorCatalogEntry | undefined;
    if (proveedorId === NUEVO_PROVEEDOR && nuevoProveedor.trim()) {
      nuevoProveedorEntry = { id: uid(), nombre: nuevoProveedor.trim() };
      finalProveedorId = nuevoProveedorEntry.id;
    }
    onSave(
      {
        id: editing?.id || uid(),
        area,
        nombre: nombre.trim(),
        unidad: unidad.trim(),
        precio: sumFromText(precioText) || undefined,
        proveedorId: finalProveedorId,
        altaRotacion,
      },
      nuevoProveedorEntry
    );
    onClose();
  }

  return (
    <Sheet title={editing ? "Editar insumo" : "Nuevo insumo"} onClose={onClose} onDelete={onDelete}>
      <Field label="Nombre">
        <input
          className="text-input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Papas Crisscut"
          autoFocus
        />
      </Field>
      <Field label="Unidad de medida">
        <input
          className="text-input"
          list="unidades-comunes"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          placeholder="Ej. kg, pza, lt"
        />
        <datalist id="unidades-comunes">
          <option value="kg" />
          <option value="pza" />
          <option value="lt" />
          <option value="caja" />
          <option value="paquete" />
        </datalist>
      </Field>
      <Field label="Precio de referencia (opcional, por unidad)">
        <SumInput value={precioText} onChange={setPrecioText} placeholder="0.00" />
      </Field>
      <Field label="Proveedor (opcional)">
        <select className="text-input" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Sin proveedor</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
          <option value={NUEVO_PROVEEDOR}>+ Nuevo proveedor…</option>
        </select>
      </Field>
      {proveedorId === NUEVO_PROVEEDOR && (
        <Field label="Nombre del nuevo proveedor">
          <input
            className="text-input"
            value={nuevoProveedor}
            onChange={(e) => setNuevoProveedor(e.target.value)}
            placeholder="Ej. Fracksa"
            autoFocus
          />
        </Field>
      )}
      <Toggle
        checked={altaRotacion}
        onChange={setAltaRotacion}
        label="Alta rotación (aparece primero en el conteo diario)"
      />
      <button className="btn-primary" onClick={save} disabled={!nombre.trim() || !unidad.trim()}>
        Guardar
      </button>
    </Sheet>
  );
}
