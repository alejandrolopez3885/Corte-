import { useState, type ReactNode } from "react";
import { ArrowLeft, ChartLine, ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Empty } from "../ui";
import { addDaysIso, computeVentaTrend, formatWeekRange, money, round2, todayIso } from "../../lib/dataModel";
import { computeTendenciasSemana, type TendenciasSemana } from "../../lib/tendencias";
import { analizarTendencias, type Alerta, type AnalisisTendencias, type TarjetaId } from "../../lib/tendenciasAnalisis";
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

  // Solo semanas ya cerradas: la semana en curso va aparte, comparada por
  // los mismos días (si no, siempre parecería una caída).
  const hoy = todayIso();
  const puntos = computeVentaTrend(months, horarios, empleados, meseros, montosFijos).filter(
    (p) => addDaysIso(p.weekStartDate, 6) < hoy
  );
  const t = computeTendenciasSemana(months, hoy);
  const proyeccion = t.proyeccionRitmo !== null && t.diasContados < 7 ? { monto: t.proyeccionRitmo } : null;
  const a = analizarTendencias(months, puntos, {
    proyeccion: t.proyeccionRitmo,
    semanaPasada: t.semanaPasadaTotal,
    diasContados: t.diasContados,
    meta,
  }, hoy);
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
    { id: "gastos", titulo: "Gastos por categoría", contenido: a.gastosCategoria.length > 0 ? <GastosCategoria a={a} /> : null },
    { id: "extras", titulo: "Propinas, cancelaciones y cortesías", contenido: <Extras a={a} /> },
    { id: "cobro", titulo: "Cómo se cobra", contenido: tarjetasPct !== null ? <MezclaCobro t={t} /> : null },
    { id: "nomina", titulo: "Nómina como % de la venta", contenido: a.nomina.length > 0 ? <NominaPct a={a} /> : null },
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
          <ParaRevisar alertas={a.alertas} onVer={irA} />
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

function ParaRevisar({ alertas, onVer }: { alertas: Alerta[]; onVer: (id?: TarjetaId) => void }) {
  return (
    <div className="tend-card">
      <h4>
        Para revisar <span>{alertas.length || ""}</span>
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

function GastosCategoria({ a }: { a: AnalisisTendencias }) {
  return (
    <div className="tend-card">
      <h4>Gastos por categoría</h4>
      <table className="tend-tabla">
        <tbody>
          {a.gastosCategoria.map((g) => (
            <FilaComparada key={g.categoria} nombre={g.categoria} actual={g.actual} base={g.promedio} cambio={g.cambio} etiquetaBase="prom." />
          ))}
        </tbody>
      </table>
      <small className="tend-nota">En efectivo, esta semana hasta hoy contra el promedio de los mismos días.</small>
    </div>
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

function NominaPct({ a }: { a: AnalisisTendencias }) {
  const max = Math.max(1, ...a.nomina.map((n) => n.pct));
  return (
    <div className="tend-card">
      <h4>Nómina como % de la venta</h4>
      {a.nomina.map((n) => (
        <div key={n.label} className="tend-ranking" title={`${n.label}: ${n.pct}%`}>
          <span>{n.label}</span>
          <i style={{ width: `${(n.pct / max) * 100}%` }} />
          <strong>{n.pct}%</strong>
        </div>
      ))}
    </div>
  );
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
