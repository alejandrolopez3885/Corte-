import { useState } from "react";
import { Sheet, Field, SumInput, Toggle } from "../ui";
import { pidePorOtraUnidad, pluralizarUnidad, sumFromText, todayIso, uid } from "../../lib/dataModel";
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
  const esBar = area === "bar";
  const [nombre, setNombre] = useState(editing?.nombre || "");
  const [unidad, setUnidad] = useState(esBar ? "pieza" : editing?.unidad || "kg");
  const [precioText, setPrecioText] = useState(editing?.precio ? String(editing.precio) : "");
  const [proveedorId, setProveedorId] = useState(editing?.proveedorId || "");
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [altaRotacion, setAltaRotacion] = useState(editing?.altaRotacion || false);
  const [unidadPedido, setUnidadPedido] = useState(editing?.unidadPedido || "");
  const [presentacion, setPresentacion] = useState(editing?.presentacion || "");
  const [pendiente, setPendiente] = useState(editing?.pendiente);
  const [equivalenciaText, setEquivalenciaText] = useState(editing?.equivalenciaPedido ? String(editing.equivalenciaPedido) : "");

  // Si se está creando un proveedor nuevo, tiene que ir en el mismo guardado
  // que el insumo (una sola llamada, un solo persist) — guardarlos por
  // separado arriesga que el segundo persist se base en datos viejos y
  // borre al primero, porque ambos parten de un structuredClone(data)
  // tomado en el mismo instante.
  const esPieza = (esBar ? "pieza" : unidad) === "pieza";
  const unidadConteoLabel = esPieza ? presentacion.trim() || "pz" : "kg";
  const necesitaEquivalencia = pidePorOtraUnidad({
    id: "", area, nombre, unidad: esBar ? "pieza" : unidad, unidadPedido, presentacion: esPieza ? presentacion.trim() : undefined,
  });

  function save() {
    if (!nombre.trim()) return;
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
        unidad: esBar ? "pieza" : unidad,
        precio: sumFromText(precioText) || undefined,
        proveedorId: finalProveedorId,
        altaRotacion,
        conteoDiarioDesde: altaRotacion && !editing?.altaRotacion ? todayIso() : editing?.conteoDiarioDesde,
        presentacion: esPieza ? presentacion.trim() || undefined : undefined,
        unidadPedido: unidadPedido.trim() || undefined,
        equivalenciaPedido: necesitaEquivalencia ? sumFromText(equivalenciaText) || undefined : undefined,
        apodos: editing?.apodos,
        pendiente,
      },
      nuevoProveedorEntry
    );
    onClose();
  }

  return (
    <Sheet title={editing ? "Editar insumo" : "Nuevo insumo"} onClose={onClose} onDelete={onDelete}>
      {pendiente && (
        <div className="insumo-pendiente">
          <span>
            <strong>Pendiente del Excel:</strong> {pendiente}
          </span>
          <button className="link-btn" onClick={() => setPendiente(undefined)}>
            Ya lo completé
          </button>
        </div>
      )}
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
        <select
          className="text-input"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          disabled={esBar}
        >
          <option value="kg">Kg</option>
          <option value="pieza">Pieza</option>
        </select>
      </Field>
      {esPieza && (
        <Field label="Se cuenta por (opcional)">
          <input
            className="text-input"
            value={presentacion}
            onChange={(e) => setPresentacion(e.target.value)}
            placeholder="Pieza — o paquete, bolsa, millar…"
            list="unidades-conteo"
          />
          <datalist id="unidades-conteo">
            {["paquete", "bolsa", "millar", "caja", "bidón", "litro", "galón", "tapa", "bote", "porrón"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <span className="hint">Es la unidad que se ve al contar en Inventario.</span>
        </Field>
      )}
      <Field label="Se pide por (opcional)">
        <input
          className="text-input"
          value={unidadPedido}
          onChange={(e) => setUnidadPedido(e.target.value)}
          placeholder="Ej. caja, bolsa, kg, pz"
          list="unidades-pedido"
        />
        <datalist id="unidades-pedido">
          <option value="caja" />
          <option value="bolsa" />
          <option value="kg" />
          <option value="pz" />
        </datalist>
      </Field>
      {necesitaEquivalencia && (
        <Field label={`¿Cuánto trae 1 ${unidadPedido.trim()}?`}>
          <div className="equivalencia-row">
            <SumInput value={equivalenciaText} onChange={setEquivalenciaText} placeholder="0" />
            <strong>{unidadConteoLabel}</strong>
          </div>
          <span className="hint">
            Para pasar lo pedido a {unidadConteoLabel} en Pedidos (ej. 4 {pluralizarUnidad(unidadPedido.trim(), 4)} × 10 = 40 {unidadConteoLabel}).
          </span>
        </Field>
      )}
      <Field label={`Precio de referencia (opcional, por ${unidadPedido.trim() || (esPieza ? presentacion.trim() || "pieza" : unidad)})`}>
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
      {area !== "general" && (
        <Toggle
          checked={altaRotacion}
          onChange={setAltaRotacion}
          label="Alta rotación (aparece primero en el conteo diario)"
        />
      )}
      <button className="btn-primary" onClick={save} disabled={!nombre.trim()}>
        Guardar
      </button>
    </Sheet>
  );
}
