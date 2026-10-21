import { useRef, useState } from "react";
import { Check, Pencil, TriangleAlert } from "lucide-react";
import { Sheet, Field, NumInput } from "../ui";
import { addDaysIso, computeWeekGastos, dateForDay, formatShortDayDate, formatWeekRange, money, resolveWeekStartDate } from "../../lib/dataModel";
import { DAYS, GASTO_CATEGORIAS } from "../../lib/types";
import type { DayName, EmpleadoEntry, Gasto, GastoCategoria, MeseroCatalogEntry, MonthData, WeekData } from "../../lib/types";

type Filtro = "todos" | "pendientes" | "sinCategoria" | "ingresados";

const pasaFiltro = (g: Gasto, f: Filtro) =>
  f === "todos" || (f === "pendientes" && g.estado === "pendiente") || (f === "ingresados" && g.estado === "ingresado") || (f === "sinCategoria" && g.estado === "pendiente" && !g.categoria);

const pendientesDe = (w: WeekData | null | undefined) => (w ? DAYS.reduce((n, d) => n + w.days[d].gastos.filter((g) => g.estado === "pendiente").length, 0) : 0);

// "Lun 13 oct": etiqueta discreta de cada gasto.
const DIA_CORTO: Record<DayName, string> = {
  Lunes: "Lun", Martes: "Mar", Miércoles: "Mié", Jueves: "Jue", Viernes: "Vie", Sábado: "Sáb", Domingo: "Dom",
};

// Semanas anteriores a revisar por pendientes olvidados: solo las 2
// últimas — lo más viejo ya no se corrige.
const SEMANAS_ATRAS = 2;
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import { BuscarGastos } from "./BuscarGastos";
import type { GastoFormValues } from "./GastoModal";

