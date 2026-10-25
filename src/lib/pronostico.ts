import { addDaysIso, dateForDay, diaPorFecha, round2 } from "./dataModel";
import { esQuincena, etiquetaDe, fechaEspecial, puenteDe } from "./etiquetas";
import { DAYS } from "./types";
import type { DayData, DayName, MonthData } from "./types";

// Pronóstico de venta por día (paso 3 hacia el horario sugerido):
// 1) el día típico = la mediana de los últimos 8 días iguales "normales"
//    (sin etiquetas, festivos, fechas especiales ni puentes), con un rango
//    (cuartiles); 2) los ajustes por lo que tiene ese día (música, partido,
//    festivo, puente, quincena, …), medidos con la propia historia: cuánto
//    vendieron los días con eso contra su día típico. Con 1 caso se aplica y
//    se avisa "pocos datos"; sin casos, no se inventa: queda el día típico.

export interface DiaHistoria {
  fecha: string;
  dia: DayName;
  venta: number;
  factores: string[];
}

export interface Ajuste {
  clave: string;
  texto: string;
  pct: number; // +80 = 80% más
  casos: number;
}

export interface Pronostico {
  fecha: string;
  dia: DayName;
  esperado: number;
  bajo: number;
  alto: number;
  tipico: number;
  diasTipicos: number; // cuántos días se usaron para el típico
  ajustes: Ajuste[]; // los que se aplicaron
  sinDatos: string[]; // lo que tiene el día pero sin historia todavía
}

const DIAS_TIPICO = 8;

const ventaDe = (d: DayData | undefined) => (d ? round2(d.meseros.reduce((s, m) => s + m.venta, 0) + (d.ventaApps || 0)) : 0);

// Qué tiene un día que puede mover la venta (etiquetas y lo automático).
export function factoresDe(day: DayData | undefined, fecha: string): { clave: string; texto: string }[] {
  const out: { clave: string; texto: string }[] = [];
  (day?.etiquetas?.tipos || []).forEach((t) => out.push({ clave: t, texto: etiquetaDe(t).texto }));
  const f = fechaEspecial(fecha);
  if (f) out.push(f.tipo === "oficial" ? { clave: "oficial", texto: "Festivo oficial" } : { clave: `esp:${f.nombre}`, texto: f.nombre });
  if (puenteDe(fecha)) out.push({ clave: "puente", texto: "Puente" });
  if (esQuincena(fecha)) out.push({ clave: "quincena", texto: "Quincena" });
  return out;
}

// Todos los días con venta, con su fecha real y sus factores.
export function historiaDeVenta(months: Record<string, MonthData>): DiaHistoria[] {
  const out: DiaHistoria[] = [];
  Object.entries(months || {}).forEach(([mk, month]) =>
    (month.weeks || []).forEach((w, wi) =>
      DAYS.forEach((dia) => {
        const day = w?.days?.[dia];
        const venta = ventaDe(day);
        if (venta <= 0) return;
        const fecha = dateForDay(mk, wi, month, dia);
        out.push({ fecha, dia, venta, factores: factoresDe(day, fecha).map((x) => x.clave) });
      })
    )
  );
  // Si un día aparece en dos meses (semana que se asoma), se queda uno.
  const vistos = new Set<string>();
  return out
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .filter((d) => (vistos.has(d.fecha) ? false : (vistos.add(d.fecha), true)));
}

const cuantil = (l: number[], q: number) => {
  if (!l.length) return 0;
  const s = [...l].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
};

// El día típico de un día de la semana antes de una fecha.
function tipicoDe(historia: DiaHistoria[], dia: DayName, antesDe: string) {
  const iguales = historia.filter((h) => h.dia === dia && h.fecha < antesDe);
  const normales = iguales.filter((h) => h.factores.length === 0 || h.factores.every((f) => f === "quincena"));
  const base = (normales.length >= 3 ? normales : iguales).slice(-DIAS_TIPICO).map((h) => h.venta);
  return { tipico: cuantil(base, 0.5), bajo: cuantil(base, 0.25), alto: cuantil(base, 0.75), n: base.length };
}

