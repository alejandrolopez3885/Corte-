import { useState } from "react";
import { ArrowLeft, Clock, Plus, Trash2 } from "lucide-react";
import { Empty, Field, Sheet } from "../ui";
import { findPreviousHorarioSemana, formatWeekRange, resolveWeekStartDate, uid } from "../../lib/dataModel";
import { DAYS, DAY_SHORT, HORARIO_CHIPS } from "../../lib/types";
import type { DayName, EmpleadoEntry, HorarioArea, HorarioMonthData, HorarioSemana, MonthData } from "../../lib/types";

type CellTarget = { areaId: string; empleadoId: string; nombre: string; day: DayName };

export function HorariosPanel({
  onBack,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  empleados,
  horarios,
  onSaveSemana,
}: {
  onBack: () => void;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  empleados: EmpleadoEntry[];
  horarios: Record<string, HorarioMonthData>;
  onSaveSemana: (monthKey: string, weekIndex: number, semana: HorarioSemana) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [addingArea, setAddingArea] = useState(false);
  const [addingEmpleadoToArea, setAddingEmpleadoToArea] = useState<string | null>(null);
  const [cellEditor, setCellEditor] = useState<CellTarget | null>(null);

  const month = months[monthKey];

  if (!month) {
    return (
      <div className="page-section">
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> Equipo
        </button>
        <h2 className="page-title">Horarios</h2>
        <Empty icon={<Clock size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder armar horarios." />
      </div>
    );
  }

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const saved = horarios[monthKey]?.weeks?.[weekIndex] ?? null;
  const seeded = !saved ? findPreviousHorarioSemana(horarios, monthKeys, monthKey, weekIndex) : null;
  const semana: HorarioSemana = saved ?? seeded ?? { areas: [] };
  const isDraft = !saved && !!seeded;

  function persist(next: HorarioSemana) {
    onSaveSemana(monthKey, weekIndex, next);
  }

  function addArea(nombre: string) {
    persist({ areas: [...semana.areas, { id: uid(), nombre, filas: [] }] });
    setAddingArea(false);
  }

  function removeArea(areaId: string) {
    persist({ areas: semana.areas.filter((a) => a.id !== areaId) });
  }

  function addEmpleadoToArea(areaId: string, empleado: EmpleadoEntry) {
    persist({
      areas: semana.areas.map((a) =>
        a.id === areaId ? { ...a, filas: [...a.filas, { empleadoId: empleado.id, nombre: empleado.nombre, valores: {} }] } : a
      ),
    });
    setAddingEmpleadoToArea(null);
  }

  function removeFila(areaId: string, empleadoId: string) {
    persist({
      areas: semana.areas.map((a) => (a.id === areaId ? { ...a, filas: a.filas.filter((f) => f.empleadoId !== empleadoId) } : a)),
    });
  }

  function setCellValue(areaId: string, empleadoId: string, day: DayName, value: string) {
    persist({
      areas: semana.areas.map((a) =>
        a.id === areaId
          ? {
              ...a,
              filas: a.filas.map((f) => (f.empleadoId === empleadoId ? { ...f, valores: { ...f.valores, [day]: value || undefined } } : f)),
            }
          : a
      ),
    });
  }

  const areaAddingTarget: HorarioArea | undefined = addingEmpleadoToArea
    ? semana.areas.find((a) => a.id === addingEmpleadoToArea)
    : undefined;
  const empleadosDisponibles = areaAddingTarget
    ? empleados.filter((e) => !areaAddingTarget.filas.some((f) => f.empleadoId === e.id))
    : [];
  const cellValue = cellEditor
    ? semana.areas.find((a) => a.id === cellEditor.areaId)?.filas.find((f) => f.empleadoId === cellEditor.empleadoId)?.valores[cellEditor.day] || ""
    : "";

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Equipo
      </button>
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

      {isDraft && (
        <p className="hint">Mostrando el mismo personal de la última semana capturada — ajusta lo que cambió; se guarda en cuanto edites algo.</p>
      )}

      {semana.areas.length === 0 ? (
        <Empty icon={<Clock size={26} strokeWidth={1.3} />} text="Aún no hay áreas esta semana. Agrega una para empezar a armar el horario." />
      ) : (
        semana.areas.map((area) => (
          <div className="horario-area" key={area.id}>
            <div className="horario-area-head">
              <h3>{area.nombre}</h3>
              <button className="icon-btn" onClick={() => removeArea(area.id)} aria-label={`Quitar área ${area.nombre}`}>
                <Trash2 size={15} />
              </button>
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
                        <th key={d}>{DAY_SHORT[d]}</th>
                      ))}
                      <th></th>
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
                                onClick={() => setCellEditor({ areaId: area.id, empleadoId: fila.empleadoId, nombre: fila.nombre, day: d })}
                              >
                                {value || <span className="horario-cell-empty-mark">–</span>}
                              </button>
                            </td>
                          );
                        })}
                        <td>
                          <button
                            className="icon-btn horario-row-remove"
                            onClick={() => removeFila(area.id, fila.empleadoId)}
                            aria-label={`Quitar a ${fila.nombre} de ${area.nombre}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button className="link-btn" onClick={() => setAddingEmpleadoToArea(area.id)}>
              + Agregar empleado a {area.nombre}
            </button>
          </div>
        ))
      )}

      <button className="btn-primary" onClick={() => setAddingArea(true)}>
        <Plus size={16} /> Agregar área
      </button>

      {addingArea && <AreaModal onClose={() => setAddingArea(false)} onSave={addArea} />}

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
          value={cellValue}
          onClose={() => setCellEditor(null)}
          onSave={(value) => {
            setCellValue(cellEditor.areaId, cellEditor.empleadoId, cellEditor.day, value);
            setCellEditor(null);
          }}
        />
      )}
    </div>
  );
}

function AreaModal({ onClose, onSave }: { onClose: () => void; onSave: (nombre: string) => void }) {
  const [nombre, setNombre] = useState("");

  function save() {
    if (!nombre.trim()) return;
    onSave(nombre.trim());
  }

  return (
    <Sheet title="Nueva área" onClose={onClose}>
      <Field label="Nombre">
        <input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Piso, Cocina" autoFocus />
      </Field>
      <button className="btn-primary" onClick={save} disabled={!nombre.trim()}>
        Guardar
      </button>
    </Sheet>
  );
}

function CeldaModal({
  nombre,
  day,
  value,
  onClose,
  onSave,
}: {
  nombre: string;
  day: DayName;
  value: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const isChip = (HORARIO_CHIPS as readonly string[]).includes(value);

  return (
    <Sheet title={`${nombre} · ${day}`} onClose={onClose}>
      <div className="segmented">
        {HORARIO_CHIPS.map((chip) => (
          <button key={chip} type="button" className={value === chip ? "active" : ""} onClick={() => onSave(chip)}>
            {chip}
          </button>
        ))}
      </div>
      <Field label="Hora u otro texto">
        <input
          className="text-input"
          value={isChip ? "" : text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej. 6:30 PM"
          autoFocus={!isChip}
        />
      </Field>
      <button className="btn-primary" onClick={() => onSave(text)}>
        Guardar
      </button>
      {value && (
        <button className="link-btn" onClick={() => onSave("")}>
          Borrar celda
        </button>
      )}
    </Sheet>
  );
}
