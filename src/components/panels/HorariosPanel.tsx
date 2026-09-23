import { useState } from "react";
import { ArrowLeft, Clock, Download, Trash2, TriangleAlert } from "lucide-react";
import { Empty, Field, Sheet } from "../ui";
import { findPreviousHorarioSemana, formatWeekRange, isoWeekNumber, normalizeHorarioSemana, resolveWeekStartDate } from "../../lib/dataModel";
import { downloadHorarioImage } from "../../lib/horarioImage";
import { DAYS, DAY_SHORT, HORARIO_AREAS_FIJAS, HORARIO_CHIPS } from "../../lib/types";
import type { DayName, EmpleadoEntry, HorarioArea, HorarioMonthData, HorarioSemana, MonthData } from "../../lib/types";

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
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);

  const month = months[monthKey];

  if (!month) {
    return (
      <div className="page-section">
        {onBack && (
          <button className="link-btn back-link" onClick={onBack}>
            <ArrowLeft size={15} /> {backLabel}
          </button>
        )}
        <h2 className="page-title">Horarios</h2>
        <Empty icon={<Clock size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder armar horarios." />
      </div>
    );
  }

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const saved = horarios[monthKey]?.weeks?.[weekIndex] ?? null;
  const seeded = !saved ? findPreviousHorarioSemana(horarios, monthKeys, monthKey, weekIndex) : null;
  const semanaInicial: HorarioSemana = normalizeHorarioSemana(saved ?? seeded);
  // Un festivo es de esa semana en concreto — no se debe precargar del
  // personal de la semana anterior aunque esa sí haya tenido uno.
  if (!saved) semanaInicial.festivos = [];
  const isDraftBase = !saved && !!seeded;

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <h2 className="page-title">Horarios</h2>
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
            <button
              key={a.id}
              className="link-btn"
              onClick={() =>
                downloadHorarioImage(
                  saved,
                  `Horario · ${month.label} · Semana ${isoWeekNumber(weekStartDate)}`,
                  formatWeekRange(weekStartDate),
                  a.id
                )
              }
            >
              <Download size={15} /> Imagen · {a.nombre}
            </button>
          ))}
          {!soloAreaId && saved.areas.filter((a) => a.filas.length > 0).length > 1 && (
            <button
              className="link-btn"
              onClick={() =>
                downloadHorarioImage(
                  saved,
                  `Horario · ${month.label} · Semana ${isoWeekNumber(weekStartDate)}`,
                  formatWeekRange(weekStartDate)
                )
              }
            >
              <Download size={15} /> Imagen · Las 2 áreas
            </button>
          )}
        </div>
      )}

      {readOnly && !saved ? (
        <Empty icon={<Clock size={26} strokeWidth={1.3} />} text="Aún no se ha guardado el horario de esta semana." />
      ) : (
        <HorarioSemanaForm
          key={`${monthKey}-${weekIndex}`}
          monthKey={monthKey}
          weekIndex={weekIndex}
          semanaInicial={semanaInicial}
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
  monthKey,
  weekIndex,
  semanaInicial,
  yaGuardada,
  isDraftBase,
  empleados,
  onSaveSemana,
  soloAreaId,
  readOnly,
}: {
  monthKey: string;
  weekIndex: number;
  semanaInicial: HorarioSemana;
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

  function guardar() {
    onSaveSemana(monthKey, weekIndex, semana);
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
          <span>Este horario ya está guardado y los campos están bloqueados.</span>
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
