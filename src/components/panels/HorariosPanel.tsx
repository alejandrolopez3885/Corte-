import { useEffect, useMemo, useState } from "react";
import { miles, pronosticoSemana } from "../../lib/pronostico";
import { PronosticoDetalle } from "../PronosticoDetalle";
import { Check, Clock, Copy, Trash2, TriangleAlert } from "lucide-react";
import { Empty, Field, Sheet } from "../ui";
import { cielo, useClima } from "../../lib/clima";
import { addDaysIso, dateForDay, findPreviousHorarioSemana, formatDayNumber, money, todayIso, formatWeekRange, isoWeekNumber, normalizeHorarioSemana, resolveWeekStartDate } from "../../lib/dataModel";
import { etiquetasDelDia } from "../../lib/etiquetas";
import { EtiquetasDiaSheet, type ValorEtiquetas } from "../EtiquetasDia";
import { copyHorarioImage } from "../../lib/horarioImage";
import { DAYS, DAY_SHORT, HORARIO_AREAS_FIJAS, HORARIO_CHIPS } from "../../lib/types";
import type { DayName, EmpleadoEntry, HorarioArea, HorarioMonthData, HorarioSemana, MonthData } from "../../lib/types";
import { TituloPagina } from "../BarraTitulo";

type CellTarget = { areaId: string; empleadoId: string; nombre: string; day: DayName };