export function GastosSummaryModal({
  onClose,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  onToggleEstado,
  onSetCategoria,
  onMoverGasto,
  onEditarGasto,
  onAgregarGasto,
  empleados,
  meseros,
  historial,
}: {
  onClose: () => void;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  onToggleEstado: (monthKey: string, weekIndex: number, dayName: DayName, id: string) => void;
  onSetCategoria: (monthKey: string, weekIndex: number, dayName: DayName, id: string, categoria: GastoCategoria | "") => void;
  onMoverGasto: (monthKey: string, weekIndex: number, fromDay: DayName, toDay: DayName, id: string) => void;
  onEditarGasto: (monthKey: string, weekIndex: number, dayName: DayName, id: string, concepto: string, total: number) => void;
  onAgregarGasto: (monthKey: string, weekIndex: number, dayName: DayName, form: GastoFormValues) => void;
  empleados: EmpleadoEntry[];
  meseros: MeseroCatalogEntry[];
  historial: NombreHistorial[];
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [editing, setEditing] = useState<{ id: string; concepto: string; total: string } | null>(null);
  // null = automático: Pendientes si la semana tiene, si no Todos.
  const [filtroElegido, setFiltroElegido] = useState<Filtro | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimer = useRef<number | undefined>(undefined);

  const month = months[monthKey];
  const week = month?.weeks[weekIndex];

  if (!month || !week) return null;

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const g = computeWeekGastos(week);
  const sinCategoria = g.perDay.reduce((n, d) => n + d.items.filter((x) => pasaFiltro(x, "sinCategoria")).length, 0);
  const filtro: Filtro = filtroElegido ?? (g.countPendiente > 0 ? "pendientes" : "todos");
  const filtros: { key: Filtro; label: string; n: number }[] = [
    { key: "todos", label: "Todos", n: g.countTotal },
    { key: "pendientes", label: "Pendientes", n: g.countPendiente },
    { key: "sinCategoria", label: "Sin categoría", n: sinCategoria },
    { key: "ingresados", label: "Ingresados", n: g.countIngresado },
  ];
  const dias = g.perDay.map((d) => ({ ...d, visibles: d.items.filter((x) => pasaFiltro(x, filtro)) }));
  const montoVisible = dias.reduce((s, d) => s + d.visibles.reduce((x, i) => x + i.total, 0), 0);
  const cuantosVisibles = dias.reduce((n, d) => n + d.visibles.length, 0);

  // Pendientes en las 2 semanas anteriores, en cualquier mes.
  const anteriores: { mk: string; wi: number; lunes: string; n: number }[] = [];
  monthKeys.forEach((mk) =>
    months[mk].weeks.forEach((w, wi) => {
      const lunes = resolveWeekStartDate(mk, wi, months[mk]);
      if (lunes >= weekStartDate || lunes < addDaysIso(weekStartDate, -7 * SEMANAS_ATRAS)) return;
      const n = pendientesDe(w);
      if (n > 0) anteriores.push({ mk, wi, lunes, n });
    })
  );
  anteriores.sort((a, b) => a.lunes.localeCompare(b.lunes));
  const totalAnteriores = anteriores.reduce((s, a) => s + a.n, 0);

  function irASemana(mk: string, wi: number) {
    setMonthKey(mk);
    setWeekIndex(wi);
    setEditing(null);
    setFiltroElegido(null);
  }

  // Al confirmar un pendiente se quita de la lista (si el filtro es
  // Pendientes) y queda un aviso discreto de cuál fue.
  function cambiarEstado(day: DayName, item: Gasto) {
    onToggleEstado(monthKey, weekIndex, day, item.id);
    if (item.estado === "pendiente") {
      setAviso(`${item.concepto} ${money(item.total)} confirmado`);
      window.clearTimeout(avisoTimer.current);
      avisoTimer.current = window.setTimeout(() => setAviso(null), 2500);
    }
  }

  return (
    <Sheet title="Control de gastos en efectivo" onClose={onClose}>
      <div className="field-row gastos-semana-row">
        <Field label="Mes">
          <select
            className="text-input"
            value={monthKey}
            onChange={(e) => irASemana(e.target.value, 0)}
          >
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select className="text-input" value={weekIndex} onChange={(e) => irASemana(monthKey, Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => {
              const n = pendientesDe(month.weeks[i]);
              return (
                <option key={i} value={i}>
                  {n > 0 ? `Sem ${i + 1} · ${n} pdte${n === 1 ? "" : "s"}` : `Semana ${i + 1}`}
                </option>
              );
            })}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

      {totalAnteriores > 0 && (
        <button type="button" className="gastos-anteriores" onClick={() => irASemana(anteriores[0].mk, anteriores[0].wi)}>
          <span>
            <TriangleAlert size={14} /> <strong>{totalAnteriores} {totalAnteriores === 1 ? "pendiente" : "pendientes"}</strong> en
            semanas anteriores ({anteriores.map((a) => formatWeekRange(a.lunes)).join(", ")})
          </span>
          <span className="gastos-anteriores-ver">Ver ›</span>
        </button>
      )}

      <BuscarGastos
        key={`${monthKey}-${weekIndex}`}
        monthKey={monthKey}
        weekIndex={weekIndex}
        month={month}
        week={week}
        onToggleEstado={onToggleEstado}
        onSetCategoria={onSetCategoria}
        onMoverGasto={onMoverGasto}
        onEditarGasto={onEditarGasto}
        onAgregarGasto={onAgregarGasto}
        empleados={empleados}
        meseros={meseros}
        historial={historial}
      />

      <div className="summary-grid-modal">
        <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
          <span>Total de gastos ({g.countTotal})</span>
          <strong>{money(g.totalMonto)}</strong>
        </div>
        <div className="summary-item">
          <span>Ingresados ({g.countIngresado})</span>
          <strong>{money(g.totalIngresado)}</strong>
        </div>
        <div className="summary-item">
          <span>Pendientes ({g.countPendiente})</span>
          <strong>{money(g.totalPendiente)}</strong>
        </div>
      </div>
      <p className="hint">
        Elige la categoría de cada gasto antes de confirmarlo. Una vez ingresado, la categoría queda bloqueada — para cambiarla,
        vuelve a marcarlo como pendiente.
      </p>

      <div className="gastos-filtros">
        {filtros.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`gastos-filtro ${filtro === f.key ? "activo" : ""} ${f.key !== "todos" && f.key !== "ingresados" && f.n > 0 ? "alerta" : ""}`}
            onClick={() => setFiltroElegido(f.key)}
          >
            {f.label} <strong>{f.n}</strong>
          </button>
        ))}
      </div>
      {filtro !== "todos" && (
        <p className="hint gastos-filtro-resumen">
          {cuantosVisibles === 0
            ? filtro === "ingresados"
              ? "Ningún gasto ingresado esta semana."
              : "✓ Sin pendientes esta semana."
            : `${cuantosVisibles} ${filtro === "ingresados" ? (cuantosVisibles === 1 ? "ingresado" : "ingresados") : cuantosVisibles === 1 ? "pendiente" : "pendientes"} · ${money(montoVisible)}${filtro !== "ingresados" ? " — al confirmar cada uno, se quita de esta lista." : ""}`}
        </p>
      )}
      {aviso && (
        <div className="toast-discreto gastos-aviso" role="status">
          <Check size={14} /> {aviso}
        </div>
      )}

      <div className="gastos-days">
        {dias.map((d) => {
          if (filtro !== "todos" && d.visibles.length === 0) return null;
          const fecha = dateForDay(monthKey, weekIndex, month, d.day);
          const etiquetaFecha = `${DIA_CORTO[d.day]} ${formatShortDayDate(fecha)}`;
          return (
          <div key={d.day} className="gastos-day-block">
            <div className="gastos-day-head">
              <span>
                {d.day} <em>{formatShortDayDate(fecha)}</em>
              </span>
              {filtro === "todos" ? (
                <strong>{money(d.dayTotal)}</strong>
              ) : (
                <em className="gastos-day-cuantos">
                  {d.visibles.length} {filtro === "ingresados" ? (d.visibles.length === 1 ? "ingresado" : "ingresados") : d.visibles.length === 1 ? "pendiente" : "pendientes"}
                </em>
              )}
            </div>
            {d.visibles.length === 0 ? (
              <p className="hint">Sin gastos este día.</p>
            ) : (
              <div className="gasto-existing-list">
                {d.visibles.map((item) => {
                  const isEditing = editing?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`gasto-existing-row gasto-row-classify ${item.estado === "pendiente" ? (item.categoria ? "falta-confirmar" : "falta-categoria") : ""}`}
                    >
                      {isEditing ? (
                        <div className="gasto-row-edit">
                          <input
                            className="text-input"
                            value={editing.concepto}
                            onChange={(e) => setEditing({ ...editing, concepto: e.target.value })}
                            placeholder="Concepto"
                          />
                          <NumInput
                            value={editing.total}
                            onChange={(e) => setEditing({ ...editing, total: e.target.value })}
                            placeholder="0.00"
                          />
                          <div className="gasto-row-edit-actions">
                            <button type="button" className="link-btn" onClick={() => setEditing(null)}>
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={!editing.concepto || !editing.total}
                              onClick={() => {
                                onEditarGasto(monthKey, weekIndex, d.day, item.id, editing.concepto, parseFloat(editing.total) || 0);
                                setEditing(null);
                              }}
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="gasto-row-main">
                            <span className="gasto-row-main-text">
                              <span className="gasto-existing-concepto">
                                {item.concepto}
                                <span className="gasto-fecha">{etiquetaFecha}</span>
                              </span>
                              <span className="gasto-existing-monto">{money(item.total)}</span>
                            </span>
                            <button
                              type="button"
                              className="icon-btn gasto-edit-btn"
                              aria-label="Editar gasto"
                              onClick={() => setEditing({ id: item.id, concepto: item.concepto, total: String(item.total) })}
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                          {item.estado === "pendiente" && (
                            <span className={`gasto-razon ${item.categoria ? "confirmar" : "categoria"}`}>
                              {item.categoria ? "Falta confirmar (subir comprobante al bot)" : "Falta categoría"}
                            </span>
                          )}
                          <div className="gasto-row-controls">
                            <select
                              className="categoria-select"
                              value={item.categoria || ""}
                              disabled={item.estado === "ingresado"}
                              onChange={(e) => onSetCategoria(monthKey, weekIndex, d.day, item.id, e.target.value as GastoCategoria | "")}
                            >
                              <option value="">Sin categoría</option>
                              {GASTO_CATEGORIAS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={`estado-chip ${item.estado}`}
                              disabled={item.estado === "pendiente" && !item.categoria}
                              onClick={() => cambiarEstado(d.day, item)}
                            >
                              {item.estado === "pendiente" ? (
                                "Confirmar"
                              ) : (
                                <>
                                  <Check size={13} /> Ingresado
                                </>
                              )}
                            </button>
                            <select
                              className="categoria-select mover-gasto-select"
                              value=""
                              onChange={(e) => {
                                const toDay = e.target.value as DayName;
                                if (toDay) onMoverGasto(monthKey, weekIndex, d.day, toDay, item.id);
                              }}
                            >
                              <option value="">Mover a...</option>
                              {DAYS.filter((dn) => dn !== d.day).map((dn) => (
                                <option key={dn} value={dn}>
                                  {dn}
                                </option>
                              ))}
                            </select>
                          </div>
                          {item.meseroCutId && (
                            <p className="hint gasto-row-hint">
                              Restado del corte de {item.meseroNombre || "un mesero"} este día — si lo mueves o editas el monto, su
                              total de este día se recalcula.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })}
      </div>

      <div className="week-total-row">
        <span>Total semanal</span>
        <strong>{money(g.totalMonto)}</strong>
      </div>
    </Sheet>
  );
}
