import {
  addDaysIso, computeNominaTotalHastaHoy, computeVentaTrend, dateForDay, formatWeekRange, META_NOMINA_PCT, META_NOMINA_VERDE_PCT, money, resolveWeekStartDate,
  round2, todayIso,
} from "./dataModel";
import { computeTendenciasSemana, lunesDe } from "./tendencias";
import { calcularNominaVenta } from "./nominaVenta";
import { DAYS, GASTO_CATEGORIAS } from "./types";
import type {
  DayName, EmpleadoEntry, Gasto, HorarioMonthData, MeseroCatalogEntry, MonthData, MontoFijoSemanal, WeekTrendPoint,
} from "./types";

// Revisiones automáticas de Negocio > Tendencias: qué está incompleto, qué
// salió fuera de lo normal y qué tendencia conviene ver, más una
// calificación por tarjeta para que suban solas las que traen algo raro.
// "Fuera de lo normal" = ±25% contra el mismo día/semana de las semanas
// anteriores; con menos de 3 semanas de historial casi no se marca nada,
// para no dar falsas alarmas.

export const UMBRAL = 25; // %
const MIN_SEMANAS = 3;

export type NivelAlerta = "incompleto" | "atipico" | "tendencia";
export type TarjetaId =
  | "cierre" | "diaADia" | "semanas" | "patron" | "cobro" | "meseros" | "gastos" | "extras" | "nomina" | "efectivo" | "resultados";

const ORDEN: Record<NivelAlerta, number> = { incompleto: 0, atipico: 1, tendencia: 2 };

export interface Alerta {
  nivel: NivelAlerta;
  titulo: string;
  detalle: string;
  tarjeta?: TarjetaId;
  peso: number; // para ordenar dentro del mismo nivel
  // De semanas ya cerradas: no sale en "Para revisar" (que es solo de la
  // semana en curso), solo hace subir su tarjeta.
  soloTarjeta?: boolean;
}

export interface Relevancia {
  score: number; // 0 = sin novedades
  motivo?: string;
}

interface Dia {
  fecha: string;
  dia: DayName;
  venta: number;
  tarjetas: number;
  propina: number;
  gastos: Gasto[];
  meseros: { nombre: string; venta: number }[];
}

const NOMBRE_CORTO: Record<DayName, string> = {
  Lunes: "lunes", Martes: "martes", Miércoles: "miércoles", Jueves: "jueves", Viernes: "viernes", Sábado: "sábado", Domingo: "domingo",
};
const fechaTexto = (f: string) => {
  const d = new Date(`${f}T00:00:00`);
  return `${NOMBRE_CORTO[DAYS[(d.getDay() + 6) % 7]]} ${d.getDate()}`;
};
const pct = (a: number, b: number) => (b > 0 ? round2(((a - b) / b) * 100) : null);
const prom = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0);
const fmtPct = (n: number) => `${Math.abs(Math.round(n))}%`;
const etiquetaCategoria = (c?: string) => GASTO_CATEGORIAS.find((x) => x.value === c)?.label || "Sin categoría";

function diasPorFecha(months: Record<string, MonthData>): Map<string, Dia> {
  const mapa = new Map<string, Dia>();
  Object.keys(months)
    .sort()
    .forEach((mk) => {
      const month = months[mk];
      month.weeks.forEach((w, wi) =>
        DAYS.forEach((d) => {
          const day = w?.days?.[d];
          if (!day) return;
          const ventaMeseros = day.meseros.reduce((s, m) => s + m.venta, 0);
          const venta = round2(ventaMeseros + (day.ventaApps || 0));
          if (venta === 0 && day.gastos.length === 0) return;
          const fecha = dateForDay(mk, wi, month, d);
          mapa.set(fecha, {
            fecha,
            dia: d,
            venta,
            tarjetas: day.meseros.reduce((s, m) => s + m.tarjetas, 0),
            propina: day.meseros.reduce((s, m) => s + m.propina, 0),
            gastos: day.gastos,
            meseros: day.meseros.map((m) => ({ nombre: m.nombre, venta: m.venta })),
          });
        })
      );
    });
  return mapa;
}

