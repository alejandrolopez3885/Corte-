import { useEffect, useState } from "react";
import { Sheet, Field, SumInput, Toggle, NumInput } from "../ui";
import { money, sumFromText, uid } from "../../lib/dataModel";
import { supabase } from "../../lib/supabaseClient";
import { createStaffAccount, revokeStaffAccess, updateStaffPermisos, PIN_LENGTH } from "../../lib/staffAccounts";
import { PERMISOS_DISPONIBLES } from "../../lib/types";
import type { AreaEntry, EmpleadoEntry, PermisoStaff, PuestoEntry } from "../../lib/types";

const NUEVO_PUESTO = "__nuevo__";
const NUEVA_AREA = "__nueva__";

export function EmpleadoModal({
  onClose,
  onSave,
  onDelete,
  editing,
  areas,
  puestos,
  ownerId,
}: {
  onClose: () => void;
  onSave: (entry: EmpleadoEntry, nuevaArea?: AreaEntry, nuevoPuesto?: PuestoEntry) => void;
  onDelete?: () => void;
  editing?: EmpleadoEntry;
  areas: AreaEntry[];
  puestos: PuestoEntry[];
  ownerId: string;
}) {
  // Fijo desde el inicio (no solo al guardar) para poder vincular una
  // cuenta de acceso a este empleado desde el primer "Dar acceso", aunque
  // el empleado en sí todavía no se haya guardado.
  const [empleadoId] = useState(() => editing?.id || uid());
  const [nombre, setNombre] = useState(editing?.nombre || "");
  const [sueldoDiarioText, setSueldoDiarioText] = useState(editing?.sueldoDiario ? String(editing.sueldoDiario) : "");
  const [puestoId, setPuestoId] = useState(editing?.puestoId || "");
  const [nuevoPuestoNombre, setNuevoPuestoNombre] = useState("");
  const [nuevoPuestoAreaId, setNuevoPuestoAreaId] = useState("");
  const [nuevaAreaNombre, setNuevaAreaNombre] = useState("");

  // Acceso a la app (PIN + permisos) — separado del resto porque implica
  // llamadas reales a Supabase (crear/quitar una cuenta), no solo estado
  // local que se guarda junto con el empleado.
  const [staffProfileId, setStaffProfileId] = useState(editing?.staffProfileId);
  const [permisos, setPermisos] = useState<PermisoStaff[]>([]);
  const [permisosCargados, setPermisosCargados] = useState(!staffProfileId);
  const [mostrarFormAcceso, setMostrarFormAcceso] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [accesoRecienCreado, setAccesoRecienCreado] = useState(false);
  const [accesoError, setAccesoError] = useState<string | null>(null);
  const [accesoBusy, setAccesoBusy] = useState(false);
  const [pidiendoQuitarAcceso, setPidiendoQuitarAcceso] = useState(false);

  useEffect(() => {
    if (!staffProfileId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("permisos")
      .eq("id", staffProfileId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPermisos((data?.permisos as PermisoStaff[]) || []);
        setPermisosCargados(true);
      });
    return () => {
      cancelled = true;
    };
  }, [staffProfileId]);

  const sueldoDiario = sumFromText(sueldoDiarioText);

  const creandoPuestoNuevo = puestoId === NUEVO_PUESTO;
  const creandoAreaNueva = nuevoPuestoAreaId === NUEVA_AREA;
  const puestoNuevoListo = !creandoPuestoNuevo || (nuevoPuestoNombre.trim() && (creandoAreaNueva ? nuevaAreaNombre.trim() : nuevoPuestoAreaId));

  const puestoActual = puestos.find((p) => p.id === puestoId);
  const areaActual = puestoActual ? areas.find((a) => a.id === puestoActual.areaId) : undefined;

  function togglePermiso(p: PermisoStaff) {
    setPermisos((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function darAcceso() {
    setAccesoError(null);
    if (pin !== pin2) {
      setAccesoError("Los dos PIN no coinciden.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setAccesoError(`El PIN debe ser de ${PIN_LENGTH} dígitos numéricos.`);
      return;
    }
    if (!nombre.trim()) {
      setAccesoError("Captura primero el nombre.");
      return;
    }
    setAccesoBusy(true);
    try {
      const { id } = await createStaffAccount({ displayName: nombre.trim(), pin, ownerId, empleadoId, permisos });
      setStaffProfileId(id);
      setPermisosCargados(true);
      setAccesoRecienCreado(true);
      setPin("");
      setPin2("");
    } catch (e) {
      setAccesoError(e instanceof Error ? e.message : "No se pudo dar de alta el acceso.");
    } finally {
      setAccesoBusy(false);
    }
  }

  async function quitarAcceso() {
    if (!staffProfileId) return;
    setAccesoBusy(true);
    setAccesoError(null);
    try {
      await revokeStaffAccess(staffProfileId);
      setStaffProfileId(undefined);
      setPermisos([]);
      setAccesoRecienCreado(false);
      setPidiendoQuitarAcceso(false);
    } catch (e) {
      setAccesoError(e instanceof Error ? e.message : "No se pudo quitar el acceso.");
    } finally {
      setAccesoBusy(false);
    }
  }

  // Si se crea un puesto (y, dentro de eso, un área) nuevos, todo va en el
  // mismo guardado que el empleado — igual que insumo+proveedor, para que
  // sea una sola escritura atómica y no se pierda nada por partir de datos
  // desactualizados en llamadas separadas.
  async function save() {
    if (!nombre.trim() || !puestoNuevoListo) return;
    if (staffProfileId) {
      setAccesoError(null);
      try {
        await updateStaffPermisos(staffProfileId, permisos);
      } catch (e) {
        setAccesoError(e instanceof Error ? e.message : "No se pudieron guardar sus permisos.");
        return;
      }
    }
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
      {
        id: empleadoId,
        nombre: nombre.trim(),
        sueldoDiario: sueldoDiario || undefined,
        puestoId: finalPuestoId,
        staffProfileId,
      },
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

      <div className="acceso-app-block">
        <h3 className="acceso-app-title">Acceso a la app</h3>
        {accesoError && <div className="auth-error">{accesoError}</div>}

        {!staffProfileId && !mostrarFormAcceso && (
          <>
            <p className="hint">Esta persona todavía no tiene acceso a la app.</p>
            <button className="link-btn" onClick={() => setMostrarFormAcceso(true)}>
              + Dar acceso con PIN
            </button>
          </>
        )}

        {!staffProfileId && mostrarFormAcceso && (
          <>
            <p className="hint">
              Crea un PIN de {PIN_LENGTH} dígitos para que entre desde "Soy del equipo, tengo un PIN" en la pantalla de
              inicio — no necesita correo. Marca abajo qué puede ver una vez adentro.
            </p>
            <Field label={`PIN de ${PIN_LENGTH} dígitos`}>
              <NumInput
                value={pin}
                maxLength={PIN_LENGTH}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
                placeholder="0000"
              />
            </Field>
            <Field label="Confirma el PIN">
              <NumInput
                value={pin2}
                maxLength={PIN_LENGTH}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
                placeholder="0000"
              />
            </Field>
            <PermisosChecklist permisos={permisos} onToggle={togglePermiso} areaActual={areaActual} />
            <button
              className="btn-primary"
              onClick={darAcceso}
              disabled={accesoBusy || pin.length !== PIN_LENGTH || pin2.length !== PIN_LENGTH}
            >
              {accesoBusy ? "Creando…" : "Crear acceso"}
            </button>
            <button className="link-btn" onClick={() => setMostrarFormAcceso(false)}>
              Cancelar
            </button>
          </>
        )}

        {staffProfileId && (
          <>
            {accesoRecienCreado && (
              <p className="hint">Acceso creado — dile a {nombre.trim() || "esta persona"} que ya puede entrar con su PIN.</p>
            )}
            {!permisosCargados ? (
              <p className="hint">Cargando sus permisos…</p>
            ) : (
              <PermisosChecklist permisos={permisos} onToggle={togglePermiso} areaActual={areaActual} />
            )}
            <p className="hint">
              El PIN no se puede cambiar desde aquí — si lo necesita, quita el acceso y créalo de nuevo con un PIN
              distinto.
            </p>
            <button className="link-btn" onClick={() => setPidiendoQuitarAcceso(true)}>
              Quitar acceso
            </button>
          </>
        )}
      </div>

      <button className="btn-primary" onClick={save} disabled={!nombre.trim() || !puestoNuevoListo}>
        Guardar
      </button>

      {pidiendoQuitarAcceso && (
        <Sheet title="Quitar acceso" onClose={() => setPidiendoQuitarAcceso(false)}>
          <p className="hint">
            {nombre.trim() || "Esta persona"} ya no va a poder entrar a la app con su PIN. Puedes volver a darle acceso
            después, pero con un PIN nuevo.
          </p>
          <button className="btn-warn" onClick={quitarAcceso} disabled={accesoBusy}>
            {accesoBusy ? "Quitando…" : "Sí, quitar acceso"}
          </button>
          <button className="link-btn" onClick={() => setPidiendoQuitarAcceso(false)}>
            Cancelar
          </button>
        </Sheet>
      )}
    </Sheet>
  );
}

function PermisosChecklist({
  permisos,
  onToggle,
  areaActual,
}: {
  permisos: PermisoStaff[];
  onToggle: (p: PermisoStaff) => void;
  areaActual?: AreaEntry;
}) {
  return (
    <div className="permisos-checklist">
      <span className="permisos-checklist-label">Qué puede ver/usar</span>
      {!areaActual && (
        <p className="hint">Asígnale un puesto con área arriba para poder habilitar permisos por área, como Horarios.</p>
      )}
      {PERMISOS_DISPONIBLES.map((p) => (
        <Toggle
          key={p.value}
          checked={permisos.includes(p.value)}
          onChange={() => onToggle(p.value)}
          label={areaActual ? `${p.label} de ${areaActual.nombre}` : p.label}
          disabled={!areaActual}
        />
      ))}
    </div>
  );
}
