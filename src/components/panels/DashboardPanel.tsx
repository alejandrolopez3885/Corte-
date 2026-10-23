import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Field } from "../ui";
import {
  META_GASTOS_OPERATIVOS_PCT, addDaysIso, computeDashboardReport, computeNominaSemana, computeWeekSummary, dateForDay, computeNominaTotalHastaHoy,
  formatShortDayDate, formatWeekRange, round2, isoWeekNumber, money, resolveMontoFijo, resolveWeekStartDate, todayIso,
} from "../../lib/dataModel";
import { copyDashboardImage, resultadoSemanal } from "../../lib/dashboardImage";
import { copyAvanceImage } from "../../lib/avanceImage";
import { DAY_SHORT } from "../../lib/types";
import type { EmpleadoEntry, HorarioMonthData, MeseroCatalogEntry, MonthData, MontoFijoSemanal } from "../../lib/types";
import { TituloPagina } from "../BarraTitulo";

// Categorías donde además del total conviene ver el detalle de cada gasto
// que lo compone (concepto por concepto), porque agrupan cosas variadas.
// Cancelaciones también, pero ahí el desglose es por mesero (nombre y
// total), no gasto por gasto — ver computeDashboardReport.
const EXPANDABLE_CATEGORIAS = new Set(["otro", "mantenimiento", "nomina", "cancelaciones"]);

