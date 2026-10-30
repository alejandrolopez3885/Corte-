import { useEffect, useState } from "react";
import { CalendarDays, Lock, TrendingDown, TrendingUp, UserRound, Wallet, KeyRound, Clock } from "lucide-react";
import { Sheet, Field, SumInput, Toggle, NumInput } from "../ui";
import { Avatar } from "../Avatar";
import { DatoPagoFila } from "../DatoPagoFila";
import type { DatosPago } from "../../lib/datosPago";
import { addDaysIso, insumoAreaForPuesto, mondayOnOrBefore, money, sueldoEnFecha, sumFromText, todayIso, uid } from "../../lib/dataModel";
import { SUELDO_INICIAL_DESDE, antiguedad, fechaCorta, renglonesHistorial, resumenSueldo } from "../../lib/sueldo";
import { supabase } from "../../lib/supabaseClient";
import { createStaffAccount, errorMessage, revokeStaffAccess, updateStaffPermisos, PIN_LENGTH } from "../../lib/staffAccounts";
import { PERMISOS_DISPONIBLES } from "../../lib/types";
import type { AreaEntry, CambioSueldo, EmpleadoEntry, PermisoStaff, PuestoEntry } from "../../lib/types";

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
  datosPago,
}: {
  onClose: () => void;
  onSave: (entry: EmpleadoEntry, nuevaArea?: AreaEntry, nuevoPuesto?: PuestoEntry) => void;
  onDelete?: () => void;
  editing?: EmpleadoEntry;
  areas: AreaEntry[];
  puestos: PuestoEntry[];
  ownerId: string;
  // A dónde pagarle (lo pone la persona en Mi perfil).
  datosPago?: DatosPago | "sin-datos" | null;
}) {
  // Fijo desde el inicio (no solo al guardar) para poder vincular una
  // cuenta de acceso a este empleado desde el primer "Dar acceso", aunque
  // el empleado en sí todavía no se haya guardado.
  const [empleadoId] = useState(() => editing?.id || uid());
  const [nombre, setNombre] = useState(editing?.nombre || "");
  // La foto la pone cada quien desde Mi perfil; aquí el dueño solo la ve o
  // la quita.
  const [quitarFoto, setQuitarFoto] = useState(false);
  // Empleado nuevo: el sueldo se captura aquí. Ya guardado, queda bloqueado
  // y solo cambia con "Cambiar sueldo", que lo deja en su historial.
  const [sueldoDiarioText, setSueldoDiarioText] = useState("");
  const [historial, setHistorial] = useState<CambioSueldo[]>(() => editing?.historialSueldo || []);
  const [nuevosCambios, setNuevosCambios] = useState<string[]>([]);
  const [cambiandoSueldo, setCambiandoSueldo] = useState(false);
  const [quitandoCambio, setQuitandoCambio] = useState<string | null>(null);
  const [fechaIngreso, setFechaIngreso] = useState(editing?.fechaIngreso || "");
  const [fechaSalida, setFechaSalida] = useState(editing?.fechaSalida || "");
  const [pestana, setPestana] = useState<"datos" | "sueldo" | "acceso">("datos");
  const [puestoId, setPuestoId] = useState(editing?.puestoId || "");
  const [activo, setActivo] = useState(!editing?.inactivo);
  const [comidasGratis, setComidasGratis] = useState(editing?.comidasGratis?.porSemana || 0);
  const [valorComidaText, setValorComidaText] = useState(String(editing?.comidasGratis?.valor || 50));
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

  // Sueldo base sin historial (empleados de antes de esta pantalla).
  const sueldoBase = editing ? editing.sueldoDiario || 0 : sumFromText(sueldoDiarioText);
  const conHistorial = { historialSueldo: historial, sueldoDiario: sueldoBase };
  const sueldoDiario = sueldoEnFecha(conHistorial as EmpleadoEntry);
  const resumen = resumenSueldo(conHistorial as EmpleadoEntry);

  function agregarCambio(c: Omit<CambioSueldo, "id">) {
    const semana = mondayOnOrBefore(c.desde);
    let base = historial;
    // El sueldo que ya tenía queda como el primero del historial.
    if (!base.length && sueldoBase > 0) base = [{ id: uid(), desde: fechaIngreso || SUELDO_INICIAL_DESDE, sueldoDiario: sueldoBase, nota: "Sueldo de entrada" }];
    // Un solo cambio por semana: el nuevo reemplaza al de esa semana.
    const sinEsaSemana = base.filter((x) => x.desde === SUELDO_INICIAL_DESDE || mondayOnOrBefore(x.desde) !== semana);
    const nuevo = { ...c, id: uid() };
    setHistorial([...sinEsaSemana, nuevo]);
    setNuevosCambios((n) => [...n, nuevo.id]);
    setCambiandoSueldo(false);
  }

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
      setAccesoError(errorMessage(e, "No se pudo dar de alta el acceso."));
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
      setAccesoError(errorMessage(e, "No se pudo quitar el acceso."));
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
        setAccesoError(errorMessage(e, "No se pudieron guardar sus permisos."));
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
        sueldoDiario: (editing ? sueldoDiario : sueldoBase) || undefined,
        historialSueldo: editing ? (historial.length ? historial : undefined) : sueldoBase > 0 ? [{ id: uid(), desde: fechaIngreso || todayIso(), sueldoDiario: sueldoBase, nota: "Sueldo de entrada" }] : undefined,
        fechaIngreso: fechaIngreso || undefined,
        fechaSalida: !activo && fechaSalida ? fechaSalida : undefined,
        puestoId: finalPuestoId,
        staffProfileId,
        inactivo: activo ? undefined : true,
        comidasGratis: comidasGratis > 0 ? { porSemana: comidasGratis, valor: sumFromText(valorComidaText) || 50 } : undefined,
        ...(quitarFoto ? { foto: undefined } : {}),
      },
      nuevaAreaEntry,
      nuevoPuestoEntry
    );
    onClose();
  }

  const puestoNombre = puestoActual ? `${puestoActual.nombre}${areaActual ? ` · ${areaActual.nombre}` : ""}` : "Sin puesto";
  const renglones = renglonesHistorial({ historialSueldo: historial });
  const PESTANAS = [
    { id: "datos" as const, label: "Datos", icon: <UserRound size={16} /> },
    { id: "sueldo" as const, label: "Sueldo", icon: <Wallet size={16} /> },
    { id: "acceso" as const, label: "Acceso", icon: <KeyRound size={16} /> },
  ];

  return (
    <Sheet title={editing ? "Empleado" : "Nuevo empleado"} onClose={onClose} onDelete={onDelete}>
      {editing && (
        <div className="emp-perfil-card">
          <Avatar nombre={nombre || editing.nombre} foto={quitarFoto ? undefined : editing.foto} tamano={58} />
          <div className="emp-perfil-info">
            <strong>{nombre || editing.nombre}</strong>
            <span>{puestoNombre}</span>
            <div className="emp-chips">
              <em className={`emp-chip ${activo ? "ok" : "off"}`}>{activo ? "Activo" : "Inactivo"}</em>
              {fechaIngreso && (
                <em className="emp-chip">
                  <Clock size={12} /> {antiguedad(fechaIngreso, !activo && fechaSalida ? fechaSalida : undefined)}
                </em>
              )}
              {sueldoDiario > 0 && <em className="emp-chip">{money(sueldoDiario)} / día</em>}
            </div>
          </div>
        </div>
      )}

      <div className="emp-pestanas" role="tablist">
        {PESTANAS.map((t) => (
          <button key={t.id} type="button" role="tab" className={pestana === t.id ? "activa" : ""} onClick={() => setPestana(t.id)}>
            {t.icon}
            {t.label}
            {t.id === "sueldo" && nuevosCambios.length > 0 && <i className="emp-punto" />}
          </button>
        ))}
      </div>

      {pestana === "datos" && (
        <>
          {editing && (editing.foto || editing.descripcion) && (
            <div className="empleado-perfil">
              <div>
                {editing.descripcion && <p>“{editing.descripcion}”</p>}
                {editing.foto && (
                  <button type="button" className="link-btn" onClick={() => setQuitarFoto(!quitarFoto)}>
                    {quitarFoto ? "No quitar la foto" : "Quitar foto"}
                  </button>
                )}
                <span className="hint">Su foto y descripción las pone desde Mi perfil.</span>
              </div>
            </div>
          )}
          <Field label="Nombre">
            <input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Carlos" autoFocus={!editing} />
          </Field>
          {editing && (
            <div className="empleado-activo">
              <Toggle checked={activo} onChange={setActivo} label={activo ? "Activo" : "Inactivo"} />
              <span className="hint">
                {activo
                  ? "Si ya no trabaja aquí, márcalo como inactivo: se guarda su historial."
                  : "Ya no trabaja aquí: se guarda su historial (horarios, nómina), pero no sale para agregarlo a un horario ni en el horario sugerido."}
              </span>
            </div>
          )}
          <div className="emp-fechas">
            <div className="emp-fechas-titulo">
              <CalendarDays size={16} /> Fechas
            </div>
            <div className={`emp-fechas-grid ${!activo ? "dos" : ""}`}>
              <Field label="Fecha de ingreso">
                <input className="date-input" type="date" value={fechaIngreso} max={todayIso()} onChange={(e) => setFechaIngreso(e.target.value)} />
              </Field>
              {!activo && (
                <Field label="Fecha de salida">
                  <input className="date-input" type="date" value={fechaSalida} min={fechaIngreso || undefined} onChange={(e) => setFechaSalida(e.target.value)} />
                </Field>
              )}
            </div>
            {fechaIngreso && (
              <span className="emp-fechas-total">
                {!activo && fechaSalida ? `Trabajó ${antiguedad(fechaIngreso, fechaSalida)}` : activo ? `Lleva ${antiguedad(fechaIngreso)} trabajando aquí` : `Lleva ${antiguedad(fechaIngreso)} desde que entró`}
              </span>
            )}
          </div>
          {datosPago && (
            <div className="empleado-pago">
              <span className="pregunta-grupo-titulo">Datos de pago</span>
              {datosPago === "sin-datos" ? <p className="dato-pago-falta">Todavía no pone sus datos de pago en Mi perfil.</p> : <DatoPagoFila datos={datosPago} detalle />}
            </div>
          )}
          <div className="empleado-comidas">
            <div className="empleado-comidas-fila">
              <span>Comidas gratis por semana</span>
              <span className="rg-paso">
                <button type="button" onClick={() => setComidasGratis(Math.max(0, comidasGratis - 1))} aria-label="Menos">
                  −
                </button>
                <b>{comidasGratis}</b>
                <button type="button" onClick={() => setComidasGratis(Math.min(7, comidasGratis + 1))} aria-label="Más">
                  +
                </button>
              </span>
            </div>
            {comidasGratis > 0 && (
              <>
                <div className="empleado-comidas-fila">
                  <span>Valor de cada comida gratis</span>
                  <input className="text-input empleado-comidas-valor" inputMode="decimal" value={valorComidaText} onChange={(e) => setValorComidaText(e.target.value)} />
                </div>
                <span className="hint">
                  De sus gastos "Comida empleado" de la semana, primero son gratis las de {money(sumFromText(valorComidaText) || 50)} o menos; si le
                  quedan comidas gratis, a las de más se les quita ese valor y solo se rebaja lo demás. En su nómina las gratis salen en $0.
                </span>
              </>
            )}
          </div>
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
        </>
      )}

      {pestana === "sueldo" && (
        <>
          {!editing ? (
            <>
              <Field label="Sueldo diario">
                <SumInput value={sueldoDiarioText} onChange={setSueldoDiarioText} placeholder="0.00" />
              </Field>
              <Field label="Sueldo semanal (6 días + descanso)">
                <div className="readonly-value">{money(sueldoBase * 7)}</div>
              </Field>
              <p className="hint">Al guardar queda como su sueldo de entrada. Después, los aumentos o reducciones se hacen con "Cambiar sueldo" y se guardan en su historial.</p>
            </>
          ) : (
            <>
              <div className="emp-sueldo-hero">
                <div className="emp-sueldo-hero-top">
                  <span>Sueldo actual</span>
                  <Lock size={15} />
                </div>
                <div className="emp-sueldo-montos">
                  <div>
                    <b>{money(sueldoDiario)}</b>
                    <small>por día</small>
                  </div>
                  <div>
                    <b>{money(sueldoDiario * 7)}</b>
                    <small>por semana · 6 días + descanso</small>
                  </div>
                </div>
                {resumen.proximo && (
                  <div className={`emp-sueldo-proximo ${resumen.proximo.diferencia >= 0 ? "sube" : "baja"}`}>
                    Desde la semana del {fechaCorta(mondayOnOrBefore(resumen.proximo.desde))}: {money(resumen.proximo.sueldoDiario)} / día ({resumen.proximo.diferencia >= 0 ? "+" : "−"}
                    {money(Math.abs(resumen.proximo.diferencia))})
                  </div>
                )}
              </div>
              {historial.length > 1 && (
                <div className="emp-sueldo-stats">
                  <div>
                    <small>Desde que entró</small>
                    <b className={resumen.cambioTotal > 0 ? "sube" : resumen.cambioTotal < 0 ? "baja" : ""}>
                      {resumen.cambioTotal === 0 ? "Igual" : `${resumen.cambioTotal > 0 ? "+" : "−"}${money(Math.abs(resumen.cambioTotal))}`}
                    </b>
                    {resumen.inicial > 0 && resumen.cambioTotal !== 0 && <small>{Math.round((resumen.cambioTotal / resumen.inicial) * 100)}% por día</small>}
                  </div>
                  <div>
                    <small>Último cambio</small>
                    <b>{resumen.ultimo ? fechaCorta(resumen.ultimo.desde) : "—"}</b>
                    {resumen.ultimo && <small>hace {antiguedad(resumen.ultimo.desde)}</small>}
                  </div>
                  <div>
                    <small>Cambios</small>
                    <b>{resumen.cambios}</b>
                    <small>{resumen.cambios === 1 ? "registrado" : "registrados"}</small>
                  </div>
                </div>
              )}
              <button type="button" className="emp-btn-cambiar" onClick={() => setCambiandoSueldo(true)}>
                <TrendingUp size={17} /> Cambiar sueldo · aumento o reducción
              </button>

              <div className="emp-historial">
                <span className="emp-historial-titulo">Historial de sueldo</span>
                {renglones.length === 0 ? (
                  <p className="hint">
                    {sueldoBase > 0
                      ? `Gana ${money(sueldoBase)} por día desde antes del historial. El primer cambio que hagas lo deja como su sueldo de entrada.`
                      : "Todavía no tiene sueldo. Ponlo con Cambiar sueldo."}
                  </p>
                ) : (
                  <ol className="emp-linea">
                    {renglones.map((r) => {
                      const tipo = r.anterior === null ? "inicio" : r.diferencia >= 0 ? "sube" : "baja";
                      return (
                        <li key={r.id} className={`emp-linea-item ${tipo} ${r.futuro ? "futuro" : ""}`}>
                          <span className="emp-linea-icono">{tipo === "baja" ? <TrendingDown size={14} /> : tipo === "sube" ? <TrendingUp size={14} /> : <Wallet size={14} />}</span>
                          <div className="emp-linea-card">
                            <div className="emp-linea-fila">
                              <b>{r.anterior === null ? `${money(r.sueldoDiario)} / día` : `${money(r.anterior)} → ${money(r.sueldoDiario)}`}</b>
                              {r.anterior !== null && (
                                <em className={`emp-dif ${tipo}`}>
                                  {r.diferencia >= 0 ? "+" : "−"}
                                  {money(Math.abs(r.diferencia))}
                                </em>
                              )}
                            </div>
                            <div className="emp-linea-sub">
                              {r.desde === SUELDO_INICIAL_DESDE ? "Desde que entró" : `Desde la semana del ${fechaCorta(mondayOnOrBefore(r.desde))}`} · {money(r.sueldoDiario * 7)} / semana
                            </div>
                            {r.nota && <div className="emp-linea-nota">{r.nota}</div>}
                            <div className="emp-linea-tags">
                              {r.vigente && <em className="emp-chip ok">Vigente</em>}
                              {r.futuro && <em className="emp-chip prox">Programado</em>}
                              {nuevosCambios.includes(r.id) && <em className="emp-chip warn">Sin guardar</em>}
                              {historial.length > 1 &&
                                (quitandoCambio === r.id ? (
                                  <span className="emp-quitar-confirma">
                                    ¿Quitarlo?
                                    <button type="button" className="link-btn" onClick={() => { setHistorial(historial.filter((x) => x.id !== r.id)); setQuitandoCambio(null); }}>
                                      Sí, quitar
                                    </button>
                                    <button type="button" className="link-btn" onClick={() => setQuitandoCambio(null)}>
                                      No
                                    </button>
                                  </span>
                                ) : (
                                  <button type="button" className="link-btn emp-quitar" onClick={() => setQuitandoCambio(r.id)}>
                                    Quitar
                                  </button>
                                ))}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
              {nuevosCambios.length > 0 && <p className="emp-aviso-guardar">Toca Guardar para que el cambio de sueldo quede registrado.</p>}
            </>
          )}
          <p className="hint">
            Cada semana de nómina usa el sueldo que tenía vigente esa semana: un aumento no cambia las nóminas pasadas. Z paga doble, O/X pagan
            normal, y el descanso (OFF) solo se paga si se trabajaron los otros 6 días.
          </p>
        </>
      )}

      {pestana === "acceso" && (
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
              <PermisosChecklist permisos={permisos} onToggle={togglePermiso} areaActual={areaActual} puestoActual={puestoActual} />
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
                <PermisosChecklist permisos={permisos} onToggle={togglePermiso} areaActual={areaActual} puestoActual={puestoActual} />
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
      )}

      <button className="btn-primary" onClick={save} disabled={!nombre.trim() || !puestoNuevoListo}>
        Guardar
      </button>

      {cambiandoSueldo && (
        <CambiarSueldo
          nombre={nombre.trim() || "empleado"}
          historial={conHistorial as EmpleadoEntry}
          onClose={() => setCambiandoSueldo(false)}
          onAgregar={agregarCambio}
        />
      )}

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

// "Cambiar sueldo": el nuevo sueldo por día o por semana (÷ 7), desde qué
// semana cuenta y por qué. Se compara contra el sueldo vigente esa semana.
function CambiarSueldo({
  nombre,
  historial,
  onClose,
  onAgregar,
}: {
  nombre: string;
  historial: EmpleadoEntry;
  onClose: () => void;
  onAgregar: (c: Omit<CambioSueldo, "id">) => void;
}) {
  const [modo, setModo] = useState<"dia" | "semana">("dia");
  const [montoText, setMontoText] = useState("");
  const [desde, setDesde] = useState(() => mondayOnOrBefore(todayIso()));
  const [nota, setNota] = useState("");
  const actual = sueldoEnFecha(historial);
  const enEsaSemana = desde ? sueldoEnFecha(historial, desde) : actual;
  const monto = sumFromText(montoText);
  const nuevoDiario = Math.round((modo === "dia" ? monto : monto / 7) * 100) / 100;
  const dif = Math.round((nuevoDiario - enEsaSemana) * 100) / 100;
  const lunes = desde ? mondayOnOrBefore(desde) : "";
  const reemplaza = (historial.historialSueldo || []).some((c) => c.desde !== SUELDO_INICIAL_DESDE && mondayOnOrBefore(c.desde) === lunes);
  const listo = nuevoDiario > 0 && !!desde && (dif !== 0 || reemplaza);
  return (
    <Sheet title={`Cambiar sueldo · ${nombre}`} onClose={onClose}>
      <div className="emp-cs-actual">
        <span>Sueldo actual</span>
        <b>
          {money(actual)} / día · {money(actual * 7)} / semana
        </b>
      </div>
      <div className="emp-cs-modo">
        <button type="button" className={modo === "dia" ? "activo" : ""} onClick={() => setModo("dia")}>
          Por día
        </button>
        <button type="button" className={modo === "semana" ? "activo" : ""} onClick={() => setModo("semana")}>
          Por semana
        </button>
      </div>
      <Field label={modo === "dia" ? "Nuevo sueldo por día" : "Nuevo sueldo por semana"}>
        <NumInput value={montoText} onChange={(e) => setMontoText(e.target.value)} placeholder="0.00" autoFocus />
      </Field>
      {nuevoDiario > 0 && (
        <div className={`emp-cs-resultado ${dif > 0 ? "sube" : dif < 0 ? "baja" : ""}`}>
          <div>
            <span>{modo === "dia" ? "Queda por semana" : "Queda por día"}</span>
            <b>{modo === "dia" ? money(nuevoDiario * 7) : money(nuevoDiario)}</b>
          </div>
          <div className="emp-cs-dif">
            {dif === 0 ? (
              <span>Es el mismo sueldo que tiene esa semana</span>
            ) : (
              <>
                <span>
                  {dif > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />} {dif > 0 ? "Aumento" : "Reducción"}
                </span>
                <span>
                  {dif > 0 ? "+" : "−"}
                  {money(Math.abs(dif))} / día · {dif > 0 ? "+" : "−"}
                  {money(Math.abs(dif * 7))} / semana
                </span>
              </>
            )}
          </div>
        </div>
      )}
      <Field label="¿Desde cuándo?">
        <input className="date-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
      </Field>
      {desde && (
        <p className="hint">
          Cuenta desde la semana del lunes {fechaCorta(lunes)}. Las semanas anteriores se quedan con {money(sueldoEnFecha(historial, addDaysIso(lunes, -7)))} por día.
          {reemplaza && " Ya hay un cambio en esa semana: este lo reemplaza."}
        </p>
      )}
      <Field label="Motivo (opcional)">
        <input className="text-input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Aumento por desempeño" />
      </Field>
      <button className="btn-primary" disabled={!listo} onClick={() => onAgregar({ desde, sueldoDiario: nuevoDiario, nota: nota.trim() || undefined })}>
        Agregar al historial
      </button>
    </Sheet>
  );
}

function PermisosChecklist({
  permisos,
  onToggle,
  areaActual,
  puestoActual,
}: {
  permisos: PermisoStaff[];
  onToggle: (p: PermisoStaff) => void;
  areaActual?: AreaEntry;
  puestoActual?: PuestoEntry;
}) {
  // "Conteo diario" se acota por el catálogo de insumos (Bar/Cocina), que
  // se resuelve por el nombre del puesto (ej. "Barra"), no por el área de
  // Personal del puesto (que puede ser "Piso") — son dos clasificaciones
  // distintas. "Horarios" sí se acota directo por esa área de Personal.
  const insumoArea = puestoActual ? insumoAreaForPuesto(puestoActual.nombre) : null;
  const insumoAreaLabel = insumoArea === "bar" ? "Bar" : insumoArea === "cocina" ? "Cocina" : undefined;

  return (
    <div className="permisos-checklist">
      <span className="permisos-checklist-label">Qué puede ver/usar</span>
      {!areaActual && (
        <p className="hint">Asígnale un puesto con área arriba para poder habilitar permisos por área, como Horarios.</p>
      )}
      {PERMISOS_DISPONIBLES.map((p) => {
        const esConteoDiario = p.value === "conteo_diario";
        // Nómina es individual (cada quien ve solo la suya), no por área —
        // así que a diferencia de Horarios no se le pone sufijo de área,
        // aunque sí requiere tener un puesto asignado (de ahí sale su
        // sueldo diario).
        const esNomina = p.value === "nomina";
        // Inventario es una sola nota con todo (Cocina, Bar y General), así
        // que tampoco lleva área — basta con que tenga puesto.
        const esInventario = p.value === "inventario";
        // Propinas es la misma consulta para todos (totales del día de toda
        // la semana), tampoco lleva área.
        const esPropinas = p.value === "propinas";
        // Pedidos junta los de todos los proveedores: tampoco lleva área.
        const esPedidos = p.value === "pedidos";
        // Recetario es la misma consulta para cualquier puesto o área, y ni
        // siquiera necesita puesto asignado.
        const esRecetario = p.value === "recetario";
        const habilitado = esRecetario ? true : esConteoDiario ? !!insumoAreaLabel : !!areaActual;
        const etiquetaArea =
          esConteoDiario ? insumoAreaLabel : esNomina || esInventario || esPropinas || esPedidos || esRecetario ? undefined : areaActual?.nombre;
        return (
          <Toggle
            key={p.value}
            checked={permisos.includes(p.value)}
            onChange={() => onToggle(p.value)}
            label={etiquetaArea ? `${p.label} de ${etiquetaArea}` : p.label}
            disabled={!habilitado}
          />
        );
      })}
      {areaActual && !insumoAreaLabel && (
        <p className="hint">Conteo diario solo aplica a puestos de Barra o Cocina — el puesto actual no es ninguno de esos.</p>
      )}
    </div>
  );
}
