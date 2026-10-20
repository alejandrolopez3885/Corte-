import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Sheet, Field, NumInput, Toggle } from "../ui";
import { ConceptoInput } from "../ConceptoInput";
import { GASTO_CATEGORIAS } from "../../lib/types";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
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
  historial,
}: {
  onClose: () => void;
  onSave: (form: GastoFormValues, editingId?: string) => void;
  onDelete?: () => void;
  editing?: Gasto;
  empleados: EmpleadoEntry[];
  meseros: MeseroCatalogEntry[];
  historial: NombreHistorial[];
}) {
  return (
    <Sheet title={editing ? "Editar gasto" : "Nuevo gasto"} onClose={onClose} onDelete={onDelete}>
      <GastoForm
        onSave={(form) => onSave(form, editing?.id)}
        editing={editing}
        empleados={empleados}
        meseros={meseros}
        historial={historial}
      />
    </Sheet>
  );
}

// Los campos de un gasto, igual en Corte que al agregarlo desde la
// búsqueda de Control de gastos en efectivo.
export function GastoForm({
  onSave,
  onCancel,
  editing,
  conceptoInicial,
  empleados,
  meseros,
  historial,
  saveLabel = "Guardar gasto",
  bloqueado = false,
}: {
  onSave: (form: GastoFormValues) => void;
  onCancel?: () => void;
  editing?: Gasto;
  conceptoInicial?: string;
  empleados: EmpleadoEntry[];
  meseros: MeseroCatalogEntry[];
  historial: NombreHistorial[];
  saveLabel?: string;
  // Para que quien lo usa pueda pedir algo más antes de guardar (ej. el día).
  bloqueado?: boolean;
}) {
  const [concepto, setConcepto] = useState(editing?.concepto || conceptoInicial || "");
  const [total, setTotal] = useState(editing ? String(editing.total) : "");
  const [estado, setEstado] = useState<GastoEstado>(editing?.estado || "pendiente");
  const [categoria, setCategoria] = useState<GastoCategoria | "">(editing?.categoria || "");
  const [empleadoId, setEmpleadoId] = useState(editing?.empleadoId || "");
  const [meseroId, setMeseroId] = useState(editing?.meseroId || "");
  // La categoría es obligatoria: el aviso sale al intentar guardar sin ella.
  const [faltaCategoria, setFaltaCategoria] = useState(false);

  const canMarkIngresado = estado === "ingresado" || !!categoria;
  const ligableAEmpleado = categoria !== "" && CATEGORIAS_LIGABLES_A_EMPLEADO.has(categoria);
  const ligableAMesero = categoria !== "" && CATEGORIAS_LIGABLES_A_MESERO.has(categoria);
  const empleadoElegido = empleados.find((e) => e.id === empleadoId);
  const meseroElegido = meseros.find((m) => m.id === meseroId);

  return (
    <>
      <Field label="Concepto">
        <ConceptoInput value={concepto} onChange={setConcepto} historial={historial} placeholder="Ej. compra de servilletas" />
      </Field>
      <Field label="Total">
        <NumInput value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Categoría">
        <select
          className={`categoria-select ${faltaCategoria && !categoria ? "campo-faltante" : ""}`}
          style={{ width: "100%" }}
          value={categoria}
          disabled={estado === "ingresado"}
          onChange={(e) => setCategoria(e.target.value as GastoCategoria | "")}
        >
          <option value="">Selecciona una categoría</option>
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
      {categoria === "servicio" && <p className="hint">Se va a restar de los Gastos fijos en transferencia de esta semana.</p>}
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
      {faltaCategoria && !categoria && (
        <p className="aviso-faltante">
          <TriangleAlert size={15} /> Es importante seleccionar la categoría.
        </p>
      )}
      <div className="gasto-form-actions">
        {onCancel && (
          <button type="button" className="link-btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          className="btn-primary"
          disabled={bloqueado || !concepto.trim() || !total}
          onClick={() => {
            if (!categoria) {
              setFaltaCategoria(true);
              return;
            }
            onSave({ concepto: concepto.trim(), total, estado, categoria, empleadoId, meseroId });
          }}
        >
          {saveLabel}
        </button>
      </div>
    </>
  );
}
