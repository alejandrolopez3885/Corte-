import { useState } from "react";
import { Sheet, Field, SumInput } from "../ui";
import { money, sumFromText, uid } from "../../lib/dataModel";
import type { AreaEntry, EmpleadoEntry, PuestoEntry } from "../../lib/types";

const NUEVO_PUESTO = "__nuevo__";
const NUEVA_AREA = "__nueva__";

export function EmpleadoModal({
  onClose,
  onSave,
  onDelete,
  editing,
  areas,
  puestos,
}: {
  onClose: () => void;
  onSave: (entry: EmpleadoEntry, nuevaArea?: AreaEntry, nuevoPuesto?: PuestoEntry) => void;
  onDelete?: () => void;
  editing?: EmpleadoEntry;
  areas: AreaEntry[];
  puestos: PuestoEntry[];
}) {
  const [nombre, setNombre] = useState(editing?.nombre || "");
  const [sueldoDiarioText, setSueldoDiarioText] = useState(editing?.sueldoDiario ? String(editing.sueldoDiario) : "");
  const [puestoId, setPuestoId] = useState(editing?.puestoId || "");
  const [nuevoPuestoNombre, setNuevoPuestoNombre] = useState("");
  const [nuevoPuestoAreaId, setNuevoPuestoAreaId] = useState("");
  const [nuevaAreaNombre, setNuevaAreaNombre] = useState("");

  const sueldoDiario = sumFromText(sueldoDiarioText);

  const creandoPuestoNuevo = puestoId === NUEVO_PUESTO;
  const creandoAreaNueva = nuevoPuestoAreaId === NUEVA_AREA;
  const puestoNuevoListo = !creandoPuestoNuevo || (nuevoPuestoNombre.trim() && (creandoAreaNueva ? nuevaAreaNombre.trim() : nuevoPuestoAreaId));

  // Si se crea un puesto (y, dentro de eso, un área) nuevos, todo va en el
  // mismo guardado que el empleado — igual que insumo+proveedor, para que
  // sea una sola escritura atómica y no se pierda nada por partir de datos
  // desactualizados en llamadas separadas.
  function save() {
    if (!nombre.trim() || !puestoNuevoListo) return;
    let finalPuestoId = puestoId && puestoId !== NUEVO_PUESTO ? puestoId : undefined;
    let nuevaAreaEntry: AreaEntry | undefined;
    let nuevoPuestoEntry: PuestoEntry | undefined;
    if (creandoPuestoNuevo && nuevoPuestoNombre.trim()) {
      let finalAreaId = nuevoPuestoAreaId && nuevoPuestoAreaId !== NUEVA_AREA ? nuevoPuestoAreaId : undefined;
      if (creandoAreaNueva && nuevaAreaNombre.trim()) {
        nuevaAreaEntry = { id: uid(), nombre: nuevaAreaNombre.trim() };
        finalAreaId = nuevaAreaEntry.id;
      }
      if (finalAreaId) {
        nuevoPuestoEntry = { id: uid(), nombre: nuevoPuestoNombre.trim(), areaId: finalAreaId };
        finalPuestoId = nuevoPuestoEntry.id;
      }
    }
    onSave(
      { id: editing?.id || uid(), nombre: nombre.trim(), sueldoDiario: sueldoDiario || undefined, puestoId: finalPuestoId },
      nuevaAreaEntry,
      nuevoPuestoEntry
    );
    onClose();
  }

  return (
    <Sheet title={editing ? "Editar empleado" : "Nuevo empleado"} onClose={onClose} onDelete={onDelete}>
      <Field label="Nombre">
        <input
          className="text-input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Carlos"
          autoFocus
        />
      </Field>
      <Field label="Puesto (opcional)">
        <select className="text-input" value={puestoId} onChange={(e) => setPuestoId(e.target.value)}>
          <option value="">Sin puesto</option>
          {puestos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {areas.find((a) => a.id === p.areaId)?.nombre}
            </option>
          ))}
          <option value={NUEVO_PUESTO}>+ Nuevo puesto…</option>
        </select>
      </Field>
      {creandoPuestoNuevo && (
        <>
          <Field label="Nombre del nuevo puesto">
            <input
              className="text-input"
              value={nuevoPuestoNombre}
              onChange={(e) => setNuevoPuestoNombre(e.target.value)}
              placeholder="Ej. Runner"
              autoFocus
            />
          </Field>
          <Field label="Área">
            <select className="text-input" value={nuevoPuestoAreaId} onChange={(e) => setNuevoPuestoAreaId(e.target.value)}>
              <option value="">Selecciona un área</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
              <option value={NUEVA_AREA}>+ Nueva área…</option>
            </select>
          </Field>
          {creandoAreaNueva && (
            <Field label="Nombre de la nueva área">
              <input
                className="text-input"
                value={nuevaAreaNombre}
                onChange={(e) => setNuevaAreaNombre(e.target.value)}
                placeholder="Ej. Gerencia"
                autoFocus
              />
            </Field>
          )}
        </>
      )}
      <Field label="Sueldo diario">
        <SumInput value={sueldoDiarioText} onChange={setSueldoDiarioText} placeholder="0.00" />
      </Field>
      <Field label="Sueldo semanal (6 días + descanso, no editable)">
        <div className="readonly-value">{money(sueldoDiario * 7)}</div>
      </Field>
      <p className="hint">
        La nómina de cada semana se calcula sola en Equipo &gt; Nómina, según el horario de cada quien: Z paga doble, O/X pagan
        normal, y el descanso (OFF) solo se paga si se trabajaron los otros 6 días.
      </p>
      <button className="btn-primary" onClick={save} disabled={!nombre.trim() || !puestoNuevoListo}>
        Guardar
      </button>
    </Sheet>
  );
}