// Gastos del corte como % de la venta, por categoría (sin Retiro, los
// adelantos de Nómina, Cancelaciones ni Cortesías, que van aparte).
export interface GastosVenta {
  semana: { gastos: number; venta: number; pct: number; normalPct: number | null } | null;
  categorias: { categoria: string; actual: number; pct: number; normalPct: number | null; sube: boolean; baja: boolean }[];
  suben: { categoria: string; actual: number; pct: number; normalPct: number; normalMonto: number; top: { concepto: string; total: number; fecha: string }[] }[];
  cerradas: { label: string; gastos: number; pct: number }[];
}
const FUERA_DE_GASTOS_VENTA = new Set(["retiro", "nomina", "cancelaciones", "cortesia"]);
export const DIFERENCIA_MIN_GASTO = 500; // $ para marcar ▲/▼

export interface AnalisisTendencias {
  alertas: Alerta[];
  relevancia: Record<TarjetaId, Relevancia>;
  meseros: { nombre: string; hoy: number; promedio: number; cambio: number | null; fecha: string }[];
  gastosVenta: GastosVenta;
  extras: { concepto: string; actual: number; promedio: number; cambio: number | null }[];
  nomina: { label: string; pct: number }[];
  efectivo: { label: string; real: number | null; esperado: number; diferencia: number | null }[];
}

