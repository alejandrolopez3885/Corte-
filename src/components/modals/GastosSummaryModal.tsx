import { useEffect, useMemo, useRef, useState } from "react";
import { useAlRecargar } from "../JalarParaActualizar";
import { Check, ChevronDown, Pencil, Receipt, TriangleAlert } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { estadoAutomatico, gastosEnJohnster, type JohnsterDatos, avisarDatosJohnster } from "../../lib/cuadrar";
import { VerComprobante, type Comprobante } from "./ComprobanteJohnster";
import { Sheet, Field, NumInput } from "../ui";
import { addDaysIso, computeWeekGastos, dateForDay, formatShortDayDate, formatWeekRange, money, resolveWeekStartDate } from "../../lib/dataModel";
import { DAYS, GASTO_CATEGORIAS } from "../../lib/types";
import type { DayName, EmpleadoEntry, Gasto, GastoCategoria, MeseroCatalogEntry, MonthData, WeekData } from "../../lib/types";

type Filtro = "todos" | "pendientes" | "sinCategoria" | "ingresados";

// En semanas con estado automático (Johnster), "Sin categoría" es cualquier
// gasto sin categoría, esté o no en el bot.
const pasaFiltro = (g: Gasto, f: Filtro, auto = false) =>
  f === "todos" ||
  (f === "pendientes" && g.estado === "pendiente") ||
  (f === "ingresados" && g.estado === "ingresado") ||
  (f === "sinCategoria" && (auto || g.estado === "pendiente") && !g.categoria);