export function DashboardPanel({
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  empleados,
  horarios,
  meseros,
  montosFijos,
  metaVenta,
  onGoToNomina,
}: {
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  empleados: EmpleadoEntry[];
  horarios: Record<string, HorarioMonthData>;
  meseros: MeseroCatalogEntry[];
  montosFijos?: MontoFijoSemanal[];
  // Venta presupuestada de la semana: la meta de venta semanal de
  // Tendencias (se captura solo ahí).
  metaVenta?: number;
  onGoToNomina: () => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [showComisiones, setShowComisiones] = useState(false);
  const [showGastosOperativos, setShowGastosOperativos] = useState(false);
  const [showGastosFijos, setShowGastosFijos] = useState(false);
  const [expandedCategorias, setExpandedCategorias] = useState<Set<string>>(new Set());
  // Resultado del último "Copiar imagen" — se borra solo a los pocos segundos.
  const [copiaEstado, setCopiaEstado] = useState<"copiada" | "descargada" | null>(null);
  const [copiaAvance, setCopiaAvance] = useState<"copiada" | "descargada" | null>(null);

  function toggleCategoria(key: string) {
    setExpandedCategorias((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const month = months[monthKey];
  const week = month?.weeks[weekIndex];

  if (!month || !week) return null;

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const semana = horarios[monthKey]?.weeks?.[weekIndex] ?? null;
  const nominaCalculada = computeNominaTotalHastaHoy(monthKey, weekIndex, month, semana, empleados);
  const report = computeDashboardReport(week, nominaCalculada, meseros, resolveMontoFijo(montosFijos, weekStartDate));
  const gastosOperativosOk = report.pct.gastosOperativos <= META_GASTOS_OPERATIVOS_PCT;

  // Imagen para el grupo del jefe: con la venta de la semana pasada (por
  // fecha real) para comparar, y aviso si la semana todavía no termina.
  async function copiarImagen() {
    const lunesPasado = addDaysIso(weekStartDate, -7);
    let ventaPasada: number | null = null;
    Object.keys(months).forEach((mk) =>
      months[mk].weeks.forEach((w, wi) => {
        if (ventaPasada === null && w && resolveWeekStartDate(mk, wi, months[mk]) === lunesPasado) {
          const v = computeWeekSummary(w).ventaTotal;
          if (v > 0) ventaPasada = v;
        }
      })
    );
    const hoy = todayIso();
    const domingo = addDaysIso(weekStartDate, 6);
    const enCurso = hoy >= weekStartDate && hoy <= domingo;
    const diaHoy = new Date(`${hoy}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long" });
    const copiada = await copyDashboardImage(
      resultadoSemanal(report, ventaPasada),
      `Semana ${isoWeekNumber(weekStartDate)} · ${formatWeekRange(weekStartDate)} ${weekStartDate.slice(0, 4)}${enCurso ? ` · hasta hoy (${diaHoy})` : ""}`,
      enCurso
        ? "Semana en curso: los números son hasta hoy. Los % son sobre la venta semanal."
        : "Los % son sobre la venta semanal. Nómina calculada con los horarios de la semana."
    );
    setCopiaEstado(copiada ? "copiada" : "descargada");
    setTimeout(() => setCopiaEstado(null), copiada ? 3000 : 6000);
  }

  // Imagen del avance a mitad de semana (lo que se llevaba en la libreta):
  // venta y gastos operativos contra la venta presupuestada, y la nómina
  // hasta hoy y al cierre según los horarios de la semana completa.
  async function copiarAvance() {
    if (!metaVenta) return;
    const hoy = todayIso();
    const enCurso = hoy >= weekStartDate && hoy <= addDaysIso(weekStartDate, 6);
    const diaHoy = new Date(`${hoy}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long" });
    const nominaCierre = round2(computeNominaSemana(semana, empleados).reduce((s, e) => s + e.bruto, 0));
    const copiada = await copyAvanceImage({
      semana: `Semana ${isoWeekNumber(weekStartDate)} · ${enCurso ? `hasta hoy (${diaHoy})` : formatWeekRange(weekStartDate)}`,
      venta: report.ventaTotal,
      ventaPresupuesto: metaVenta,
      gasto: report.gastosOperativos,
      nominaHastaHoy: nominaCalculada,
      nominaCierre,
    });
    setCopiaAvance(copiada ? "copiada" : "descargada");
    setTimeout(() => setCopiaAvance(null), copiada ? 3000 : 6000);
  }

  return (
    <div className="page-section">
      <TituloPagina titulo="Dashboard" />
      <p className="hint">
        Reporte de resultados de la semana — solo para leer. Nómina se calcula sola a partir de Horarios y el sueldo diario de
        cada quien en Personal, y muestra solo lo generado hasta hoy ({formatShortDayDate(todayIso())}) para que la Utilidad
        refleje el estado real en tiempo real; todo lo demás viene de lo que ya registraste en Corte y Proveedores.
      </p>

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
      <button type="button" className="link-btn" onClick={copiarImagen}>
        {copiaEstado === "copiada" ? (
          <>
            <Check size={15} /> ¡Copiada! Pégala en WhatsApp
          </>
        ) : (
          <>
            <Copy size={15} /> Copiar imagen del resultado
          </>
        )}
      </button>
      {copiaEstado === "descargada" && <p className="hint">Tu navegador no permite copiar imágenes — se descargó el PNG.</p>}
      {metaVenta ? (
        <button type="button" className="link-btn" onClick={copiarAvance}>
          {copiaAvance === "copiada" ? (
            <>
              <Check size={15} /> ¡Copiada! Pégala en WhatsApp
            </>
          ) : (
            <>
              <Copy size={15} /> Copiar avance al momento
            </>
          )}
        </button>
      ) : (
        <p className="hint">Sin venta presupuestada: captúrala en Tendencias (meta de venta semanal) para copiar el avance.</p>
      )}
      {copiaAvance === "descargada" && <p className="hint">Tu navegador no permite copiar imágenes — se descargó el PNG.</p>}

      <div className="report-list">
        <div className="report-row">
          <span className="report-row-label">Venta total</span>
          <span className="report-row-pct">100%</span>
          <strong className="report-row-amount">{money(report.ventaTotal)}</strong>
        </div>
        <button type="button" className="report-row report-row-toggle" onClick={() => setShowGastosOperativos((v) => !v)}>
          <span className="report-row-label">
            Gastos operativos <em>(meta: {META_GASTOS_OPERATIVOS_PCT}% o menos)</em>
          </span>
          <span className={`report-row-pct ${gastosOperativosOk ? "good" : "bad"}`}>{report.pct.gastosOperativos}%</span>
          <strong className={`report-row-amount ${gastosOperativosOk ? "good" : "bad"}`}>{money(report.gastosOperativos)}</strong>
          {showGastosOperativos ? <ChevronUp size={16} className="report-row-chevron" /> : <ChevronDown size={16} className="report-row-chevron" />}
        </button>
        {showGastosOperativos && (
          <>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Gastos en efectivo</span>
              <span className="report-row-pct">{report.pct.gastosOperativosEfectivo}%</span>
              <strong className="report-row-amount">{money(report.gastosOperativosEfectivo)}</strong>
            </div>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Gastos en transferencia</span>
              <span className="report-row-pct">{report.pct.gastosOperativosTransferencia}%</span>
              <strong className="report-row-amount">{money(report.gastosOperativosTransferencia)}</strong>
            </div>
          </>
        )}
        <button type="button" className="report-row report-row-toggle" onClick={() => setShowGastosFijos((v) => !v)}>
          <span className="report-row-label">Gastos fijos</span>
          <span className="report-row-pct">{report.pct.gastosFijos}%</span>
          <strong className="report-row-amount">{money(report.gastosFijos)}</strong>
          {showGastosFijos ? <ChevronUp size={16} className="report-row-chevron" /> : <ChevronDown size={16} className="report-row-chevron" />}
        </button>
        {showGastosFijos && (
          <>
            <div className="report-row report-row-sub">
              <span className="report-row-label">En transferencia</span>
              <span className="report-row-pct">{report.pct.gastosFijosTransferencia}%</span>
              <strong className="report-row-amount">{money(report.gastosFijosTransferencia)}</strong>
            </div>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Servicio en efectivo</span>
              <span className="report-row-pct">{report.pct.gastosFijosEfectivo}%</span>
              <strong className="report-row-amount">{money(report.gastosFijosEfectivo)}</strong>
            </div>
            {report.gastosFijosServicios.length === 0 ? (
              <p className="report-row-sub-empty hint">Sin servicios pagados en efectivo esta semana.</p>
            ) : (
              report.gastosFijosServicios.map((g, i) => (
                <div key={i} className="report-row report-row-sub report-row-servicio">
                  <span className="report-row-label">
                    {g.concepto}{" "}
                    <em>
                      · {DAY_SHORT[g.dia]} {formatShortDayDate(dateForDay(monthKey, weekIndex, month, g.dia)).split(" ")[0]}
                    </em>
                  </span>
                  <span className="report-row-pct" />
                  <strong className="report-row-amount">{money(g.total)}</strong>
                </div>
              ))
            )}
          </>
        )}
        <button type="button" className="report-row report-row-toggle" onClick={() => setShowComisiones((v) => !v)}>
          <span className="report-row-label">Comisiones de apps</span>
          <span className="report-row-pct">{report.pct.comisionesApps}%</span>
          <strong className="report-row-amount">{money(report.comisionesApps)}</strong>
          {showComisiones ? <ChevronUp size={16} className="report-row-chevron" /> : <ChevronDown size={16} className="report-row-chevron" />}
        </button>
        {showComisiones && (
          <>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Comisión DIDI</span>
              <span className="report-row-pct">{report.pct.comisionDidi}%</span>
              <strong className="report-row-amount">{money(report.comisionDidi)}</strong>
            </div>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Comisión UBER</span>
              <span className="report-row-pct">{report.pct.comisionUber}%</span>
              <strong className="report-row-amount">{money(report.comisionUber)}</strong>
            </div>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Comisión RAPPI</span>
              <span className="report-row-pct">{report.pct.comisionRappi}%</span>
              <strong className="report-row-amount">{money(report.comisionRappi)}</strong>
            </div>
          </>
        )}
        <div className="report-row">
          <span className="report-row-label">
            Comisión bancaria <em>(3% de tarjetas)</em>
          </span>
          <span className="report-row-pct">{report.pct.comisionTarjetas}%</span>
          <strong className="report-row-amount">{money(report.comisionTarjetas)}</strong>
        </div>
        {report.otrosCategorias.map((c) => {
          if (!EXPANDABLE_CATEGORIAS.has(c.key)) {
            return (
              <div className="report-row" key={c.key}>
                <span className="report-row-label">{c.label}</span>
                <span className="report-row-pct">{c.pct}%</span>
                <strong className="report-row-amount">{money(c.total)}</strong>
              </div>
            );
          }
          const expanded = expandedCategorias.has(c.key);
          return (
            <div key={c.key}>
              <button type="button" className="report-row report-row-toggle" onClick={() => toggleCategoria(c.key)}>
                <span className="report-row-label">{c.label}</span>
                <span className="report-row-pct">{c.pct}%</span>
                <strong className="report-row-amount">{money(c.total)}</strong>
                {expanded ? <ChevronUp size={16} className="report-row-chevron" /> : <ChevronDown size={16} className="report-row-chevron" />}
              </button>
              {expanded &&
                (c.items.length === 0 ? (
                  <p className="report-row-sub-empty hint">Sin gastos de {c.label.toLowerCase()} esta semana.</p>
                ) : (
                  c.items.map((item, i) => (
                    <div className="report-row report-row-sub" key={i}>
                      <span className="report-row-label">{item.concepto}</span>
                      <strong className="report-row-amount">{money(item.total)}</strong>
                    </div>
                  ))
                ))}
            </div>
          );
        })}
        <div className="report-row">
          <span className="report-row-label">
            Nómina <em>(hasta hoy)</em>
          </span>
          <span className="report-row-pct">{report.pct.nomina}%</span>
          <strong className="report-row-amount">{money(report.nomina)}</strong>
        </div>
        <div className={`report-row total ${report.utilidad < 0 ? "negative" : "positive"}`}>
          <span className="report-row-label">Utilidad</span>
          <span className="report-row-pct">{report.pct.utilidad}%</span>
          <strong className="report-row-amount">{money(report.utilidad)}</strong>
        </div>
      </div>
      <button className="link-btn" onClick={onGoToNomina}>
        Ver desglose en Nómina
      </button>
    </div>
  );
}