export function analizarTendencias(
  months: Record<string, MonthData>,
  cerradas: WeekTrendPoint[],
  ritmo: { proyeccion: number | null; semanaPasada: number; diasContados: number; meta?: number; sinHorarios?: boolean },
  hoy = todayIso()
): AnalisisTendencias {
  const dias = diasPorFecha(months);
  const lunes = lunesDe(hoy);
  const alertas: Alerta[] = [];
  const rel = Object.fromEntries(
    (["cierre", "diaADia", "semanas", "patron", "cobro", "meseros", "gastos", "extras", "nomina", "efectivo", "resultados"] as TarjetaId[]).map((k) => [k, { score: 0 }])
  ) as Record<TarjetaId, Relevancia>;
  const subir = (id: TarjetaId, score: number, motivo: string) => {
    if (score > rel[id].score) rel[id] = { score, motivo };
  };

  const fechasConDatos = [...dias.keys()].sort();
  const primera = fechasConDatos[0];
  // Mismo día de la semana en las semanas anteriores (hasta 8) con venta.
  const historicoDe = (fecha: string) => {
    const out: Dia[] = [];
    for (let i = 1; i <= 8; i++) {
      const d = dias.get(addDaysIso(fecha, -7 * i));
      if (d && d.venta > 0) out.push(d);
    }
    return out;
  };
  // Días que ya cuentan esta semana (hoy solo si ya tiene corte).
  const diasEstaSemana = DAYS.map((_, i) => addDaysIso(lunes, i)).filter((f) => f < hoy || (f === hoy && (dias.get(f)?.venta || 0) > 0));

  // ---- Incompleto ------------------------------------------------------
  // 1. Días de esta semana (antes de hoy) sin corte, cuando ese día
  //    normalmente se vende.
  if (primera) {
    for (let i = 1; i <= 6; i++) {
      const f = addDaysIso(hoy, -i);
      if (f < lunes || f < primera) break;
      if ((dias.get(f)?.venta || 0) > 0) continue;
      const hist = historicoDe(f);
      if (hist.length >= 2) {
        alertas.push({
          nivel: "incompleto",
          titulo: `El ${fechaTexto(f)} no tiene corte capturado`,
          detalle: "Falta información: afecta la venta y las proyecciones.",
          tarjeta: "diaADia",
          peso: 100 - i,
        });
      }
    }
  }
  // 2. Días de esta semana con venta pero sin gastos, cuando ese día
  //    normalmente sí hay.
  for (let i = 0; i <= 6; i++) {
    const f = addDaysIso(hoy, -i);
    if (f < lunes) break;
    const d = dias.get(f);
    if (!d || d.venta === 0 || d.gastos.length > 0) continue;
    const hist = historicoDe(f);
    const conGastos = hist.filter((h) => h.gastos.length > 0).length;
    if (hist.length >= MIN_SEMANAS && conGastos / hist.length >= 0.75) {
      alertas.push({
        nivel: "incompleto",
        titulo: `El ${fechaTexto(f)} tiene venta pero ningún gasto`,
        detalle: "Normalmente ese día sí hay gastos: puede faltar capturarlos.",
        tarjeta: "gastos",
        peso: 80 - i,
      });
    }
  }
  // 2b. Semana en curso con venta pero sin horarios (nómina en $0).
  if (ritmo.sinHorarios && diasEstaSemana.length > 0) {
    alertas.push({
      nivel: "incompleto",
      titulo: "Esta semana no tiene horarios capturados",
      detalle: "Sin ellos la nómina y la utilidad no son reales.",
      tarjeta: "nomina",
      peso: 75,
    });
    subir("nomina", 2, "sin horarios esta semana");
  }
  // 3. Semanas cerradas recientes con margen muy alto, sin nómina o sin efectivo real.
  const ultimas = cerradas.slice(-2);
  ultimas.forEach((p) => {
    if (p.ventaTotal > 0 && p.nomina === 0) subir("nomina", 1.5, `semana del ${p.label} sin nómina`);
    const historial = cerradas.filter((x) => x.weekStartDate < p.weekStartDate).slice(-8);
    const normal = historial.length >= MIN_SEMANAS ? prom(historial.map((x) => x.margenPct)) : null;
    if ((normal !== null && p.margenPct > normal + 15) || (normal === null && p.margenPct > 75)) {
      alertas.push({
        nivel: "incompleto",
        titulo: `Semana del ${p.label}: margen de ${Math.round(p.margenPct)}%`,
        detalle: `${normal !== null ? `Tu normal es ${Math.round(normal)}%. ` : ""}Puede faltar capturar gastos o nómina.`,
        tarjeta: "resultados",
        peso: 70,
        soloTarjeta: true,
      });
      subir("resultados", 3, `margen ${Math.round(p.margenPct)}%`);
    }
    if (p.ventaTotal > 0 && p.nomina === 0) {
      alertas.push({
        nivel: "incompleto",
        titulo: `Semana del ${p.label} sin nómina`,
        detalle: "No hay horarios capturados: la utilidad sale más alta de lo real.",
        tarjeta: "nomina",
        peso: 65,
        soloTarjeta: true,
      });
    }
  });
  const ultimaCerrada = cerradas[cerradas.length - 1];
  if (ultimaCerrada && ultimaCerrada.efectivoReal === null && ultimaCerrada.ventaTotal > 0) {
    subir("efectivo", 1, "falta efectivo real");
    alertas.push({
      nivel: "incompleto",
      titulo: `Falta el efectivo real de la semana del ${ultimaCerrada.label}`,
      detalle: "Sin él no se puede saber si cuadró el efectivo.",
      tarjeta: "efectivo",
      peso: 50,
        soloTarjeta: true,
    });
  }

  // ---- Atípicos --------------------------------------------------------
  // 4. Venta de cada día de esta semana contra ese mismo día normal.
  const revisarDias = diasEstaSemana;
  let peorDia: { f: string; c: number } | null = null;
  revisarDias.forEach((f) => {
    const d = dias.get(f);
    if (!d || d.venta === 0) return;
    const hist = historicoDe(f);
    if (hist.length < MIN_SEMANAS) return;
    const normal = prom(hist.map((h) => h.venta));
    const c = pct(d.venta, normal);
    if (c === null || Math.abs(c) < UMBRAL) return;
    alertas.push({
      nivel: "atipico",
      titulo: `${fechaTexto(f).replace(/^./, (x) => x.toUpperCase())}: venta ${fmtPct(c)} ${c < 0 ? "abajo" : "arriba"} de lo normal`,
      detalle: `${money(d.venta)} vs. promedio ${money(normal)} de ese día.`,
      tarjeta: "diaADia",
      peso: Math.abs(c),
    });
    if (f >= lunes && (!peorDia || Math.abs(c) > Math.abs(peorDia.c))) peorDia = { f, c };
  });
  if (peorDia) {
    const p = peorDia as { f: string; c: number };
    subir("diaADia", Math.abs(p.c) / UMBRAL + 1, `${NOMBRE_CORTO[dias.get(p.f)!.dia]} ${p.c > 0 ? "+" : "−"}${fmtPct(p.c)}`);
  }

  // 5. Gastos de esta semana fuera de lo normal en su categoría.
  const todosGastos = [...dias.values()].flatMap((d) => d.gastos.map((g) => ({ ...g, fecha: d.fecha })));
  const porCategoria = new Map<string, number[]>();
  todosGastos.forEach((g) => {
    const k = g.categoria || "";
    if (!porCategoria.has(k)) porCategoria.set(k, []);
    porCategoria.get(k)!.push(g.total);
  });
  todosGastos
    .filter((g) => g.fecha >= lunes && g.fecha <= hoy)
    .forEach((g) => {
      const montos = porCategoria.get(g.categoria || "") || [];
      if (montos.length < 5) return;
      const normal = prom(montos);
      if (g.total >= 500 && g.total > normal * 2.5) {
        alertas.push({
          nivel: "atipico",
          titulo: `Gasto alto: “${g.concepto}” ${money(g.total)}`,
          detalle: `${fechaTexto(g.fecha)} · lo normal en ${etiquetaCategoria(g.categoria)} es ${money(normal)}.`,
          tarjeta: "gastos",
          peso: (g.total / normal) * 10,
        });
        subir("gastos", 2, `“${g.concepto}” alto`);
      }
    });

  // 6. Meseros: su venta del día contra su promedio de ese día.
  const meseros: AnalisisTendencias["meseros"] = [];
  diasEstaSemana.forEach((f) => {
    const d = dias.get(f);
    if (!d) return;
    const hist = historicoDe(f);
    d.meseros.forEach((m) => {
      const suyos = hist.map((h) => h.meseros.find((x) => x.nombre === m.nombre)?.venta).filter((v): v is number => v !== undefined && v > 0);
      if (suyos.length < MIN_SEMANAS) return;
      const normal = prom(suyos);
      const c = pct(m.venta, normal);
      meseros.push({ nombre: m.nombre, hoy: m.venta, promedio: round2(normal), cambio: c, fecha: f });
    });
  });
  meseros.sort((a, b) => Math.abs(b.cambio ?? 0) - Math.abs(a.cambio ?? 0));
  const meseroRaro = meseros.find((m) => m.cambio !== null && Math.abs(m.cambio) >= UMBRAL && m.promedio >= 1000);
  if (meseroRaro && meseroRaro.cambio !== null) {
    subir("meseros", Math.abs(meseroRaro.cambio) / UMBRAL, `${meseroRaro.nombre} ${meseroRaro.cambio > 0 ? "+" : "−"}${fmtPct(meseroRaro.cambio)}`);
    alertas.push({
      nivel: "atipico",
      titulo: `${meseroRaro.nombre} vendió ${fmtPct(meseroRaro.cambio)} ${meseroRaro.cambio < 0 ? "menos" : "más"} de lo normal`,
      detalle: `${fechaTexto(meseroRaro.fecha)}: ${money(meseroRaro.hoy)} vs. su promedio ${money(meseroRaro.promedio)}.`,
      tarjeta: "meseros",
      peso: Math.abs(meseroRaro.cambio) * 0.8,
    });
  }

  // 7. Gastos por categoría y propinas/cancelaciones/cortesías: semana en
  //    curso vs. los mismos días de semanas anteriores.
  const n = diasEstaSemana.length;
  const semanasAntes = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => addDaysIso(lunes, -7 * i)).filter((l) => DAYS.some((_, j) => (dias.get(addDaysIso(l, j))?.venta || 0) > 0));
  const mismosDias = (l: string) => DAYS.slice(0, n).map((_, j) => dias.get(addDaysIso(l, j))).filter((d): d is Dia => !!d);
  const actuales = diasEstaSemana.map((f) => dias.get(f)).filter((d): d is Dia => !!d);
  const sumaCat = (ds: Dia[], cat: string) => ds.reduce((s, d) => s + d.gastos.filter((g) => (g.categoria || "") === cat).reduce((a, g) => a + g.total, 0), 0);
  const ventaDe = (ds: Dia[]) => ds.reduce((s, d) => s + d.venta, 0);
  const categorias = [...new Set([...dias.values()].flatMap((d) => d.gastos.map((g) => g.categoria || "")))].filter(
    (c) => !FUERA_DE_GASTOS_VENTA.has(c)
  );
  const base4 = semanasAntes.slice(0, 4).map(mismosDias);
  const ventaBase = base4.reduce((s, ds) => s + ventaDe(ds), 0);
  const ventaActual = ventaDe(actuales);
  const conHistorial = n > 0 && semanasAntes.length >= MIN_SEMANAS && ventaBase > 0;
  const pctDe = (monto: number, venta: number) => (venta > 0 ? round2((monto / venta) * 100) : 0);
  const gastosVenta: GastosVenta = { semana: null, categorias: [], suben: [], cerradas: [] };
  if (n > 0 && ventaActual > 0) {
    const cats = categorias
      .map((cat) => {
        const actual = round2(sumaCat(actuales, cat));
        const p = pctDe(actual, ventaActual);
        const normalPct = ventaBase > 0 ? pctDe(base4.reduce((s, ds) => s + sumaCat(ds, cat), 0), ventaBase) : null;
        const normalMonto = normalPct !== null ? (normalPct / 100) * ventaActual : 0;
        return {
          categoria: etiquetaCategoria(cat),
          cat,
          actual,
          pct: p,
          normalPct,
          sube: conHistorial && normalPct !== null && p >= normalPct * 1.25 && actual - normalMonto >= DIFERENCIA_MIN_GASTO,
          baja: conHistorial && normalPct !== null && p <= normalPct * 0.75 && normalMonto - actual >= DIFERENCIA_MIN_GASTO,
        };
      })
      .filter((c) => c.actual > 0 || (c.normalPct ?? 0) > 0)
      .sort((a, b) => b.actual - a.actual);
    gastosVenta.categorias = cats.map(({ cat: _cat, ...c }) => c);
    const totalActual = round2(cats.reduce((s, c) => s + c.actual, 0));
    const totalBase = base4.reduce((s, ds) => s + categorias.reduce((a, cat) => a + sumaCat(ds, cat), 0), 0);
    gastosVenta.semana = { gastos: totalActual, venta: round2(ventaActual), pct: pctDe(totalActual, ventaActual), normalPct: ventaBase > 0 ? pctDe(totalBase, ventaBase) : null };
    gastosVenta.suben = cats
      .filter((c) => c.sube)
      .map((c) => ({
        categoria: c.categoria,
        actual: c.actual,
        pct: c.pct,
        normalPct: c.normalPct!,
        normalMonto: round2((c.normalPct! / 100) * ventaActual),
        top: actuales
          .flatMap((d) => d.gastos.filter((g) => (g.categoria || "") === c.cat).map((g) => ({ concepto: g.concepto, total: g.total, fecha: d.fecha })))
          .sort((a, b) => b.total - a.total)
          .slice(0, 3),
      }));
  }
  gastosVenta.cerradas = semanasAntes.slice(0, 4).map((l) => {
    const ds = DAYS.map((_, j) => dias.get(addDaysIso(l, j))).filter((d): d is Dia => !!d);
    const g = round2(categorias.reduce((s, cat) => s + sumaCat(ds, cat), 0));
    return { label: formatWeekRange(l), gastos: g, pct: pctDe(g, ventaDe(ds)) };
  });
  const peor = [...gastosVenta.suben].sort((a, b) => b.actual - b.normalMonto - (a.actual - a.normalMonto))[0];
  if (peor) {
    alertas.push({
      nivel: "atipico",
      titulo: `${peor.categoria} va en ${peor.pct.toFixed(1)}% de la venta`,
      detalle:
        peor.normalMonto > 0
          ? `Lo normal es ${peor.normalPct.toFixed(1)}%: ${money(round2(peor.actual - peor.normalMonto))} de más esta semana.`
          : `Normalmente no hay gastos de ${peor.categoria} en estos días: ${money(peor.actual)} esta semana.`,
      tarjeta: "gastos",
      peso: 30 + (peor.actual - peor.normalMonto) / 100,
    });
    subir("gastos", 2.5, `${peor.categoria} ${peor.pct.toFixed(1)}% (normal ${peor.normalPct.toFixed(1)}%)`.replace(" (normal 0.0%)", ""));
  }
  const extrasDef: { concepto: string; valor: (ds: Dia[]) => number }[] = [
    { concepto: "Propinas", valor: (ds) => ds.reduce((s, d) => s + d.propina, 0) },
    { concepto: "Cancelaciones", valor: (ds) => sumaCat(ds, "cancelaciones") },
    { concepto: "Cortesías", valor: (ds) => sumaCat(ds, "cortesia") },
  ];
  const extras = extrasDef.map((e) => {
    const actual = round2(e.valor(actuales));
    const promedio = round2(prom(semanasAntes.slice(0, 4).map((l) => e.valor(mismosDias(l)))));
    return { concepto: e.concepto, actual, promedio, cambio: pct(actual, promedio) };
  });
  if (n > 0 && semanasAntes.length >= MIN_SEMANAS) {
    extras.forEach((e) => {
      if (e.cambio === null || Math.abs(e.cambio) < UMBRAL || Math.max(e.actual, e.promedio) < 300) return;
      subir("extras", Math.abs(e.cambio) / UMBRAL, `${e.concepto} ${e.cambio > 0 ? "+" : "−"}${fmtPct(e.cambio)}`);
      if (e.concepto !== "Propinas" && e.cambio > 0) {
        alertas.push({
          nivel: "atipico",
          titulo: `${e.concepto} ${fmtPct(e.cambio)} arriba de lo normal esta semana`,
          detalle: `${money(e.actual)} vs. ${money(e.promedio)} en los mismos días.`,
          tarjeta: "extras",
          peso: e.cambio * 0.7,
        });
      }
    });
  }

  // 8. Efectivo real vs. esperado (semanas cerradas).
  const efectivo = cerradas.slice(-4).reverse().map((p) => ({
    label: p.label,
    real: p.efectivoReal,
    esperado: p.efectivoEsperado,
    diferencia: p.efectivoReal === null ? null : round2(p.efectivoReal - p.efectivoEsperado),
  }));
  const descuadre = efectivo[0];
  if (descuadre && descuadre.diferencia !== null && Math.abs(descuadre.diferencia) >= Math.max(200, descuadre.esperado * 0.01)) {
    subir("efectivo", 2, `${descuadre.diferencia < 0 ? "faltan" : "sobran"} ${money(Math.abs(descuadre.diferencia))}`);
    alertas.push({
      nivel: "atipico",
      titulo: `Efectivo de la semana del ${descuadre.label}: ${descuadre.diferencia < 0 ? "faltan" : "sobran"} ${money(Math.abs(descuadre.diferencia))}`,
      detalle: `Real ${money(descuadre.real ?? 0)} vs. esperado ${money(descuadre.esperado)}.`,
      tarjeta: "efectivo",
      peso: 60,
        soloTarjeta: true,
    });
  }

  // ---- Tendencias --------------------------------------------------------
  const ventas = cerradas.map((p) => p.ventaTotal);
  if (ventas.length >= 4) {
    const ult = ventas.slice(-4);
    const cambios = [1, 2, 3].map((i) => pct(ult[i], ult[i - 1]) ?? 0);
    const bajando = cambios.every((c) => c < 0);
    const subiendo = cambios.every((c) => c > 0);
    if (bajando || subiendo) {
      alertas.push({
        nivel: "tendencia",
        titulo: `3 semanas seguidas ${bajando ? "bajando" : "subiendo"} la venta`,
        detalle: cambios.map((c) => `${c > 0 ? "+" : "−"}${Math.abs(Math.round(c * 10) / 10)}%`).join(", "),
        tarjeta: "semanas",
        peso: bajando ? 40 : 20,
        soloTarjeta: true,
      });
      subir("semanas", 1.5, bajando ? "3 semanas bajando" : "3 semanas subiendo");
    }
    const ultimaVar = cambios[2];
    if (Math.abs(ultimaVar) >= 10) subir("semanas", Math.abs(ultimaVar) / 10, `última semana ${ultimaVar > 0 ? "+" : "−"}${fmtPct(ultimaVar)}`);
  }
  if (ultimaCerrada && ultimaCerrada.gastosOperativosPct > 42) {
    alertas.push({
      nivel: "tendencia",
      titulo: `Gastos operativos en ${Math.round(ultimaCerrada.gastosOperativosPct)}% de la venta`,
      detalle: `Semana del ${ultimaCerrada.label}: arriba de la meta de 42%.`,
      tarjeta: "resultados",
      peso: 35,
        soloTarjeta: true,
    });
    subir("resultados", 1.5, `gastos operativos ${Math.round(ultimaCerrada.gastosOperativosPct)}%`);
  }
  const nomina = cerradas.slice(-6).map((p) => ({ label: p.label, pct: round2(p.nominaPct) }));
  if (nomina.length >= 3) {
    const [a, b, c] = nomina.slice(-3).map((x) => x.pct);
    if (a > 0 && c > b && b > a && c - a >= 3) {
      alertas.push({
        nivel: "tendencia",
        titulo: `La nómina sube como % de la venta`,
        detalle: `${a}% → ${b}% → ${c}% en las últimas 3 semanas.`,
        tarjeta: "nomina",
        peso: 30,
        soloTarjeta: true,
      });
      subir("nomina", 1.5, `nómina ${c}%`);
    }
  }
  if (ritmo.proyeccion !== null && ritmo.diasContados >= 3 && ritmo.diasContados < 7) {
    const vsPasada = pct(ritmo.proyeccion, ritmo.semanaPasada);
    if (vsPasada !== null && vsPasada <= -10) {
      alertas.push({
        nivel: "tendencia",
        titulo: `Al ritmo actual la semana cerraría ${fmtPct(vsPasada)} abajo de la pasada`,
        detalle: `${money(ritmo.proyeccion)} vs. ${money(ritmo.semanaPasada)}.`,
        tarjeta: "cierre",
        peso: 25,
      });
      subir("cierre", Math.abs(vsPasada) / 10, `${fmtPct(vsPasada)} vs. semana pasada`);
    }
    if (ritmo.meta) {
      const vsMeta = pct(ritmo.proyeccion, ritmo.meta);
      if (vsMeta !== null && vsMeta <= -10) {
        alertas.push({
          nivel: "tendencia",
          titulo: `Al ritmo actual quedarías ${fmtPct(vsMeta)} abajo de la meta`,
          detalle: `${money(ritmo.proyeccion)} vs. meta ${money(ritmo.meta)}.`,
          peso: 24,
        });
      }
    }
  }

  const deLaSemana = alertas.filter((x) => !x.soloTarjeta);
  deLaSemana.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel] || b.peso - a.peso);
  return { alertas: deLaSemana, relevancia: rel, meseros, gastosVenta, extras, nomina, efectivo };
}