// Por qué sigue pendiente un gasto (estado automático desde Johnster).
const RAZON: Record<NonNullable<Gasto["estadoBot"]>, string> = {
  "no-esta": "No está en el bot",
  "sin-ticket": "Falta ticket en el bot",
  domingo: "Se sube junto el domingo",
  diferente: "En el bot con otro monto o día",
};

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
  onSincronizar,
  onSinTicket,
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
  // Estado automático (desde la semana del 26/10/2026): actualizar con los
  // datos del bot, y la justificación "sin ticket" del dueño.
  onSincronizar?: (monthKey: string, weekIndex: number, j: JohnsterDatos) => void;
  onSinTicket?: (monthKey: string, weekIndex: number, dia: DayName, id: string, texto: string | undefined) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [editing, setEditing] = useState<{ id: string; concepto: string; total: string } | null>(null);
  // null = automático: Pendientes si la semana tiene, si no Todos.
  const [filtroElegido, setFiltroElegido] = useState<Filtro | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimer = useRef<number | undefined>(undefined);
  // Acordeón: cada gasto muestra lo principal; al abrirlo, categoría,
  // confirmar, mover y editar. Los pendientes empiezan abiertos.
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  // Johnster: el gasto del bot que le corresponde a cada uno (Ver ticket).
  const [johnster, setJohnster] = useState<JohnsterDatos | null>(null);
  const [viendo, setViendo] = useState<Comprobante | null>(null);
  const [justificando, setJustificando] = useState<{ id: string; texto: string } | null>(null);
  const cargarJohnster = () =>
    supabase
      .from("johnster_datos")
      .select("sucursal, ingresos, gastos, actualizado_en, error")
      .maybeSingle()
      .then(({ data }) => {
        setJohnster((data as JohnsterDatos | null) ?? null);
        avisarDatosJohnster(data as JohnsterDatos | null);
      });
  useEffect(() => {
    // Si la copia del bot tiene más de 10 minutos, se trae fresca (el estado
    // de cada gasto depende de lo que haya en el bot ahorita).
    cargarJohnster().then(() =>
      supabase
        .from("johnster_datos")
        .select("actualizado_en")
        .maybeSingle()
        .then(({ data }) => {
          const t = data?.actualizado_en ? new Date(data.actualizado_en).getTime() : 0;
          if (t && Date.now() - t > 10 * 60 * 1000) supabase.functions.invoke("johnster", { body: {} }).then(cargarJohnster);
        })
    );
  }, []);
  // Jalar para actualizar: trae de nuevo los datos del bot.
  useAlRecargar(() => {
    supabase.functions.invoke("johnster", { body: {} }).then(cargarJohnster);
  });

  const month = months[monthKey];
  const week = month?.weeks[weekIndex];
  useEffect(() => {
    if (johnster) onSincronizar?.(monthKey, weekIndex, johnster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [johnster, monthKey, weekIndex]);

  const enBot = useMemo(
    () =>
      johnster && month && week
        ? gastosEnJohnster(
            DAYS.map((d) => ({ dia: d, fecha: dateForDay(monthKey, weekIndex, month, d), day: week.days[d] })),
            johnster,
            empleados
          )
        : null,
    [johnster, month, week, monthKey, weekIndex, empleados]
  );

  if (!month || !week) return null;

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const g = computeWeekGastos(week);
  const auto = estadoAutomatico(weekStartDate);
  const sinCategoria = g.perDay.reduce((n, d) => n + d.items.filter((x) => pasaFiltro(x, "sinCategoria", auto)).length, 0);
  const filtro: Filtro = filtroElegido ?? (g.countPendiente > 0 ? "pendientes" : "todos");
  const filtros: { key: Filtro; label: string; n: number }[] = [
    { key: "todos", label: "Todos", n: g.countTotal },
    { key: "pendientes", label: "Pendientes", n: g.countPendiente },
    { key: "sinCategoria", label: "Sin categoría", n: sinCategoria },
    { key: "ingresados", label: "Ingresados", n: g.countIngresado },
  ];
  const dias = g.perDay.map((d) => ({ ...d, visibles: d.items.filter((x) => pasaFiltro(x, filtro, auto)) }));
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
        auto={auto}
        enBot={enBot}
        botSemana={
          johnster
            ? johnster.gastos.filter((g) => g.fecha >= weekStartDate && g.fecha <= addDaysIso(weekStartDate, 6))
            : null
        }
        onVerTicket={(id, titulo, monto) => setViendo({ pedido: { id }, titulo, monto })}
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
      {auto ? (
        <p className="hint">
          El estado sale de Johnster: <strong>Ingresado</strong> = está en el bot con su ticket (o con tu justificación "sin ticket"); los de
          nómina, comida de empleado y retiros no piden ticket. La categoría se elige aquí.
        </p>
      ) : (
        <p className="hint">
          Elige la categoría de cada gasto antes de confirmarlo. Una vez ingresado, la categoría queda bloqueada — para cambiarla,
          vuelve a marcarlo como pendiente.
        </p>
      )}

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
            : `${cuantosVisibles} ${filtro === "ingresados" ? (cuantosVisibles === 1 ? "ingresado" : "ingresados") : cuantosVisibles === 1 ? "pendiente" : "pendientes"} · ${money(montoVisible)}${filtro !== "ingresados" && !auto ? " — al confirmar cada uno, se quita de esta lista." : ""}`}
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
                  const abierto = abiertos[item.id] ?? item.estado === "pendiente";
                  const categoria = GASTO_CATEGORIAS.find((c) => c.value === item.categoria);
                  const bot = enBot?.get(item.id);
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
                          <button
                            type="button"
                            className="gasto-acordeon"
                            aria-expanded={abierto}
                            onClick={() => setAbiertos((a) => ({ ...a, [item.id]: !abierto }))}
                          >
                            <span className="gasto-acordeon-concepto">{item.concepto || "Gasto sin concepto"}</span>
                            <span className="gasto-acordeon-monto">{money(item.total)}</span>
                            <ChevronDown size={16} className={`gasto-acordeon-flecha ${abierto ? "abierto" : ""}`} />
                          </button>
                          <div className="gasto-acordeon-datos">
                            <span>{etiquetaFecha}</span>
                            <span>{categoria ? categoria.label : "Sin categoría"}</span>
                            {item.meseroNombre && <span>Corte de {item.meseroNombre}</span>}
                            {auto ? (
                              <>
                                {item.estado === "ingresado" ? (
                                  <span className="ok">
                                    <Check size={11} /> Ingresado{item.sinTicket ? " · sin ticket" : ""}
                                  </span>
                                ) : (
                                  <span className={`gasto-razon ${item.estadoBot === "no-esta" || item.estadoBot === "diferente" ? "categoria" : "confirmar"}`}>
                                    {item.estadoBot ? RAZON[item.estadoBot] : "Pendiente"}
                                  </span>
                                )}
                                {!item.categoria && <span className="gasto-razon categoria">Falta categoría</span>}
                                {bot?.comprobante && (
                                  <button
                                    type="button"
                                    className="gasto-ticket"
                                    onClick={() => setViendo({ pedido: { id: bot.id }, titulo: item.concepto, monto: bot.monto })}
                                  >
                                    <Receipt size={12} /> Ver ticket
                                  </button>
                                )}
                              </>
                            ) : item.estado === "ingresado" ? (
                              <span className="ok">
                                <Check size={11} /> Ingresado
                              </span>
                            ) : (
                              <span className={`gasto-razon ${item.categoria ? "confirmar" : "categoria"}`}>
                                {item.categoria ? "Falta confirmar" : "Falta categoría"}
                              </span>
                            )}
                            {enBot && !auto &&
                              (bot?.comprobante ? (
                                <button
                                  type="button"
                                  className="gasto-ticket"
                                  onClick={() => setViendo({ pedido: { id: bot.id }, titulo: item.concepto, monto: bot.monto })}
                                >
                                  <Receipt size={12} /> Ver ticket
                                </button>
                              ) : (
                                <span className="sin-ticket">{bot ? "Sin ticket en el bot" : "No está en el bot"}</span>
                              ))}
                          </div>
                          {abierto && (
                            <div className="gasto-acordeon-detalle">
                              {bot && (bot.fecha !== fecha || Math.abs(bot.monto - item.total) > 0.009 || bot.concepto.trim().toLowerCase() !== item.concepto.trim().toLowerCase()) && (
                                <p className="hint gasto-row-hint">
                                  En Johnster: “{bot.concepto}” · {money(bot.monto)}
                                  {bot.fecha !== fecha ? ` · ${formatShortDayDate(bot.fecha)}` : ""}
                                </p>
                              )}
                              {!auto && item.estado === "pendiente" && item.categoria && (
                                <p className="hint gasto-row-hint">Sube el comprobante al bot y toca Confirmar.</p>
                              )}
                              {auto && item.sinTicket && (
                                <p className="hint gasto-row-hint gasto-sin-ticket">
                                  ✎ Sin ticket: “{item.sinTicket}”{" "}
                                  <button type="button" className="link-btn" onClick={() => onSinTicket?.(monthKey, weekIndex, d.day, item.id, undefined)}>
                                    Quitar
                                  </button>
                                </p>
                              )}
                              {auto && item.estadoBot === "sin-ticket" && !item.sinTicket && onSinTicket &&
                                (justificando?.id === item.id ? (
                                  <div className="gc-j-escribir">
                                    <textarea
                                      className="text-input"
                                      rows={2}
                                      placeholder="¿Por qué no tiene ticket? Ej. la central no da ticket"
                                      value={justificando.texto}
                                      onChange={(e) => setJustificando({ id: item.id, texto: e.target.value })}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      disabled={!justificando.texto.trim()}
                                      onClick={() => {
                                        onSinTicket(monthKey, weekIndex, d.day, item.id, justificando.texto.trim());
                                        setJustificando(null);
                                      }}
                                    >
                                      Aceptar sin ticket
                                    </button>
                                  </div>
                                ) : (
                                  <button type="button" className="gasto-sin-ticket-btn" onClick={() => setJustificando({ id: item.id, texto: "" })}>
                                    ✎ Subir sin ticket · anotar por qué
                                  </button>
                                ))}
                              <div className="gasto-row-controls">
                                <select
                                  className="categoria-select"
                                  value={item.categoria || ""}
                                  disabled={!auto && item.estado === "ingresado"}
                                  onChange={(e) => onSetCategoria(monthKey, weekIndex, d.day, item.id, e.target.value as GastoCategoria | "")}
                                >
                                  <option value="">Sin categoría</option>
                                  {GASTO_CATEGORIAS.map((c) => (
                                    <option key={c.value} value={c.value}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                                {!auto && (
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
                                )}
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
                                <button
                                  type="button"
                                  className="link-btn gasto-editar"
                                  onClick={() => setEditing({ id: item.id, concepto: item.concepto, total: String(item.total) })}
                                >
                                  <Pencil size={13} /> Editar concepto o monto
                                </button>
                              </div>
                              {item.meseroCutId && (
                                <p className="hint gasto-row-hint">
                                  Restado del corte de {item.meseroNombre || "un mesero"} este día — si lo mueves o editas el monto, su
                                  total de este día se recalcula.
                                </p>
                              )}
                            </div>
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

      {viendo && <VerComprobante {...viendo} onClose={() => setViendo(null)} />}
      <div className="week-total-row">
        <span>Total semanal</span>
        <strong>{money(g.totalMonto)}</strong>
      </div>
    </Sheet>
  );
}