// Cuánto mueve cada factor: venta del día con ese factor contra su día
// típico. Primero se mide con los días donde solo pasó eso (así no se
// mezclan: el 15 de septiembre fue quincena y también Noche Mexicana); si
// no hay, con todos los días que lo tuvieron.
function efectos(historia: DiaHistoria[], antesDe: string): Map<string, number[]> {
  const solos = new Map<string, number[]>();
  const todos = new Map<string, number[]>();
  historia
    .filter((h) => h.fecha < antesDe && h.factores.length)
    .forEach((h) => {
      const t = tipicoDe(historia, h.dia, h.fecha).tipico;
      if (!t) return;
      h.factores.forEach((f) => {
        todos.set(f, [...(todos.get(f) || []), h.venta / t]);
        if (h.factores.length === 1) solos.set(f, [...(solos.get(f) || []), h.venta / t]);
      });
    });
  const m = new Map<string, number[]>();
  todos.forEach((r, f) => m.set(f, solos.get(f)?.length ? solos.get(f)! : r));
  return m;
}

export function pronosticar(historia: DiaHistoria[], day: DayData | undefined, fecha: string, dia: DayName, hoy: string): Pronostico | null {
  const corte = fecha < hoy ? fecha : hoy;
  const t = tipicoDe(historia, dia, corte);
  if (!t.n) return null;
  const ef = efectos(historia, corte);
  const ajustes: Ajuste[] = [];
  const sinDatos: string[] = [];
  let mult = 1;
  factoresDe(day, fecha).forEach((f) => {
    const r = ef.get(f.clave);
    if (!r?.length) return void sinDatos.push(f.texto);
    const factor = cuantil(r, 0.5);
    ajustes.push({ clave: f.clave, texto: f.texto, pct: Math.round((factor - 1) * 100), casos: r.length });
    mult *= factor;
  });
  // Entre más ajustes con pocos casos, más ancho el rango.
  const incierto = ajustes.some((a) => a.casos < 3) ? 0.1 : 0;
  return {
    fecha,
    dia,
    tipico: Math.round(t.tipico),
    diasTipicos: t.n,
    esperado: Math.round(t.tipico * mult),
    bajo: Math.round(t.bajo * mult * (1 - incierto)),
    alto: Math.round(t.alto * mult * (1 + incierto)),
    ajustes,
    sinDatos,
  };
}

// Pronóstico de los 7 días de una semana del corte (desde su lunes).
export function pronosticoSemana(months: Record<string, MonthData>, monthKey: string, weekIndex: number, hoy: string) {
  const month = months[monthKey];
  if (!month) return [];
  const historia = historiaDeVenta(months);
  return DAYS.map((dia) => {
    const fecha = dateForDay(monthKey, weekIndex, month, dia);
    const day = month.weeks?.[weekIndex]?.days?.[dia];
    return { dia, fecha, pronostico: pronosticar(historia, day, fecha, dia, hoy), real: ventaDe(day) };
  });
}

// Pronóstico de 7 días desde un lunes, aunque esa semana todavía no exista
// en el corte (ej. la semana que viene en un mes sin crear).
export function pronosticoDesdeLunes(months: Record<string, MonthData>, lunes: string, hoy: string) {
  const historia = historiaDeVenta(months);
  return DAYS.map((dia, i) => {
    const fecha = addDaysIso(lunes, i);
    const day = diaPorFecha(months, fecha) || undefined;
    return { dia, fecha, pronostico: pronosticar(historia, day, fecha, dia, hoy), real: ventaDe(day) };
  });
}

// Pronóstico de un día suelto (para Corte e Inicio).
export function pronosticoDia(months: Record<string, MonthData>, day: DayData | undefined, fecha: string, dia: DayName, hoy: string) {
  return pronosticar(historiaDeVenta(months), day, fecha, dia, hoy);
}

export const miles = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`);
export { addDaysIso };
