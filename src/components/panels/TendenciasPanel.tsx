import { ArrowLeft, ChartLine, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Empty } from "../ui";
import { addDaysIso, computeVentaTrend, formatWeekRange, money, round2, todayIso } from "../../lib/dataModel";
import { computeTendenciasSemana, type TendenciasSemana } from "../../lib/tendencias";
import type { EmpleadoEntry, HorarioMonthData, MeseroCatalogEntry, MonthData, MontoFijoSemanal, WeekTrendPoint } from "../../lib/types";

const ACCENT = "#1F5D4C";
const WARN = "#B8752D";
const BORDER = "#DCE1D2";

interface Kpi {
  key: string;
  label: string;
  data: number[];
  actual: number;
  anterior: number | null;
  esPct?: boolean;
  invertido?: boolean; // true si subir es malo (gastos, nómina)
}

export function TendenciasPanel({
  onBack,
  months,
  horarios,
  empleados,
  meseros,
  montosFijos,
}: {
  onBack: () => void;
  months: Record<string, MonthData>;
  horarios: Record<string, HorarioMonthData>;
  empleados: EmpleadoEntry[];
  meseros: MeseroCatalogEntry[];
  montosFijos?: MontoFijoSemanal[];
}) {
  // Solo semanas ya cerradas: la semana en curso va aparte, comparada por
  // los mismos días (si no, siempre parecería una caída).
  const hoy = todayIso();
  const puntos = computeVentaTrend(months, horarios, empleados, meseros, montosFijos).filter(
    (p) => addDaysIso(p.weekStartDate, 6) < hoy
  );
  const t = computeTendenciasSemana(months, hoy);
  const proyeccion = t.proyeccionRitmo !== null && t.diasContados < 7 ? { monto: t.proyeccionRitmo } : null;

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Tendencias</h2>
      <p className="hint">
        Cómo va la semana contra las anteriores, cómo cerraría y cómo se ha movido el negocio semana a semana.
      </p>

      {t.semanasBase === 0 && t.hastaHoy === 0 ? (
        <Empty
          icon={<ChartLine size={26} strokeWidth={1.3} />}
          text="Aún no hay semanas con venta capturada. En cuanto registres cortes, aquí vas a poder comparar semana a semana y ver una proyección."
        />
      ) : (
        <>
          <SemanaEnCurso t={t} />
          <CierreSemana t={t} />
          <DiaADia t={t} />
          <SemanasCompletas t={t} />
          <PatronSemanal t={t} />
          <MezclaCobro t={t} />
          {puntos.length > 0 && (
            <>
              <h3 className="tendencias-subtitulo">Resultados por semana cerrada</h3>
              <KpiGrid puntos={puntos} />
              <VentaChartCard puntos={puntos} proyeccion={proyeccion} />
              <TablaSemanas puntos={puntos} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function pctChange(actual: number, anterior: number | null): number | null {
  if (anterior === null || anterior === 0) return null;
  return round2(((actual - anterior) / Math.abs(anterior)) * 100);
}

function KpiGrid({ puntos }: { puntos: WeekTrendPoint[] }) {
  const ultima = puntos[puntos.length - 1];
  const penultima = puntos.length > 1 ? puntos[puntos.length - 2] : null;

  const kpis: Kpi[] = [
    { key: "venta", label: "Venta total", data: puntos.map((p) => p.ventaTotal), actual: ultima.ventaTotal, anterior: penultima?.ventaTotal ?? null },
    { key: "utilidad", label: "Utilidad", data: puntos.map((p) => p.utilidad), actual: ultima.utilidad, anterior: penultima?.utilidad ?? null },
    { key: "margen", label: "Margen", data: puntos.map((p) => p.margenPct), actual: ultima.margenPct, anterior: penultima?.margenPct ?? null, esPct: true },
    { key: "gastos", label: "Gastos totales", data: puntos.map((p) => p.gastoTotal), actual: ultima.gastoTotal, anterior: penultima?.gastoTotal ?? null, invertido: true },
    { key: "nomina", label: "Nómina", data: puntos.map((p) => p.nomina), actual: ultima.nomina, anterior: penultima?.nomina ?? null, invertido: true },
  ];

  return (
    <div className="tendencias-kpis">
      {kpis.map((k) => {
        const cambio = pctChange(k.actual, k.anterior);
        const favorable = cambio === null ? null : k.invertido ? cambio <= 0 : cambio >= 0;
        return (
          <div className="tendencias-kpi" key={k.key}>
            <span className="tendencias-kpi-label">{k.label}</span>
            <strong className="tendencias-kpi-valor">{k.esPct ? `${k.actual}%` : money(k.actual)}</strong>
            {cambio !== null && (
              <span className={`tendencias-kpi-change ${favorable ? "buena" : "mala"}`}>
                {cambio > 0 ? <TrendingUp size={12} /> : cambio < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                {cambio >= 0 ? "+" : ""}
                {cambio}%
              </span>
            )}
            <Sparkline data={k.data} />
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="sparkline sparkline-empty" />;
  const w = 100;
  const h = 28;
  const min = Math.min(...data, 0);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VentaChartCard({ puntos, proyeccion }: { puntos: WeekTrendPoint[]; proyeccion: { monto: number } | null }) {
  const w = 320;
  const h = 140;
  const padY = 14;
  const padX = 6;
  const totalPoints = puntos.length + (proyeccion ? 1 : 0);
  const stepX = totalPoints > 1 ? (w - padX * 2) / (totalPoints - 1) : 0;
  const values = puntos.map((p) => p.ventaTotal).concat(proyeccion ? [proyeccion.monto] : []);
  const min = Math.min(0, ...values);
  const max = Math.max(...values) || 1;
  const range = max - min || 1;
  const toY = (v: number) => h - padY - ((v - min) / range) * (h - padY * 2);
  const toX = (i: number) => padX + i * stepX;

  const actualPoints = puntos.map((p, i) => ({ x: toX(i), y: toY(p.ventaTotal) }));
  const polyline = actualPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const last = actualPoints[actualPoints.length - 1];
  const projX = toX(puntos.length);
  const projY = proyeccion ? toY(proyeccion.monto) : 0;

  return (
    <div className="tendencias-chart-wrap">
      <div className="tendencias-chart-head">
        <strong>Venta total por semana</strong>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="tendencias-chart" preserveAspectRatio="none">
        <line x1="0" y1={toY(0)} x2={w} y2={toY(0)} stroke={BORDER} strokeWidth="1" />
        <polyline points={polyline} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {actualPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={ACCENT} />
        ))}
        {proyeccion && last && (
          <>
            <line x1={last.x} y1={last.y} x2={projX} y2={projY} stroke={WARN} strokeWidth="2" strokeDasharray="4 3" />
            <circle cx={projX} cy={projY} r="4" fill="#fff" stroke={WARN} strokeWidth="2" />
          </>
        )}
      </svg>
      <div className="tendencias-chart-legend">
        <span>
          <i className="tendencias-legend-dot" style={{ background: ACCENT }} /> Real
        </span>
        {proyeccion && (
          <span>
            <i className="tendencias-legend-dot" style={{ background: WARN }} /> Proyección
          </span>
        )}
      </div>
    </div>
  );
}

function TablaSemanas({ puntos }: { puntos: WeekTrendPoint[] }) {
  const ordenadas = [...puntos].reverse();
  return (
    <div className="tendencias-table-wrap">
      <table className="tendencias-table">
        <thead>
          <tr>
            <th>Semana</th>
            <th>Venta</th>
            <th>Gastos</th>
            <th>Nómina</th>
            <th>Utilidad</th>
            <th>Margen</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((p, i) => {
            const anterior = ordenadas[i + 1];
            const cambio = anterior ? pctChange(p.ventaTotal, anterior.ventaTotal) : null;
            return (
              <tr key={`${p.monthKey}-${p.weekIndex}`}>
                <td>
                  {p.label}
                  {cambio !== null && (
                    <span className={`tendencias-table-chip ${cambio >= 0 ? "buena" : "mala"}`}>
                      {cambio >= 0 ? "+" : ""}
                      {cambio}%
                    </span>
                  )}
                </td>
                <td>{money(p.ventaTotal)}</td>
                <td>{money(p.gastoTotal)}</td>
                <td>{money(p.nomina)}</td>
                <td>{money(p.utilidad)}</td>
                <td>{p.margenPct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const DIA_CORTO: Record<string, string> = {
  Lunes: "Lun", Martes: "Mar", Miércoles: "Mié", Jueves: "Jue", Viernes: "Vie", Sábado: "Sáb", Domingo: "Dom",
};
const INICIAL: Record<string, string> = { Lunes: "L", Martes: "M", Miércoles: "M", Jueves: "J", Viernes: "V", Sábado: "S", Domingo: "D" };

function Cambio({ v, sufijo = "%" }: { v: number | null; sufijo?: string }) {
  if (v === null) return null;
  return (
    <span className={`tend-cambio ${v > 0 ? "sube" : v < 0 ? "baja" : ""}`}>
      {v > 0 ? "▲" : v < 0 ? "▼" : "="} {Math.abs(Math.round(v * 10) / 10)}
      {sufijo}
    </span>
  );
}
const pct = (a: number, b: number) => (b > 0 ? round2(((a - b) / b) * 100) : null);

function SemanaEnCurso({ t }: { t: TendenciasSemana }) {
  const dias = t.dias.slice(0, t.diasContados);
  const rango =
    t.diasContados === 0
      ? "Todavía sin venta capturada esta semana"
      : t.diasContados === 1
        ? DIA_CORTO[dias[0].dia]
        : `${DIA_CORTO[dias[0].dia]} – ${DIA_CORTO[dias[dias.length - 1].dia]}`;
  return (
    <div className="tend-card tend-hero">
      <h4>Venta hasta hoy · {rango}</h4>
      <strong>{money(t.hastaHoy)}</strong>
      {t.diasContados > 0 && (
        <>
          <span>
            vs. mismos días semana pasada <Cambio v={pct(t.hastaHoy, t.mismosDiasSemanaPasada)} /> ({money(t.mismosDiasSemanaPasada)})
          </span>
          {t.semanasBase > 1 && (
            <span>
              vs. promedio de las últimas {t.semanasBase} semanas <Cambio v={pct(t.hastaHoy, t.mismosDiasPromedio)} /> (
              {money(t.mismosDiasPromedio)})
            </span>
          )}
        </>
      )}
    </div>
  );
}

function CierreSemana({ t }: { t: TendenciasSemana }) {
  if (t.semanasBase === 0 || t.diasContados === 7) return null;
  const restantes = t.dias.slice(t.diasContados);
  const nombreResto =
    restantes.length === 1 ? DIA_CORTO[restantes[0].dia] : `${DIA_CORTO[restantes[0].dia]}–${DIA_CORTO[restantes[restantes.length - 1].dia]}`;
  const referencia = Math.max(t.semanaPasadaTotal, t.proyeccionRitmo ?? 0, t.hastaHoy) || 1;
  const faltan = round2(t.semanaPasadaTotal - t.hastaHoy);
  return (
    <div className="tend-card">
      <h4>¿Cómo cerraría la semana?</h4>
      <div className="tend-dos">
        <div className="tend-mini">
          <span>Al ritmo actual</span>
          <strong>{t.proyeccionRitmo !== null ? money(t.proyeccionRitmo) : "—"}</strong>
          <small>
            {t.diasContados === 0
              ? "Sin venta todavía: igual a la histórica"
              : `Estos días suelen ser el ${t.pesoDiasTranscurridos}% de la semana`}
          </small>
        </div>
        <div className="tend-mini">
          <span>Histórica</span>
          <strong>{t.proyeccionHistorica !== null ? money(t.proyeccionHistorica) : "—"}</strong>
          <small>Lo que llevas + promedio de {nombreResto}</small>
        </div>
      </div>
      {t.semanaPasadaTotal > 0 && (
        <>
          <div className="tend-progreso" role="img" aria-label={`Llevas ${money(t.hastaHoy)} de ${money(t.semanaPasadaTotal)} de la semana pasada`}>
            <i style={{ width: `${Math.min(100, (t.hastaHoy / referencia) * 100)}%` }} />
            <s style={{ left: `${Math.min(100, (t.semanaPasadaTotal / referencia) * 100)}%` }} title="Semana pasada" />
          </div>
          <small className="tend-nota">
            {faltan > 0 ? (
              <>
                Para igualar la semana pasada ({money(t.semanaPasadaTotal)}) faltan <b>{money(faltan)}</b>
              </>
            ) : (
              <>Ya superaste la semana pasada ({money(t.semanaPasadaTotal)})</>
            )}
          </small>
        </>
      )}
    </div>
  );
}

function DiaADia({ t }: { t: TendenciasSemana }) {
  const max = Math.max(1, ...t.dias.flatMap((d) => [d.actual ?? d.estimado, d.semanaPasada]));
  return (
    <div className="tend-card">
      <h4>Día a día vs. semana pasada</h4>
      <div className="tend-leyenda">
        <span>
          <i className="tend-esta" /> Esta semana
        </span>
        <span>
          <i className="tend-pasada" /> Semana pasada
        </span>
        <span>
          <i className="tend-est" /> Estimado
        </span>
      </div>
      <div className="tend-barras">
        {t.dias.map((d) => {
          const esEstimado = d.actual === null;
          const valor = d.actual ?? d.estimado;
          return (
            <div key={d.dia} className="tend-grupo">
              <i
                className={esEstimado ? "tend-est" : "tend-esta"}
                style={{ height: `${(valor / max) * 100}%` }}
                title={`${d.dia} esta semana: ${money(valor)}${esEstimado ? " (estimado)" : ""}`}
              />
              <i className="tend-pasada" style={{ height: `${(d.semanaPasada / max) * 100}%` }} title={`${d.dia} semana pasada: ${money(d.semanaPasada)}`} />
            </div>
          );
        })}
      </div>
      <div className="tend-ejes">
        {t.dias.map((d) => (
          <span key={d.dia}>
            {INICIAL[d.dia]}
            <Cambio v={d.cambio} />
          </span>
        ))}
      </div>
    </div>
  );
}

function SemanasCompletas({ t }: { t: TendenciasSemana }) {
  if (t.semanas.length === 0) return null;
  return (
    <div className="tend-card">
      <h4>Semanas</h4>
      <table className="tend-tabla">
        <thead>
          <tr>
            <th>Semana</th>
            <th>Venta</th>
            <th>vs. anterior</th>
          </tr>
        </thead>
        <tbody>
          {t.semanas.map((s) => (
            <tr key={s.lunes} className={s.estimada ? "estimada" : ""}>
              <td>
                {formatWeekRange(s.lunes)}
                {s.estimada ? "*" : ""}
              </td>
              <td>{money(s.venta)}</td>
              <td>
                <Cambio v={s.cambio} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <small className="tend-nota">
        {t.semanas.some((s) => s.estimada) ? "* estimada al ritmo actual · " : ""}Promedio {t.semanasBase} semanas: {money(t.promedioSemanas)} · Mejor:{" "}
        {money(t.mejorSemana)}
      </small>
    </div>
  );
}

function PatronSemanal({ t }: { t: TendenciasSemana }) {
  const conVenta = t.patron.filter((p) => p.promedio > 0);
  if (conVenta.length === 0) return null;
  const max = Math.max(...t.patron.map((p) => p.promedio));
  const mejor = conVenta.reduce((a, b) => (b.promedio > a.promedio ? b : a));
  const peor = conVenta.reduce((a, b) => (b.promedio < a.promedio ? b : a));
  return (
    <div className="tend-card">
      <h4>Venta promedio por día de la semana</h4>
      <div className="tend-barras bajo">
        {t.patron.map((p) => (
          <div key={p.dia} className="tend-grupo">
            <i className="tend-esta" style={{ height: `${(p.promedio / max) * 100}%` }} title={`${p.dia}: ${money(p.promedio)} (${p.pct}%)`} />
          </div>
        ))}
      </div>
      <div className="tend-ejes">
        {t.patron.map((p) => (
          <span key={p.dia}>{INICIAL[p.dia]}</span>
        ))}
      </div>
      <small className="tend-nota">
        Tu mejor día: <b>{mejor.dia.toLowerCase()}</b> ({mejor.pct}% de la semana) · el más flojo: {peor.dia.toLowerCase()} ({peor.pct}%)
      </small>
    </div>
  );
}

function MezclaCobro({ t }: { t: TendenciasSemana }) {
  const { tarjetasPct, appsPct, tarjetasAntes, appsAntes } = t.mezcla;
  if (tarjetasPct === null || appsPct === null) return null;
  const pts = (a: number, b: number | null) => (b === null ? null : round2(a - b));
  return (
    <div className="tend-card">
      <h4>Cómo se cobra esta semana</h4>
      <div className="tend-dos">
        <div className="tend-mini">
          <span>Tarjetas</span>
          <strong>{tarjetasPct}%</strong>
          <Cambio v={pts(tarjetasPct, tarjetasAntes)} sufijo=" pts" />
        </div>
        <div className="tend-mini">
          <span>Apps</span>
          <strong>{appsPct}%</strong>
          <Cambio v={pts(appsPct, appsAntes)} sufijo=" pts" />
        </div>
      </div>
      <small className="tend-nota">% de la venta hasta hoy, contra los mismos días de la semana pasada.</small>
    </div>
  );
}