// Todo lo de Negocio > Tendencias de una vez (también lo usa Inicio):
// semanas ya cerradas, la semana en curso y sus revisiones.
export function calcularTendencias(
  months: Record<string, MonthData>,
  horarios: Record<string, HorarioMonthData>,
  empleados: EmpleadoEntry[],
  meseros: MeseroCatalogEntry[],
  montosFijos: MontoFijoSemanal[] | undefined,
  meta: number | undefined,
  hoy = todayIso()
) {
  // Solo semanas ya cerradas: la semana en curso va aparte, comparada por
  // los mismos días (si no, siempre parecería una caída).
  const puntos = computeVentaTrend(months, horarios, empleados, meseros, montosFijos).filter(
    (p) => addDaysIso(p.weekStartDate, 6) < hoy
  );
  const t = computeTendenciasSemana(months, hoy);
  // ¿La semana en curso ya tiene horarios? (si no, su nómina sale en $0).
  const semanaActual = Object.keys(months).flatMap((mk) =>
    [0, 1, 2, 3].filter((wi) => resolveWeekStartDate(mk, wi, months[mk]) === t.lunes).map((wi) => ({ mk, wi }))
  )[0];
  const sinHorarios =
    !!semanaActual &&
    empleados.length > 0 &&
    computeNominaTotalHastaHoy(
      semanaActual.mk,
      semanaActual.wi,
      months[semanaActual.mk],
      horarios[semanaActual.mk]?.weeks?.[semanaActual.wi] ?? null,
      empleados
    ) === 0;
  const a = analizarTendencias(months, puntos, {
    proyeccion: t.proyeccionRitmo,
    semanaPasada: t.semanaPasadaTotal,
    diasContados: t.diasContados,
    meta,
    sinHorarios,
  }, hoy);
  // Nómina vs. venta (meta 15–16%): arriba de 16% esta semana sale en
  // "Para revisar" y sube su tarjeta; entre 15 y 16%, solo sube la tarjeta.
  const nv = calcularNominaVenta(months, horarios, empleados, puntos, t);
  if (nv.semana && nv.semana.diasContados >= 2) {
    const p = nv.semana.pct;
    if (p > META_NOMINA_PCT) {
      a.alertas.push({
        nivel: "tendencia",
        titulo: `La nómina va en ${p.toFixed(1)}% de la venta`,
        detalle: `Arriba de la meta de ${META_NOMINA_VERDE_PCT}–${META_NOMINA_PCT}% esta semana.`,
        tarjeta: "nomina",
        peso: 45,
      });
      a.alertas.sort((x, y) => ORDEN[x.nivel] - ORDEN[y.nivel] || y.peso - x.peso);
      if (2 > a.relevancia.nomina.score) a.relevancia.nomina = { score: 2, motivo: `nómina ${p.toFixed(1)}%` };
    } else if (p > META_NOMINA_VERDE_PCT && 1 > a.relevancia.nomina.score) {
      a.relevancia.nomina = { score: 1, motivo: `nómina ${p.toFixed(1)}%` };
    }
  }
  return { puntos, t, a, nv };
}
