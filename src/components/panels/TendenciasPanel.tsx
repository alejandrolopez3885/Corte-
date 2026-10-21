import { useState, type ReactNode } from "react";
import { ArrowLeft, ChartLine, ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Empty } from "../ui";
import { formatWeekRange, META_NOMINA_PCT, META_NOMINA_VERDE_PCT, money, round2, todayIso } from "../../lib/dataModel";
import { type TendenciasSemana } from "../../lib/tendencias";
import {
  calcularTendencias, DIFERENCIA_MIN_GASTO, type Alerta, type AnalisisTendencias, type GastosVenta, type TarjetaId,
} from "../../lib/tendenciasAnalisis";
import { diaCorto, semaforoNomina, ultimoDiaContado, type NominaVenta } from "../../lib/nominaVenta";
import type { EmpleadoEntry, HorarioMonthData, MeseroCatalogEntry, MonthData, MontoFijoSemanal, WeekTrendPoint } from "../../lib/types";
import { DAYS } from "../../lib/types";

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
  meta,
  onGuardarMeta,
}: {
  onBack: () => void;
  months: Record<string, MonthData>;
  horarios: Record<string, HorarioMonthData>;
  empleados: EmpleadoEntry[];
  meseros: MeseroCatalogEntry[];
  montosFijos?: MontoFijoSemanal[];
  meta?: number;
  onGuardarMeta: (meta: number | undefined) => void;
}) {
  const [abiertas, setAbiertas] = useState<Set<TarjetaId>>(new Set());
  const [verSinNovedades, setVerSinNovedades] = useState(false);

  const hoy = todayIso();
  const { puntos, t, a, nv } = calcularTendencias(months, horarios, empleados, meseros, montosFijos, meta, hoy);
  const proyeccion = t.proyeccionRitmo !== null && t.diasContados < 7 ? { monto: t.proyeccionRitmo } : null;
  // Cómo se cobra: sube si las tarjetas o apps se movieron 8 puntos o más.
  const { tarjetasPct, tarjetasAntes, appsPct, appsAntes } = t.mezcla;
  const movCobro = Math.max(
    tarjetasPct !== null && tarjetasAntes !== null ? Math.abs(tarjetasPct - tarjetasAntes) : 0,
    appsPct !== null && appsAntes !== null ? Math.abs(appsPct - appsAntes) : 0
  );
  if (movCobro >= 8) a.relevancia.cobro = { score: movCobro / 8, motivo: `cobro ${Math.round(movCobro)} pts` };

  const tarjetas: { id: TarjetaId; titulo: string; contenido: ReactNode | null }[] = [
    { id: "cierre", titulo: "¿Cómo cerraría la semana?", contenido: t.semanasBase > 0 && t.diasContados < 7 ? <CierreSemana t={t} meta={meta} /> : null },
    { id: "diaADia", titulo: "Día a día vs. semana pasada", contenido: <DiaADia t={t} /> },
    { id: "semanas", titulo: "Semanas", contenido: t.semanas.length > 0 ? <SemanasCompletas t={t} /> : null },
    { id: "meseros", titulo: "Venta por mesero", contenido: a.meseros.length > 0 ? <VentaMeseros a={a} /> : null },
    { id: "gastos", titulo: "Gastos vs. venta", contenido: a.gastosVenta.semana || a.gastosVenta.cerradas.some((c) => c.gastos > 0) ? <GastosVsVenta g={a.gastosVenta} lunes={t.lunes} diasContados={t.diasContados} /> : null },
    { id: "extras", titulo: "Propinas, cancelaciones y cortesías", contenido: <Extras a={a} /> },
    { id: "cobro", titulo: "Cómo se cobra", contenido: tarjetasPct !== null ? <MezclaCobro t={t} /> : null },
    { id: "nomina", titulo: "Nómina vs. venta", contenido: nv.semana || nv.cerradas.length > 0 ? <NominaVsVenta nv={nv} lunes={t.lunes} /> : null },
    { id: "efectivo", titulo: "Efectivo real vs. esperado", contenido: a.efectivo.length > 0 ? <Efectivo a={a} /> : null },
    { id: "patron", titulo: "Venta promedio por día de la semana", contenido: t.patron.some((p) => p.promedio > 0) ? <PatronSemanal t={t} /> : null },
    {
      id: "resultados",
      titulo: "Resultados por semana cerrada",
      contenido:
        puntos.length > 0 ? (
          <div className="tend-card">
            <h4>Resultados por semana cerrada</h4>
            <KpiGrid puntos={puntos} />
            <VentaChartCard puntos={puntos} proyeccion={proyeccion} />
            <TablaSemanas puntos={puntos} />
          </div>
        ) : null,
    },
  ];
  const disponibles = tarjetas.filter((x) => x.contenido !== null);
  // Las que traen algo fuera de lo normal suben, de mayor a menor; el resto
  // se junta abajo en "Sin novedades" (en su orden de siempre).
  const destacadas = disponibles.filter((x) => a.relevancia[x.id].score > 0).sort((x, y) => a.relevancia[y.id].score - a.relevancia[x.id].score);
  const tranquilas = disponibles.filter((x) => a.relevancia[x.id].score === 0);

  function irA(id?: TarjetaId) {
    if (!id) return;
    if (a.relevancia[id].score === 0) {
      setVerSinNovedades(true);
      setAbiertas((s) => new Set(s).add(id));
    }
    setTimeout(() => document.getElementById(`tend-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Tendencias</h2>

      {t.semanasBase === 0 && t.hastaHoy === 0 ? (
        <Empty
          icon={<ChartLine size={26} strokeWidth={1.3} />}
          text="Aún no hay semanas con venta capturada. En cuanto registres cortes, aquí vas a poder comparar semana a semana y ver una proyección."
        />
      ) : (
        <>
          <ParaRevisar alertas={a.alertas} lunes={t.lunes} onVer={irA} />
          <SemanaEnCurso t={t} meta={meta} onGuardarMeta={onGuardarMeta} />
          {destacadas.map((x) => (
            <div key={x.id} id={`tend-${x.id}`} className="tend-slot">
              <span className="tend-motivo">Subió: {a.relevancia[x.id].motivo}</span>
              {x.contenido}
            </div>
          ))}
          {tranquilas.length > 0 && (
            <div className="tend-tranquilas">
              <button className="tend-tranquilas-head" onClick={() => setVerSinNovedades((v) => !v)}>
                <strong>Sin novedades</strong>
                <span>{verSinNovedades ? "Ocultar" : `${tranquilas.length} secciones`}</span>
              </button>
              {verSinNovedades &&
                tranquilas.map((x) => (
                  <div key={x.id} id={`tend-${x.id}`}>
                    <button
                      className="tend-tranquila"
                      onClick={() =>
                        setAbiertas((s) => {
                          const n = new Set(s);
                          if (n.has(x.id)) n.delete(x.id);
                          else n.add(x.id);
                          return n;
                        })
                      }
                    >
                      <span>{x.titulo}</span>
                      <ChevronRight size={16} className={abiertas.has(x.id) ? "girado" : ""} />
                    </button>
                    {abiertas.has(x.id) && x.contenido}
                  </div>
                ))}
            </div>
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

function SemanaEnCurso({ t, meta, onGuardarMeta }: { t: TendenciasSemana; meta?: number; onGuardarMeta: (m: number | undefined) => void }) {
  const [metaTexto, setMetaTexto] = useState(meta ? String(meta) : "");
  const metaNum = Number(metaTexto.replace(/[^0-9.]/g, "")) || 0;
  const cambioMeta = metaNum !== (meta || 0);
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
      {meta ? (
        <>
          <div className="tend-progreso" role="img" aria-label={`Llevas ${money(t.hastaHoy)} de la meta ${money(meta)}`}>
            <i style={{ width: `${Math.min(100, (t.hastaHoy / meta) * 100)}%` }} />
          </div>
          <span>
            Meta {money(meta)} · llevas {Math.round((t.hastaHoy / meta) * 1000) / 10}%
            {t.proyeccionRitmo !== null && t.diasContados > 0 && t.diasContados < 7 && (
              <>
                {" "}
                · al ritmo actual cerrarías en <b>{money(t.proyeccionRitmo)}</b> ({Math.round((t.proyeccionRitmo / meta) * 100)}% de la meta)
              </>
            )}
          </span>
        </>
      ) : null}
      <div className="tend-meta">
        <input
          className="num-input"
          inputMode="decimal"
          value={metaTexto}
          onChange={(e) => setMetaTexto(e.target.value)}
          placeholder="Meta de venta semanal"
          aria-label="Meta de venta semanal"
        />
        <button className="btn-primary" disabled={!cambioMeta} onClick={() => onGuardarMeta(metaNum || undefined)}>
          Guardar
        </button>
      </div>
    </div>
  );
}

function CierreSemana({ t }: { t: TendenciasSemana; meta?: number }) {
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
      <div className="tend-barras con-etq">
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
      <div className="tend-ejes con-etq">
        {t.dias.map((d) => (
          <span key={d.dia}>
            {INICIAL[d.dia]}
            <Cambio v={d.cambio} />
          </span>
        ))}
      </div>
      {/* Venta de cada día: esta semana (vacía si todavía es estimado) y la pasada. */}
      <div className="tend-valores">
        <span className="tend-valores-etq tend-esta-txt">Esta</span>
        {t.dias.map((d) => (
          <span key={d.dia} className="tend-esta-txt">
            {d.actual !== null ? milesCorto(d.actual) : ""}
          </span>
        ))}
      </div>
      <div className="tend-valores">
        <span className="tend-valores-etq">Pasada</span>
        {t.dias.map((d) => (
          <span key={d.dia}>{d.semanaPasada > 0 ? milesCorto(d.semanaPasada) : "—"}</span>
        ))}
      </div>
    </div>
  );
}

// $12,345 → "12.3k" para que quepan los 7 días en el celular.
function milesCorto(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n));
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

const NIVEL: Record<Alerta["nivel"], { clase: string; icono: string }> = {
  incompleto: { clase: "incompleto", icono: "⚠" },
  atipico: { clase: "atipico", icono: "●" },
  tendencia: { clase: "tendencia", icono: "↗" },
};

function ParaRevisar({ alertas, lunes, onVer }: { alertas: Alerta[]; lunes: string; onVer: (id?: TarjetaId) => void }) {
  return (
    <div className="tend-card">
      <h4>
        <span className="tend-revisar-titulo">
          Para revisar <small>· semana del {formatWeekRange(lunes)}</small>
        </span>
        <span>{alertas.length || ""}</span>
      </h4>
      {alertas.length === 0 ? (
        <span className="tend-todo-ok">Todo en orden esta semana ✓</span>
      ) : (
        alertas.slice(0, 8).map((al, i) => (
          <button key={i} className={`tend-alerta ${NIVEL[al.nivel].clase}`} onClick={() => onVer(al.tarjeta)} disabled={!al.tarjeta}>
            <span className="tend-alerta-icono">{al.titulo.includes("subiendo") ? "↗" : NIVEL[al.nivel].icono}</span>
            <span className="tend-alerta-texto">
              {al.titulo}
              <small>{al.detalle}</small>
            </span>
            {al.tarjeta && <span className="tend-alerta-ver">Ver ›</span>}
          </button>
        ))
      )}
      {alertas.length > 8 && <small className="tend-nota">y {alertas.length - 8} más</small>}
    </div>
  );
}

function FilaComparada({ nombre, actual, base, cambio, etiquetaBase }: { nombre: string; actual: number; base: number; cambio: number | null; etiquetaBase: string }) {
  return (
    <tr>
      <td>{nombre}</td>
      <td>{money(actual)}</td>
      <td className="tend-tabla-suave">
        {etiquetaBase} {money(base)}
      </td>
      <td>
        <Cambio v={cambio} />
      </td>
    </tr>
  );
}

function VentaMeseros({ a }: { a: AnalisisTendencias }) {
  return (
    <div className="tend-card">
      <h4>Venta por mesero</h4>
      <table className="tend-tabla">
        <tbody>
          {a.meseros.slice(0, 10).map((m) => (
            <FilaComparada
              key={`${m.nombre}-${m.fecha}`}
              nombre={`${m.nombre} · ${DIA_CORTO[diaDe(m.fecha)]}`}
              actual={m.hoy}
              base={m.promedio}
              cambio={m.cambio}
              etiquetaBase="prom."
            />
          ))}
        </tbody>
      </table>
      <small className="tend-nota">Su venta de cada día de esta semana contra su promedio de ese mismo día.</small>
    </div>
  );
}

function diaDe(fecha: string): string {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return dias[new Date(`${fecha}T00:00:00`).getDay()];
}

function GastosVsVenta({ g, lunes, diasContados }: { g: GastosVenta; lunes: string; diasContados: number }) {
  const s = g.semana;
  const fechaCorta = (f: string) => diaCorto(DAYS[(new Date(`${f}T00:00:00`).getDay() + 6) % 7]).toLowerCase();
  return (
    <>
      {s && (
        <div className="tend-card">
          <h4>Gastos vs. venta · esta semana</h4>
          <div className="gv-hero">
            <strong>{s.pct.toFixed(1)}%</strong>
            <span>
              de la venta{s.normalPct !== null && <> · normal <b>{s.normalPct.toFixed(1)}%</b></>}
            </span>
          </div>
          <small className="tend-nota">
            {diasContados < 7 ? `Lun a ${ultimoDiaContado(lunes, diasContados)}` : "Semana completa"}: gastos del corte <b>{money(s.gastos)}</b> de{" "}
            <b>{money(s.venta)}</b> de venta.
          </small>
          {g.categorias.length > 0 && (
            <table className="tend-tabla">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Semana</th>
                  <th>% venta</th>
                  <th>Normal</th>
                </tr>
              </thead>
              <tbody>
                {g.categorias.map((c) => (
                  <tr key={c.categoria}>
                    <td>{c.categoria}</td>
                    <td>{money(c.actual)}</td>
                    <td className={c.sube ? "gv-sube" : c.baja ? "gv-baja" : ""}>
                      {c.pct.toFixed(1)}%{c.sube ? " ▲" : c.baja ? " ▼" : ""}
                    </td>
                    <td className="tend-tabla-suave">{c.normalPct === null ? "—" : `${c.normalPct.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <small className="tend-nota">
            “Normal” = esos mismos días de las últimas 4 semanas. Se marca ▲ si va 25% o más arriba de lo normal y son{" "}
            {money(DIFERENCIA_MIN_GASTO)} o más (▼ si bajó igual). Sin Retiro, adelantos de nómina, cancelaciones ni cortesías.
          </small>
        </div>
      )}
      {g.suben.length > 0 && (
        <div className="tend-card">
          <h4>Los que suben</h4>
          {g.suben.map((x) => (
            <div key={x.categoria} className="gv-sube-item">
              <strong>
                {x.categoria}: {x.pct.toFixed(1)}%{x.normalMonto > 0 ? ` vs. ${x.normalPct.toFixed(1)}% normal` : " de la venta"}
              </strong>
              <span>
                {money(x.actual)} esta semana ·{" "}
                {x.normalMonto > 0 ? `lo normal a estas alturas son ~${money(x.normalMonto)}.` : "normalmente no hay en estos días."}
              </span>
              <small>Lo más grande: {x.top.map((t) => `“${t.concepto}” ${money(t.total)} (${fechaCorta(t.fecha)})`).join(" · ")}</small>
            </div>
          ))}
        </div>
      )}
      {g.cerradas.some((c) => c.gastos > 0) && (
        <div className="tend-card">
          <h4>Gastos vs. venta · semanas cerradas</h4>
          <table className="tend-tabla">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Gastos corte</th>
                <th>% venta</th>
              </tr>
            </thead>
            <tbody>
              {g.cerradas.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  <td>{money(c.gastos)}</td>
                  <td>{c.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <small className="tend-nota">Solo gastos capturados en el corte (efectivo). Los de transferencia se ven en Resultados por semana cerrada.</small>
        </div>
      )}
    </>
  );
}

function Extras({ a }: { a: AnalisisTendencias }) {
  return (
    <div className="tend-card">
      <h4>Propinas, cancelaciones y cortesías</h4>
      <table className="tend-tabla">
        <tbody>
          {a.extras.map((e) => (
            <FilaComparada key={e.concepto} nombre={e.concepto} actual={e.actual} base={e.promedio} cambio={e.cambio} etiquetaBase="prom." />
          ))}
        </tbody>
      </table>
      <small className="tend-nota">Esta semana hasta hoy contra el promedio de los mismos días.</small>
    </div>
  );
}

// Meta de nómina 15–16%: verde hasta 15%, amarillo de 15 a 16%, rojo arriba.
const ESCALA_NOMINA = 24; // % al final de la barra
function NominaVsVenta({ nv, lunes }: { nv: NominaVenta; lunes: string }) {
  const s = nv.semana;
  const maxCerradas = Math.max(ESCALA_NOMINA * 0.75, ...nv.cerradas.map((c) => c.pct));
  return (
    <>
      {s && (
        <div className="tend-card">
          <h4>Nómina vs. venta · esta semana</h4>
          <div className="nomv-hero">
            <strong className={`sem-${semaforoNomina(s.pct)}`}>{s.pct.toFixed(1)}%</strong>
            <span className={`nomv-pill sem-${semaforoNomina(s.pct)}`}>
              {{ verde: "Dentro de la meta", amarillo: "En el límite", rojo: "Arriba de la meta" }[semaforoNomina(s.pct)]}
            </span>
          </div>
          <div className="nomv-escala" role="img" aria-label={`Nómina ${s.pct}% de la venta; meta ${META_NOMINA_VERDE_PCT} a ${META_NOMINA_PCT}%`}>
            <span style={{ width: `${(META_NOMINA_VERDE_PCT / ESCALA_NOMINA) * 100}%` }} className="v" />
            <span style={{ width: `${((META_NOMINA_PCT - META_NOMINA_VERDE_PCT) / ESCALA_NOMINA) * 100}%` }} className="a" />
            <span className="r" />
            <i style={{ left: `${Math.min(100, (s.pct / ESCALA_NOMINA) * 100)}%` }} />
          </div>
          <div className="nomv-ejes">
            <span>0%</span>
            <span>
              Meta {META_NOMINA_VERDE_PCT}–{META_NOMINA_PCT}%
            </span>
            <span>{ESCALA_NOMINA}%</span>
          </div>
          <small className="tend-nota">
            {s.diasContados < 7 ? `Lun a ${ultimoDiaContado(lunes, s.diasContados)}` : "Semana completa"}: nómina <b>{money(s.nomina)}</b> de{" "}
            <b>{money(s.venta)}</b> de venta.
            {s.diasContados < 7 && s.ventaPara16 !== null && (
              <>
                {" "}
                Para cerrar en {META_NOMINA_PCT}% la semana necesita vender <b>{money(s.ventaPara16)}</b>
                {s.proyeccion !== null ? <> (al ritmo de hoy cerraría en {money(s.proyeccion)})</> : null}
                {s.recorte !== null ? <>, o recortar ~{money(s.recorte)} de nómina</> : null}.
              </>
            )}
          </small>
        </div>
      )}
      {nv.cerradas.length > 0 && (
        <div className="tend-card">
          <h4>Nómina · semanas cerradas</h4>
          {nv.cerradas.map((c) => (
            <div key={c.label} className={`tend-ranking sem-${semaforoNomina(c.pct)}`} title={`${c.label}: ${c.pct}%`}>
              <span>{c.label}</span>
              <i style={{ width: `${(c.pct / maxCerradas) * 100}%` }} />
              <strong>{c.pct.toFixed(1)}%</strong>
            </div>
          ))}
        </div>
      )}
      {nv.semanasPorDia > 0 && (
        <div className="tend-card">
          <h4>
            Por día · promedio de {nv.semanasPorDia} {nv.semanasPorDia === 1 ? "semana" : "semanas"}
          </h4>
          <table className="tend-tabla">
            <thead>
              <tr>
                <th>Día</th>
                <th>Venta</th>
                <th>Personas</th>
                <th>Nómina</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {nv.porDia.map((d) => (
                <tr key={d.dia}>
                  <td>{diaCorto(d.dia)}</td>
                  <td>{d.venta > 0 ? money(d.venta) : "—"}</td>
                  <td>{d.personas || "—"}</td>
                  <td>{d.nomina > 0 ? money(d.nomina) : "—"}</td>
                  <td className={d.pct === null ? "" : `nomv-pct sem-${semaforoNomina(d.pct)}`}>{d.pct === null ? "—" : `${d.pct.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <small className="tend-nota">
            Nómina del día = sueldo diario de quien trabaja según el horario (doble y festivo incluidos). Venta por persona:{" "}
            {nv.porDia
              .filter((d) => d.ventaPorPersona !== null)
              .map((d) => `${diaCorto(d.dia).toLowerCase()} ${money(d.ventaPorPersona!)}`)
              .join(" · ")}
            .
          </small>
        </div>
      )}
      {nv.sugerencias.length > 0 && (
        <div className="tend-card">
          <h4>Sugerencias para el horario</h4>
          {nv.sugerencias.map((x) => (
            <div key={x.dia + x.tipo} className={`nomv-sug ${x.tipo}`}>
              <span>{x.tipo === "menos" ? "⬇" : "⬆"}</span>
              <span>{conNegritas(x.texto)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function conNegritas(texto: string): ReactNode[] {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte));
}

function Efectivo({ a }: { a: AnalisisTendencias }) {
  return (
    <div className="tend-card">
      <h4>Efectivo real vs. esperado</h4>
      <table className="tend-tabla">
        <thead>
          <tr>
            <th>Semana</th>
            <th>Real</th>
            <th>Esperado</th>
            <th>Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {a.efectivo.map((e) => (
            <tr key={e.label}>
              <td>{e.label}</td>
              <td>{e.real === null ? "—" : money(e.real)}</td>
              <td>{money(e.esperado)}</td>
              <td className={e.diferencia === null ? "" : e.diferencia < 0 ? "tend-neg" : e.diferencia > 0 ? "tend-pos" : ""}>
                {e.diferencia === null ? "sin capturar" : money(e.diferencia)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
