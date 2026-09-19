import { useState } from "react";
import { Sheet, Field, NumInput, Toggle } from "../ui";
import { GASTO_CATEGORIAS } from "../../lib/types";
import type { EmpleadoEntry, Gasto, GastoCategoria, GastoEstado, MeseroCatalogEntry } from "../../lib/types";

export interface GastoFormValues {
  concepto: string;
  total: string;
  estado: GastoEstado;
  categoria: GastoCategoria | "";
  empleadoId: string;
  meseroId: string;
}

// Categorías que representan dinero que se le da/gasta a un empleado
// específico — ahí se puede elegir a quién, para que se refleje solo
// como descuento en la nómina de esa persona.
const CATEGORIAS_LIGABLES_A_EMPLEADO = new Set<GastoCategoria>(["nomina", "comida_empleado"]);
// Cancelaciones se le asigna a un mesero del catálogo, para poder
// desglosarlas por nombre en el Dashboard.
const CATEGORIAS_LIGABLES_A_MESERO = new Set<GastoCategoria>(["cancelaciones"]);

export function GastoModal({
  onClose,
  onSave,
  onDelete,
  editing,
  empleados,
  meseros,
}: {
  onClose: () => void;
  onSave: (form: GastoFormValues, editingId?: string) => void;
  onDelete?: () => void;
  editing?: Gasto;
  empleados: EmpleadoEntry[];
  meseros: MeseroCatalogEntry[];
}) {
  const [concepto, setConcepto] = useState(editing?.concepto || "");
  const [total, setTotal] = useState(editing ? String(editing.total) : "");
  const [estado, setEstado] = useState<GastoEstado>(editing?.estado || "pendiente");
  const [categoria, setCategoria] = useState<GastoCategoria | "">(editing?.categoria || "");
  const [empleadoId, setEmpleadoId] = useState(editing?.empleadoId || "");
  const [meseroId, setMeseroId] = useState(editing?.meseroId || "");

  const canMarkIngresado = estado === "ingresado" || !!categoria;
  const ligableAEmpleado = categoria !== "" && CATEGORIAS_LIGABLES_A_EMPLEADO.has(categoria);
  const ligableAMesero = categoria !== "" && CATEGORIAS_LIGABLES_A_MESERO.has(categoria);
  const empleadoElegido = empleados.find((e) => e.id === empleadoId);
  const meseroElegido = meseros.find((m) => m.id === meseroId);

  return (
    <Sheet title={editing ? "Editar gasto" : "Nuevo gasto"} onClose={onClose} onDelete={onDelete}>
      <Field label="Concepto">
        <input className="text-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. compra de servilletas" />
      </Field>
      <Field label="Total">
        <NumInput value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Categoría">
        <select
          className="categoria-select"
          style={{ width: "100%" }}
          value={categoria}
          disabled={estado === "ingresado"}
          onChange={(e) => setCategoria(e.target.value as GastoCategoria | "")}
        >
          <option value="">Sin categoría</option>
          {GASTO_CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      {ligableAEmpleado && (
        <Field label="¿Para quién? (opcional)">
          <select className="categoria-select" style={{ width: "100%" }} value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
            <option value="">Sin asignar</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </Field>
      )}
      {ligableAEmpleado && empleadoElegido && (
        <p className="hint">Se va a reflejar como descuento en la nómina de {empleadoElegido.nombre} esta semana.</p>
      )}
      {ligableAMesero && (
        <Field label="¿A quién se le cancela? (opcional)">
          <select className="categoria-select" style={{ width: "100%" }} value={meseroId} onChange={(e) => setMeseroId(e.target.value)}>
            <option value="">Sin asignar</option>
            {meseros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Field>
      )}
      {ligableAMesero && meseroElegido && (
        <p className="hint">Se va a sumar al desglose de cancelaciones de {meseroElegido.nombre} en el Dashboard.</p>
      )}
      <Toggle
        checked={estado === "ingresado"}
        disabled={!canMarkIngresado}
        onChange={(v) => setEstado(v ? "ingresado" : "pendiente")}
        label="Ya está ingresado"
      />
      {!canMarkIngresado && <p className="hint">Elige una categoría para poder marcarlo como ingresado.</p>}
      <button
        className="btn-primary"
        disabled={!concepto || !total}
        onClick={() => onSave({ concepto, total, estado, categoria, empleadoId, meseroId }, editing?.id)}
      >
        Guardar gasto
      </button>
    </Sheet>
  );
}
