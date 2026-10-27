import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { TOLERANCIA, type JohnsterDatos } from "../../lib/cuadrar";
import { avanceSemana } from "../../lib/avanceImage";
import { Field } from "../ui";
import {
  META_GASTOS_OPERATIVOS_PCT, addDaysIso, computeDashboardReport, computeNominaSemana, computeWeekSummary, dateForDay, computeNominaTotalHastaHoy,
  formatShortDayDate, formatWeekRange, round2, isoWeekNumber, money, resolveMontoFijo, resolveWeekStartDate, todayIso, nominaPagoSemana,
  META_NOMINA_VERDE_PCT,
} from "../../lib/dataModel";
import { copyDashboardImage, resultadoSemanal } from "../../lib/dashboardImage";
import { copyAvanceImage } from "../../lib/avanceImage";
import { DAY_SHORT } from "../../lib/types";
import type { EmpleadoEntry, HorarioMonthData, MeseroCatalogEntry, MonthData, MontoFijoSemanal, NominaDescuentosMonthData } from "../../lib/types";
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
  nominaDescuentos,
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
  nominaDescuentos?: Record<string, NominaDescuentosMonthData>;
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
  // Johnster: cada renglón se compara con lo mismo en el bot.
  const [johnster, setJohnster] = useState<JohnsterDatos | null>(null);
  const [actualizando, setActualizando] = useState(false);
  async function cargarJohnster() {
    const { data } = await supabase.from("johnster_datos").select("sucursal, ingresos, gastos, transferencias, actualizado_en, error").maybeSingle();
    setJohnster((data as JohnsterDatos | null) ?? null);
    return data as JohnsterDatos | null;
  }
  async function actualizarJohnster() {
    setActualizando(true);
    await supabase.functions.invoke("johnster", { body: {} });
    await cargarJohnster();
    setActualizando(false);
  }
  useEffect(() => {
    // Datos guardados antes de separar los gastos por tipo: se actualizan una vez.
    cargarJohnster().then((d) => {
      if (d?.actualizado_en && d.gastos.length > 0 && !d.gastos.some((g) => g.tipo)) actualizarJohnster();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const hoy = todayIso();
  const domingo = addDaysIso(weekStartDate, 6);
  const enCurso = hoy >= weekStartDate && hoy <= domingo;
  const diaHoy = new Date(`${hoy}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long" });
  const nominaCierre = round2(computeNominaSemana(semana, empleados).reduce((s, e) => s + e.bruto, 0));
  const nominaPago = nominaPagoSemana(week, semana, empleados, nominaDescuentos?.[monthKey]?.weeks?.[weekIndex] ?? null);
  const avance = metaVenta
    ? avanceSemana({ semana: "", venta: report.ventaTotal, ventaPresupuesto: metaVenta, gasto: report.gastosOperativos, nominaHastaHoy: nominaCalculada, nominaCierre })
    : null;

  // Johnster en la misma semana (lunes a domingo). ok = mismo monto ($5 de
  // tolerancia), falta = el bot no lo tiene, otro = otro monto.
  const conectado = !!johnster?.actualizado_en;
  const enSemana = (f: string) => f >= weekStartDate && f <= domingo;
  const sumar = (xs: number[]) => round2(xs.reduce((n, x) => n + x, 0));
  const jIngresos = (johnster?.ingresos || []).filter((i) => enSemana(i.fecha));
  const jGastos = (johnster?.gastos || []).filter((g) => enSemana(g.fecha));
  const jTransf = (johnster?.transferencias || []).filter((t) => enSemana(t.fecha));
  const jTipo = (tipo: string) => {
    const xs = jTransf.filter((t) => t.tipo === tipo);
    return xs.length ? sumar(xs.map((t) => t.monto)) : null;
  };
  const jGastoTipo = (tipo: string) => {
    const xs = jGastos.filter((g) => g.tipo === tipo);
    return xs.length ? sumar(xs.map((g) => g.monto)) : null;
  };
  type Cmp = { bot: number | null; estado: "ok" | "falta" | "otro" };
  const cmp = (tuyo: number, bot: number | null): Cmp => ({
    bot,
    estado: bot === null ? (Math.abs(tuyo) < 0.01 ? "ok" : "falta") : Math.abs(bot - tuyo) <= TOLERANCIA ? "ok" : "otro",
  });
  const jNominaEfectivo = jGastoTipo("nomina");
  const jNominaTransf = jTipo("nomina");
  const c = {
    venta: cmp(report.ventaTotal, jIngresos.length ? sumar(jIngresos.map((i) => i.venta)) : null),
    opEfectivo: cmp(report.gastosOperativosEfectivo, jGastoTipo("operacion")),
    opTransf: cmp(report.gastosOperativosTransferencia, jTipo("operacion")),
    fijos: cmp(report.gastosFijosTransferencia, jTipo("fijos")),
    didi: cmp(report.comisionDidi, jTipo("didi")),
    uber: cmp(report.comisionUber, jTipo("uber")),
    rappi: cmp(report.comisionRappi, jTipo("rappi")),
    bancaria: cmp(report.comisionTarjetas, jTipo("bancaria")),
    nomina: cmp(nominaPago.total, jNominaEfectivo === null && jNominaTransf === null ? null : sumar([jNominaEfectivo || 0, jNominaTransf || 0])),
  };
  const comparados = Object.values(c);
  const nOk = comparados.filter((x) => x.estado === "ok").length;
  const etiqueta = (x: Cmp) =>
    x.estado === "ok" ? "✓" : x.estado === "falta" ? "No está" : `${(x.bot ?? 0) > 0 ? "" : ""}Bot ${money(x.bot ?? 0)}`;
  const lineaJ = (x: Cmp, texto?: string) =>
    conectado ? (
      <span className="db-j">
        <span>{texto ?? (x.bot === null ? "No está en Johnster" : `Johnster ${money(x.bot)}`)}</span>
        <span className={`db-chip ${x.estado}`}>{etiqueta(x)}</span>
      </span>
    ) : null;
  const avisosJ = conectado
    ? [
        [c.venta, "Venta total"],
        [c.opEfectivo, "Gastos operativos en efectivo"],
        [c.opTransf, "Gastos operativos en transferencia"],
        [c.fijos, "Gastos fijos"],
        [c.didi, "Comisión DIDI"],
        [c.uber, "Comisión UBER"],
        [c.rappi, "Comisión RAPPI"],
        [c.bancaria, "Comisión bancaria"],
        [c.nomina, "Nómina"],
      ]
        .filter(([x]) => (x as Cmp).estado !== "ok")
        .map(([x, nombre]) => {
          const y = x as Cmp;
          return y.estado === "falta" ? `${nombre}: no está en Johnster.` : `${nombre}: Johnster tiene ${money(y.bot!)}.`;
        })
    : [];

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

      <div className="db-hero">
        <small>{enCurso ? "AVANCE AL MOMENTO" : "RESULTADO DE LA SEMANA"}</small>
        <h2>Sucursal Metroplex</h2>
        <p>
          Semana {isoWeekNumber(weekStartDate)} · {formatWeekRange(weekStartDate)} · {enCurso ? `hasta hoy (${diaHoy})` : "completa"}
        </p>
        {conectado && (
          <div className="db-jbar">
            <span>
              <b className={nOk === comparados.length ? "" : "mal"}>
                {nOk === comparados.length ? "✓" : "⚠"} {nOk} de {comparados.length}
              </b>{" "}
              cuadran con Johnster
            </span>
            <button type="button" disabled={actualizando} onClick={actualizarJohnster}>
              {actualizando ? "Trayendo datos…" : "Revisar de nuevo ↻"}
            </button>
          </div>
        )}
      </div>

      <div className="db-acciones">
        <button type="button" onClick={copiarImagen}>
          {copiaEstado === "copiada" ? (
            <>
              <Check size={15} /> ¡Copiada!
            </>
          ) : (
            <>
              <Copy size={15} /> Copiar resultado
            </>
          )}
        </button>
        <button type="button" onClick={copiarAvance} disabled={!metaVenta}>
          {copiaAvance === "copiada" ? (
            <>
              <Check size={15} /> ¡Copiada!
            </>
          ) : (
            <>
              <Copy size={15} /> Copiar avance
            </>
          )}
        </button>
      </div>
      {(copiaEstado === "descargada" || copiaAvance === "descargada") && <p className="hint">Tu navegador no permite copiar imágenes — se descargó el PNG.</p>}
      {!metaVenta && <p className="hint">Sin venta presupuestada: captúrala en Tendencias (meta de venta semanal) para ver el avance y copiarlo.</p>}

      <div className="db-dos">
        <div className="db-card db-dona-card">
          <span className="db-t">VENTA</span>
          {avance ? <Dona pct={avance.ventaPct} color="#22884F" /> : null}
          <strong className="db-big">{money(report.ventaTotal)}</strong>
          <span className="db-sub">{metaVenta ? `de ${money(metaVenta)} presupuestada` : "venta de la semana"}</span>
          {conectado && <span className={`db-chip ${c.venta.estado}`}>{c.venta.estado === "ok" ? `✓ Johnster ${money(c.venta.bot!)}` : c.venta.bot === null ? "No está en Johnster" : `Johnster ${money(c.venta.bot)}`}</span>}
        </div>
        <div className="db-card db-dona-card">
          <span className="db-t">GASTO OPERATIVO</span>
          <Dona pct={(report.pct.gastosOperativos / META_GASTOS_OPERATIVOS_PCT) * 100} etiqueta={`${report.pct.gastosOperativos}%`} color={gastosOperativosOk ? "#22884F" : "#C8102E"} />
          <strong className="db-big">{money(report.gastosOperativos)}</strong>
          <span className="db-sub">de la venta · tope {META_GASTOS_OPERATIVOS_PCT}%</span>
          {conectado && (
            <span className={`db-chip ${c.opEfectivo.estado === "ok" && c.opTransf.estado === "ok" ? "ok" : "otro"}`}>
              {c.opEfectivo.estado === "ok" && c.opTransf.estado === "ok" ? "✓ igual en Johnster" : "revisar en Johnster"}
            </span>
          )}
        </div>
      </div>

      <div className="db-card db-utilidad">
        <div>
          <span className="db-t">UTILIDAD</span>
          <strong className={report.utilidad < 0 ? "mal" : ""}>{money(report.utilidad)}</strong>
        </div>
        <span>
          {report.pct.utilidad}% de la venta
          <small>con nómina hasta hoy</small>
        </span>
      </div>

      <div className="db-card">
        <span className="db-t">CUENTA DE LA SEMANA{conectado ? " · TÚ VS JOHNSTER" : ""}</span>
        <div className="report-list db-lista">
        <div className="report-row">
          <span className="report-row-label">Venta total</span>
          <span className="report-row-pct">100%</span>
          <strong className="report-row-amount">{money(report.ventaTotal)}</strong>
          {lineaJ(c.venta)}
        </div>
        <button type="button" className="report-row report-row-toggle" onClick={() => setShowGastosOperativos((v) => !v)}>
          <span className="report-row-label">
            Gastos operativos <em>(meta: {META_GASTOS_OPERATIVOS_PCT}% o menos)</em>
          </span>
          <span className={`report-row-pct ${gastosOperativosOk ? "good" : "bad"}`}>{report.pct.gastosOperativos}%</span>
          <strong className={`report-row-amount ${gastosOperativosOk ? "good" : "bad"}`}>{money(report.gastosOperativos)}</strong>
          {conectado && <span className="db-j"><span>Efectivo y transferencia contra Johnster</span><span className={`db-chip ${c.opEfectivo.estado === "ok" && c.opTransf.estado === "ok" ? "ok" : "otro"}`}>{c.opEfectivo.estado === "ok" && c.opTransf.estado === "ok" ? "✓" : "revisar"}</span></span>}
          {showGastosOperativos ? <ChevronUp size={16} className="report-row-chevron" /> : <ChevronDown size={16} className="report-row-chevron" />}
        </button>
        {showGastosOperativos && (
          <>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Gastos en efectivo</span>
              <span className="report-row-pct">{report.pct.gastosOperativosEfectivo}%</span>
              <strong className="report-row-amount">{money(report.gastosOperativosEfectivo)}</strong>
              {lineaJ(c.opEfectivo)}
            </div>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Gastos en transferencia</span>
              <span className="report-row-pct">{report.pct.gastosOperativosTransferencia}%</span>
              <strong className="report-row-amount">{money(report.gastosOperativosTransferencia)}</strong>
              {lineaJ(c.opTransf)}
            </div>
          </>
        )}
        <button type="button" className="report-row report-row-toggle" onClick={() => setShowGastosFijos((v) => !v)}>
          <span className="report-row-label">Gastos fijos</span>
          <span className="report-row-pct">{report.pct.gastosFijos}%</span>
          <strong className="report-row-amount">{money(report.gastosFijos)}</strong>
          {lineaJ(c.fijos, c.fijos.bot === null ? "En transferencia: no está en Johnster" : `En transferencia · Johnster ${money(c.fijos.bot)}`)}
          {showGastosFijos ? <ChevronUp size={16} className="report-row-chevron" /> : <ChevronDown size={16} className="report-row-chevron" />}
        </button>
        {showGastosFijos && (
          <>
            <div className="report-row report-row-sub">
              <span className="report-row-label">En transferencia</span>
              <span className="report-row-pct">{report.pct.gastosFijosTransferencia}%</span>
              <strong className="report-row-amount">{money(report.gastosFijosTransferencia)}</strong>
              {lineaJ(c.fijos)}
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
          {conectado && (
            <span className="db-j">
              <span>
                DIDI {c.didi.estado === "ok" ? "✓" : "✗"} · UBER {c.uber.estado === "ok" ? "✓" : "✗"} · RAPPI {c.rappi.estado === "ok" ? "✓" : "✗"}
              </span>
              <span className={`db-chip ${[c.didi, c.uber, c.rappi].every((x) => x.estado === "ok") ? "ok" : "otro"}`}>
                {[c.didi, c.uber, c.rappi].every((x) => x.estado === "ok") ? "✓" : "revisar"}
              </span>
            </span>
          )}
          {showComisiones ? <ChevronUp size={16} className="report-row-chevron" /> : <ChevronDown size={16} className="report-row-chevron" />}
        </button>
        {showComisiones && (
          <>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Comisión DIDI</span>
              <span className="report-row-pct">{report.pct.comisionDidi}%</span>
              <strong className="report-row-amount">{money(report.comisionDidi)}</strong>
              {lineaJ(c.didi)}
            </div>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Comisión UBER</span>
              <span className="report-row-pct">{report.pct.comisionUber}%</span>
              <strong className="report-row-amount">{money(report.comisionUber)}</strong>
              {lineaJ(c.uber)}
            </div>
            <div className="report-row report-row-sub">
              <span className="report-row-label">Comisión RAPPI</span>
              <span className="report-row-pct">{report.pct.comisionRappi}%</span>
              <strong className="report-row-amount">{money(report.comisionRappi)}</strong>
              {lineaJ(c.rappi)}
            </div>
          </>
        )}
        <div className="report-row">
          <span className="report-row-label">
            Comisión bancaria <em>(3% de tarjetas)</em>
          </span>
          <span className="report-row-pct">{report.pct.comisionTarjetas}%</span>
          <strong className="report-row-amount">{money(report.comisionTarjetas)}</strong>
          {lineaJ(c.bancaria)}
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
          {lineaJ(
            c.nomina,
            `Semana: ${money(nominaPago.total)} · Johnster ${c.nomina.bot === null ? "—" : money(c.nomina.bot)} (efectivo ${money(jNominaEfectivo || 0)} + transf. ${money(jNominaTransf || 0)})`
          )}
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

      {avance && (
        <div className="db-card">
          <span className="db-t">NÓMINA · META {META_NOMINA_VERDE_PCT}% DE LA VENTA PRESUP.</span>
          <div className="db-nom-lbl">
            <span>
              Pagado al momento <b>{money(nominaCalculada)}</b>
            </span>
            <span>Presupuesto {money(avance.nominaPresupuesto)}</span>
          </div>
          <div className="db-riel">
            <i style={{ width: `${Math.min(100, (nominaCalculada / Math.max(1, avance.nominaPresupuesto)) * 100)}%` }} className="pagado" />
            <i
              style={{ width: `${Math.max(0, Math.min(100, (nominaCierre / Math.max(1, avance.nominaPresupuesto)) * 100) - Math.min(100, (nominaCalculada / Math.max(1, avance.nominaPresupuesto)) * 100))}%` }}
              className="cierre"
            />
          </div>
          <div className="db-nom-lbl">
            <span>
              Estimado al cierre <b>{money(nominaCierre)}</b>
            </span>
            <b className={avance.nominaDiferencia > 0 ? "mal" : "bien"}>{Math.round(avance.nominaCierrePct * 10) / 10}% de venta presup.</b>
          </div>
        </div>
      )}

      {[...(avance?.notas || []).map((n) => ({ color: n.color, texto: n.texto })), ...avisosJ.map((t) => ({ color: "#C8102E", texto: t }))].map((n, i) => (
        <div key={i} className="db-nota" style={{ borderLeftColor: n.color }}>
          {n.texto}
        </div>
      ))}
    </div>
  );
}

// Dona de avance (como en la imagen del avance al momento).
function Dona({ pct, color, etiqueta }: { pct: number; color: string; etiqueta?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="db-dona" style={{ background: `conic-gradient(${color} 0 ${p}%, #EDE9E2 0)` }}>
      <i>{etiqueta ?? `${Math.round(pct * 10) / 10}%`}</i>
    </div>
  );
}