export function HorariosPanel({
  onBack,
  backLabel = "Equipo",
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  empleados,
  horarios,
  onSaveSemana,
  soloAreaId,
  readOnly,
  onSaveEtiquetas,
  verPronostico = false,
}: {
  onBack?: () => void;
  backLabel?: string;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  empleados: EmpleadoEntry[];
  horarios: Record<string, HorarioMonthData>;
  onSaveSemana: (monthKey: string, weekIndex: number, semana: HorarioSemana) => void;
  // Solo para cuentas de equipo con el permiso "Horarios" — limita la
  // pantalla a un área nada más (la suya) y esconde el control de día
  // festivo, que es una decisión de toda la semana, no solo de su área.
  soloAreaId?: string;
  // Solo el dueño y el jefe de cocina pueden capturar/editar y descargar
  // la imagen — el resto de las cuentas de equipo con este permiso solo
  // pueden ver el horario ya guardado de su área.
  readOnly?: boolean;
  // Etiquetas del día (música, partido, ...): se guardan en el día del corte.
  onSaveEtiquetas?: (monthKey: string, weekIndex: number, day: DayName, v: ValorEtiquetas | undefined) => void;
  // Venta esperada de cada día: el dueño y quien puede editar horarios.
  verPronostico?: boolean;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [etiquetando, setEtiquetando] = useState<DayName | null>(null);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  // Clima de la semana que se ve (hook antes de cualquier return).
  const inicioSemana = months[monthKey] ? resolveWeekStartDate(monthKey, weekIndex, months[monthKey]) : null;
  const climaSemana = useClima(inicioSemana, inicioSemana ? addDaysIso(inicioSemana, 6) : null);
  // Venta esperada de cada día (dueño y quien edita horarios, ej. jefe de cocina).
  const pronosticos = useMemo(
    () => (verPronostico && months[monthKey] ? pronosticoSemana(months, monthKey, weekIndex, todayIso()) : []),
    [verPronostico, months, monthKey, weekIndex]
  );
  // Resultado del último "Copiar imagen" (por botón: id del área o
  // "todas") — se borra solo a los pocos segundos.
  const [copia, setCopia] = useState<{ clave: string; copiada: boolean } | null>(null);

  const month = months[monthKey];

  if (!month) {
    return (
      <div className="page-section">
        <TituloPagina titulo="Horarios" onBack={onBack} backLabel={backLabel} />
        <Empty icon={<Clock size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder armar horarios." />
      </div>
    );
  }

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const clima = climaSemana;
  const puedeEtiquetar = !!onSaveEtiquetas && !soloAreaId && !readOnly;
  const semanaEsperada = pronosticos.reduce((t, x) => t + (x.pronostico?.esperado || 0), 0);
  const saved = horarios[monthKey]?.weeks?.[weekIndex] ?? null;
  const seeded = !saved ? findPreviousHorarioSemana(horarios, monthKeys, monthKey, weekIndex) : null;
  const semanaInicial: HorarioSemana = normalizeHorarioSemana(saved ?? seeded);
  // Un festivo es de esa semana en concreto — no se debe precargar del
  // personal de la semana anterior aunque esa sí haya tenido uno.
  if (!saved) semanaInicial.festivos = [];
  const isDraftBase = !saved && !!seeded;

  // clave: id del área copiada, o "todas" para la imagen con las 2 áreas.
  async function copiarImagen(semana: HorarioSemana, clave: string, soloArea?: string) {
    const copiada = await copyHorarioImage(
      semana,
      `Horario · ${month.label} · Semana ${isoWeekNumber(weekStartDate)}`,
      formatWeekRange(weekStartDate),
      soloArea
    );
    setCopia({ clave, copiada });
    setTimeout(() => setCopia(null), copiada ? 3000 : 6000);
  }

  return (
    <div className="page-section">
      <TituloPagina titulo="Horarios" onBack={onBack} backLabel={backLabel} />
      <p className="hint">Por área, con el nombre, el día y la hora de entrada — igual que llevabas el control antes.</p>

      <div className="field-row">
        <Field label="Mes">
          <select
            className="text-input"
            value={monthKey}
            onChange={(e) => {
              setMonthKey(e.target.value);
              setWeekIndex(0);
            }}
          >
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select className="text-input" value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {i + 1}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

      {saved && !readOnly && (
        <div className="field-row horario-descargas">
          {HORARIO_AREAS_FIJAS.filter(
            (a) => (!soloAreaId || a.id === soloAreaId) && (saved.areas.find((sa) => sa.id === a.id)?.filas.length ?? 0) > 0
          ).map((a) => (
            <button key={a.id} className="link-btn" onClick={() => copiarImagen(saved, a.id, a.id)}>
              {copia?.clave === a.id && copia.copiada ? (
                <>
                  <Check size={15} /> ¡Copiada! Pégala en WhatsApp
                </>
              ) : (
                <>
                  <Copy size={15} /> Copiar imagen · {a.nombre}
                </>
              )}
            </button>
          ))}
          {!soloAreaId && saved.areas.filter((a) => a.filas.length > 0).length > 1 && (
            <button className="link-btn" onClick={() => copiarImagen(saved, "todas")}>
              {copia?.clave === "todas" && copia.copiada ? (
                <>
                  <Check size={15} /> ¡Copiada! Pégala en WhatsApp
                </>
              ) : (
                <>
                  <Copy size={15} /> Copiar imagen · Las 2 áreas
                </>
              )}
            </button>
          )}
        </div>
      )}
      {saved && !readOnly && copia && !copia.copiada && (
        <p className="hint">Tu navegador no permite copiar imágenes — se descargó el PNG.</p>
      )}

      {(puedeEtiquetar || verPronostico) && (
        <>
          <p className="hint">
            {puedeEtiquetar
              ? `Toca un día para ponerle etiquetas (música, partido…)${verPronostico ? " y ver de dónde sale su venta esperada" : ""}. 💰 = quincena.`
              : "Venta esperada de cada día: tócalo para ver de dónde sale."}
          </p>
          <div className="horario-etq">
            {DAYS.map((d) => {
              const fecha = dateForDay(monthKey, weekIndex, month, d);
              const lista = etiquetasDelDia(month.weeks[weekIndex]?.days[d], fecha);
              const c = clima(fecha);
              const p = pronosticos.find((x) => x.dia === d)?.pronostico;
              return (
                <button key={d} type="button" className={month.weeks[weekIndex]?.days[d]?.etiquetas ? "con" : ""} onClick={() => setEtiquetando(d)}>
                  {DAY_SHORT[d]}
                  <span>{lista.map((e) => e.icono).join("") || (puedeEtiquetar ? "＋" : "")}</span>
                  {c && (
                    <em title={cielo(c.codigo).texto}>
                      {cielo(c.codigo).icono} {c.max}°
                    </em>
                  )}
                  {verPronostico && p && <b className="pron">~{miles(p.esperado)}</b>}
                </button>
              );
            })}
          </div>
          {verPronostico && semanaEsperada > 0 && (
            <p className="horario-pron-titulo">
              Venta esperada de la semana: <b>{money(semanaEsperada)}</b>
            </p>
          )}
        </>
      )}
      {etiquetando && (() => {
        const fecha = dateForDay(monthKey, weekIndex, month, etiquetando);
        const fila = pronosticos.find((x) => x.dia === etiquetando);
        const detalle = verPronostico && fila?.pronostico ? <PronosticoDetalle p={fila.pronostico} real={fila.real || undefined} /> : null;
        const titulo = `${etiquetando} ${formatDayNumber(fecha)}`;
        return puedeEtiquetar && onSaveEtiquetas ? (
          <EtiquetasDiaSheet
            titulo={`Etiquetas · ${titulo}`}
            fechaIso={fecha}
            inicial={month.weeks[weekIndex]?.days[etiquetando]?.etiquetas}
            arriba={detalle}
            onGuardar={(v) => {
              onSaveEtiquetas(monthKey, weekIndex, etiquetando, v);
              setEtiquetando(null);
            }}
            onClose={() => setEtiquetando(null)}
          />
        ) : (
          <Sheet title={`Venta esperada · ${titulo}`} onClose={() => setEtiquetando(null)}>
            {etiquetasDelDia(month.weeks[weekIndex]?.days[etiquetando], fecha).map((e) => (
              <p key={e.texto} className="etq-quincena">
                {e.icono} {e.texto}
              </p>
            ))}
            {detalle || <p className="hint">Todavía no hay suficiente historia para este día.</p>}
          </Sheet>
        );
      })()}

      {readOnly && !saved ? (
        <Empty icon={<Clock size={26} strokeWidth={1.3} />} text="Aún no se ha guardado el horario de esta semana." />
      ) : (
        <HorarioSemanaForm
          key={`${monthKey}-${weekIndex}`}
          iconosDia={Object.fromEntries(
            DAYS.map((d) => [d, etiquetasDelDia(month.weeks[weekIndex]?.days[d], dateForDay(monthKey, weekIndex, month, d)).map((e) => e.icono).join("")])
          )}
          monthKey={monthKey}
          weekIndex={weekIndex}
          semanaInicial={semanaInicial}
          guardadaActual={saved}
          yaGuardada={!!saved}
          isDraftBase={isDraftBase}
          empleados={empleados}
          onSaveSemana={onSaveSemana}
          soloAreaId={soloAreaId}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

function HorarioSemanaForm({
  iconosDia,
  monthKey,
  weekIndex,
  semanaInicial,
  guardadaActual,
  yaGuardada,
  isDraftBase,
  empleados,
  onSaveSemana,
  soloAreaId,
  readOnly,
}: {
  // Íconos de las etiquetas de cada día, debajo del nombre del día.
  iconosDia?: Partial<Record<DayName, string>>;
  monthKey: string;
  weekIndex: number;
  semanaInicial: HorarioSemana;
  // La versión guardada más reciente (se actualiza en vivo si otra persona
  // guarda): al guardar solo se reemplazan las áreas que se cambiaron aquí.
  guardadaActual: HorarioSemana | null;
  yaGuardada: boolean;
  isDraftBase: boolean;
  empleados: EmpleadoEntry[];
  onSaveSemana: (monthKey: string, weekIndex: number, semana: HorarioSemana) => void;
  soloAreaId?: string;
  readOnly?: boolean;
}) {
  const [semana, setSemana] = useState(semanaInicial);
  const [locked, setLocked] = useState(yaGuardada);
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);
  const [addingEmpleadoToArea, setAddingEmpleadoToArea] = useState<string | null>(null);
  const [cellEditor, setCellEditor] = useState<CellTarget | null>(null);
  // Desde dónde se empezó a editar: para saber qué áreas cambió esta persona.
  const [referencia, setReferencia] = useState<HorarioSemana>(semanaInicial);
  const [avisoConservado, setAvisoConservado] = useState<string | null>(null);

  // Sin editar (guardado y bloqueado), se ve siempre lo último guardado,
  // aunque lo haya guardado otra persona.
  useEffect(() => {
    if (locked && guardadaActual) {
      const n = normalizeHorarioSemana(guardadaActual);
      setSemana(n);
      setReferencia(n);
    }
  }, [locked, guardadaActual]);

  const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  // Se guarda sobre la versión más reciente: solo se reemplazan las áreas
  // (y los festivos) que se cambiaron en esta pantalla; lo demás se queda como
  // lo guardó quien lo haya guardado al último. Así el dueño (piso) y el jefe
  // de cocina pueden editar al mismo tiempo sin borrarse el trabajo.
  function guardar() {
    let final = semana;
    const conservadas: string[] = [];
    if (guardadaActual) {
      const base = normalizeHorarioSemana(guardadaActual);
      const cambiadas = semana.areas.filter((a) => !igual(a, referencia.areas.find((r) => r.id === a.id)));
      base.areas.forEach((a) => {
        if (!cambiadas.some((c) => c.id === a.id) && !igual(a, referencia.areas.find((r) => r.id === a.id))) conservadas.push(a.nombre);
      });
      final = {
        ...base,
        areas: [
          ...base.areas.map((a) => cambiadas.find((c) => c.id === a.id) || a),
          ...cambiadas.filter((c) => !base.areas.some((a) => a.id === c.id)),
        ],
        festivos: igual(semana.festivos, referencia.festivos) ? base.festivos : semana.festivos,
      };
    }
    onSaveSemana(monthKey, weekIndex, final);
    setSemana(final);
    setReferencia(final);
    setAvisoConservado(conservadas.length ? conservadas.join(" y ") : null);
    setLocked(true);
  }

  function addEmpleadoToArea(areaId: string, empleado: EmpleadoEntry) {
    setSemana((s) => ({
      areas: s.areas.map((a) =>
        a.id === areaId ? { ...a, filas: [...a.filas, { empleadoId: empleado.id, nombre: empleado.nombre, valores: {} }] } : a
      ),
    }));
    setAddingEmpleadoToArea(null);
  }

  function removeFila(areaId: string, empleadoId: string) {
    setSemana((s) => ({
      areas: s.areas.map((a) => (a.id === areaId ? { ...a, filas: a.filas.filter((f) => f.empleadoId !== empleadoId) } : a)),
    }));
  }

  function toggleFestivo(day: DayName) {
    setSemana((s) => {
      const festivos = s.festivos || [];
      return {
        ...s,
        festivos: festivos.includes(day) ? festivos.filter((d) => d !== day) : [...festivos, day],
      };
    });
  }

  function setCellValue(areaId: string, empleadoId: string, day: DayName, value: string) {
    setSemana((s) => ({
      areas: s.areas.map((a) =>
        a.id === areaId
          ? {
              ...a,
              filas: a.filas.map((f) => (f.empleadoId === empleadoId ? { ...f, valores: { ...f.valores, [day]: value || undefined } } : f)),
            }
          : a
      ),
    }));
  }

  // Un toque en la celda avanza el ciclo OFF → O → X → Z; al llegar a Z (o
  // si la celda ya tiene una hora personalizada), abre el modal para
  // capturar/editar esa hora en vez de seguir el ciclo.
  function handleCellTap(areaId: string, empleadoId: string, nombre: string, day: DayName, currentValue: string) {
    if (!currentValue) {
      setCellValue(areaId, empleadoId, day, HORARIO_CHIPS[0]);
      return;
    }
    const idx = (HORARIO_CHIPS as readonly string[]).indexOf(currentValue);
    if (idx !== -1 && idx < HORARIO_CHIPS.length - 1) {
      setCellValue(areaId, empleadoId, day, HORARIO_CHIPS[idx + 1]);
      return;
    }
    setCellEditor({ areaId, empleadoId, nombre, day });
  }

  const areaAddingTarget: HorarioArea | undefined = addingEmpleadoToArea
    ? semana.areas.find((a) => a.id === addingEmpleadoToArea)
    : undefined;
  const empleadosDisponibles = areaAddingTarget
    ? empleados.filter((e) => !areaAddingTarget.filas.some((f) => f.empleadoId === e.id))
    : [];
  const cellValueRaw = cellEditor
    ? semana.areas.find((a) => a.id === cellEditor.areaId)?.filas.find((f) => f.empleadoId === cellEditor.empleadoId)?.valores[cellEditor.day] || ""
    : "";
  const cellValueIsChip = (HORARIO_CHIPS as readonly string[]).includes(cellValueRaw);

  return (
    <>
      {readOnly ? (
        <p className="hint">Solo el dueño y el jefe de cocina pueden editar el horario — aquí solo se puede ver.</p>
      ) : locked ? (
        <div className="conteo-locked-banner">
          <span>
            Este horario ya está guardado y los campos están bloqueados.
            {avisoConservado && ` Se conservó lo que guardó alguien más en ${avisoConservado}.`}
          </span>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(true)}>
            Editar
          </button>
        </div>
      ) : (
        isDraftBase && (
          <p className="hint">
            Se precargó el mismo personal de la última semana capturada — ajusta lo que cambió y toca "Guardar
            horario" para dejar esta semana en el historial.
          </p>
        )
      )}

      {!soloAreaId && (
        <>
          <p className="hint">Día festivo — a quien trabaje ese día se le paga 1 turno extra.</p>
          <div className="segmented horario-festivos">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={(semana.festivos || []).includes(d) ? "festivo active" : ""}
                onClick={() => toggleFestivo(d)}
                disabled={locked || readOnly}
              >
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
        </>
      )}

      {semana.areas
        .filter((area) => !soloAreaId || area.id === soloAreaId)
        .map((area) => (
        <div className="horario-area" key={area.id}>
          <div className="horario-area-head">
            <h3>{area.nombre}</h3>
          </div>

          {area.filas.length === 0 ? (
            <p className="hint">Sin personal todavía en esta área.</p>
          ) : (
            <div className="horario-table-wrap">
              <table className="horario-table">
                <thead>
                  <tr>
                    <th className="horario-col-nombre">Nombre</th>
                    {DAYS.map((d) => (
                      <th key={d} className={(semana.festivos || []).includes(d) ? "festivo" : ""}>
                        {DAY_SHORT[d]}
                        {iconosDia?.[d] && <small>{iconosDia[d]}</small>}
                      </th>
                    ))}
                    {!readOnly && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {area.filas.map((fila) => (
                    <tr key={fila.empleadoId}>
                      <td className="horario-col-nombre">{fila.nombre}</td>
                      {DAYS.map((d) => {
                        const value = fila.valores[d];
                        return (
                          <td key={d}>
                            <button
                              type="button"
                              className={`horario-cell ${value ? "filled" : ""}`}
                              onClick={() => handleCellTap(area.id, fila.empleadoId, fila.nombre, d, value || "")}
                              disabled={locked || readOnly}
                            >
                              {value || <span className="horario-cell-empty-mark">–</span>}
                            </button>
                          </td>
                        );
                      })}
                      {!readOnly && (
                        <td>
                          <button
                            className="icon-btn horario-row-remove"
                            onClick={() => removeFila(area.id, fila.empleadoId)}
                            aria-label={`Quitar a ${fila.nombre} de ${area.nombre}`}
                            disabled={locked}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!readOnly && (
            <button className="link-btn" onClick={() => setAddingEmpleadoToArea(area.id)} disabled={locked}>
              + Agregar empleado a {area.nombre}
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <button className="btn-primary" onClick={guardar} disabled={locked}>
          Guardar horario
        </button>
      )}

      {addingEmpleadoToArea && areaAddingTarget && (
        <Sheet title={`Agregar a ${areaAddingTarget.nombre}`} onClose={() => setAddingEmpleadoToArea(null)}>
          {empleadosDisponibles.length === 0 ? (
            <p className="hint">
              {empleados.length === 0
                ? "Todavía no tienes personal en Equipo > Personal. Agrega ahí primero."
                : "Ya agregaste a todo tu personal en esta área."}
            </p>
          ) : (
            <div className="horario-emp-list">
              {empleadosDisponibles.map((e) => (
                <button key={e.id} className="horario-emp-item" onClick={() => addEmpleadoToArea(addingEmpleadoToArea, e)}>
                  {e.nombre}
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}

      {cellEditor && (
        <CeldaModal
          nombre={cellEditor.nombre}
          day={cellEditor.day}
          initialText={cellValueIsChip ? "" : cellValueRaw}
          hasValue={!!cellValueRaw}
          onClose={() => setCellEditor(null)}
          onSave={(value) => {
            setCellValue(cellEditor.areaId, cellEditor.empleadoId, cellEditor.day, value);
            setCellEditor(null);
          }}
        />
      )}

      {pidiendoConfirmacion && (
        <Sheet title="Editar horario guardado" onClose={() => setPidiendoConfirmacion(false)}>
          <p className="hint">
            Este horario ya se guardó. No deberías editarlo salvo que estés seguro de que algo quedó mal — cambiarlo
            afecta tanto el historial de Horarios como la Nómina ya calculada de esta semana.
          </p>
          <button
            className="btn-warn"
            onClick={() => {
              setLocked(false);
              setPidiendoConfirmacion(false);
            }}
          >
            <TriangleAlert size={16} /> Sí, necesito editarlo
          </button>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(false)}>
            Cancelar
          </button>
        </Sheet>
      )}
    </>
  );
}

function CeldaModal({
  nombre,
  day,
  initialText,
  hasValue,
  onClose,
  onSave,
}: {
  nombre: string;
  day: DayName;
  initialText: string;
  hasValue: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [text, setText] = useState(initialText);

  return (
    <Sheet title={`${nombre} · ${day}`} onClose={onClose}>
      <Field label="Hora de entrada">
        <input
          className="text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej. 6:30 PM"
          autoFocus
        />
      </Field>
      <button className="btn-primary" onClick={() => onSave(text)} disabled={!text.trim()}>
        Guardar
      </button>
      {hasValue && (
        <button className="link-btn" onClick={() => onSave("")}>
          Borrar celda
        </button>
      )}
    </Sheet>
  );
}
