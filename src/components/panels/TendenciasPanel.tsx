import { ArrowLeft, ChartLine, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Empty } from "../ui";
import { computeVentaProyeccion, computeVentaTrend, money, round2 } from "../../lib/dataModel";
import type { EmpleadoEntry, HorarioMonthData, MeseroCatalogEntry, MonthData, WeekTrendPoint } from "../../lib/types";

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
}: {
  onBack: () => void;
  months: Record<string, MonthData>;
  horarios: Record<string, HorarioMonthData>;
  empleados: EmpleadoEntry[];
  meseros: MeseroCatalogEntry[];
}) {
  const puntos = computeVentaTrend(months, horarios, empleados, meseros);
  const proyeccion = computeVentaProyeccion(puntos);

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Tendencias</h2>
      <p className="hint">
        Comparativo semana tras semana de todo tu historial capturado, con una proyección de venta para la próxima semana —
        para ver la salud del negocio y tomar mejores decisiones.
      </p>

      {puntos.length === 0 ? (
        <Empty
          icon={<ChartLine size={26} strokeWidth={1.3} />}
          text="Aún no hay semanas con venta capturada. En cuanto registres cortes, aquí vas a poder comparar semana a semana y ver una proyección."
        />
      ) : (
        <>
          {proyeccion && <ProyeccionCard proyeccion={proyeccion} />}
          <KpiGrid puntos={puntos} />
          <VentaChartCard puntos={puntos} proyeccion={proyeccion} />
          <TablaSemanas puntos={puntos} />
        </>
      )}
    </div>
  );
}

function ProyeccionCard({
  proyeccion,
}: {
  proyeccion: { monto: number; confiable: boolean; semanasBase: number; tendenciaSemanal: number };
}) {
  return (
    <div className={`tendencias-proyeccion ${proyeccion.confiable ? "" : "poco-confiable"}`}>
      <span className="tendencias-proyeccion-label">Proyección de venta · próxima semana</span>
      <strong className="tendencias-proyeccion-monto">{money(proyeccion.monto)}</strong>
      <span className="tendencias-proyeccion-sub">
        {proyeccion.confiable
          ? `Basada en tus últimas ${proyeccion.semanasBase} semanas, con una tendencia promedio de ${
              proyeccion.tendenciaSemanal >= 0 ? "+" : ""
            }${money(proyeccion.tendenciaSemanal)} por semana.`
          : `Todavía es poco confiable — solo tienes ${proyeccion.semanasBase} semana${
              proyeccion.semanasBase > 1 ? "s" : ""
            } capturada${proyeccion.semanasBase > 1 ? "s" : ""}. Con 3 o más semanas la proyección mejora bastante.`}
      </span>
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
