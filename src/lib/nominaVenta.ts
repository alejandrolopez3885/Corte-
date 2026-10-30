import { addDaysIso, computeNominaSemana, META_NOMINA_PCT, META_NOMINA_VERDE_PCT, defaultWeekStartDate, resolveWeekStartDate, round2 } from "./dataModel";
import type { TendenciasSemana } from "./tendencias";
import { DAYS } from "./types";
import type { DayName, EmpleadoEntry, HorarioMonthData, MonthData, WeekTrendPoint } from "./types";

// Negocio > Tendencias > Nómina vs. venta: la nómina (según el horario: el
// sueldo diario de quien trabaja, con dobles y festivos) contra la venta,
// con la meta de 15–16% — esta semana, semanas cerradas, promedio por día
// de la semana y sugerencias de movimientos en el horario.

export type Semaforo = "verde" | "amarillo" | "rojo";

// Verde hasta 15%, amarillo de 15 a 16%, rojo arriba de 16% (también la
// imagen del resultado del Dashboard).
export function semaforoNomina(pct: number): Semaforo {
  return pct <= META_NOMINA_VERDE_PCT ? "verde" : pct <= META_NOMINA_PCT ? "amarillo" : "rojo";
}

const SEMANAS_POR_DIA = 4;

interface DiaNomina {
  venta: number;
  nomina: number;
  personas: number;
}

// Venta, nómina y personas en el horario de cada día de una semana del corte.
function diasDeSemana(
  months: Record<string, MonthData>,
  horarios: Record<string, HorarioMonthData>,
  empleados: EmpleadoEntry[],
  monthKey: string,
  weekIndex: number
): Record<DayName, DiaNomina> {
  const week = months[monthKey]?.weeks?.[weekIndex];
  const semana = horarios[monthKey]?.weeks?.[weekIndex] ?? null;
  const nomina = computeNominaSemana(semana, empleados, null, null, months[monthKey] ? resolveWeekStartDate(monthKey, weekIndex, months[monthKey]) : defaultWeekStartDate(monthKey, weekIndex));
  return Object.fromEntries(
    DAYS.map((d) => {
      const day = week?.days?.[d];
      const venta = day ? day.meseros.reduce((s, m) => s + m.venta, 0) + (day.ventaApps || 0) : 0;
      let costo = 0;
      let personas = 0;
      nomina.forEach((e) => {
        const nd = e.dias.find((x) => x.day === d);
        if (!nd) return;
        costo += nd.monto;
        if (nd.valor && nd.valor !== "OFF") personas += 1;
      });
      return [d, { venta: round2(venta), nomina: round2(costo), personas }];
    })
  ) as Record<DayName, DiaNomina>;
}

export interface NominaVenta {
  semana: {
    nomina: number;
    venta: number;
    pct: number;
    diasContados: number;
    ventaPara16: number | null; // venta que necesita la semana completa para cerrar en 16%
    proyeccion: number | null;
    recorte: number | null; // cuánto habría que recortar de nómina al ritmo de hoy
  } | null;
  cerradas: { label: string; pct: number }[];
  porDia: { dia: DayName; venta: number; personas: number; nomina: number; pct: number | null; ventaPorPersona: number | null }[];
  semanasPorDia: number;
  sugerencias: { tipo: "menos" | "mas"; dia: DayName; texto: string }[];
}

const DIA_CORTO: Record<DayName, string> = {
  Lunes: "Lun", Martes: "Mar", Miércoles: "Mié", Jueves: "Jue", Viernes: "Vie", Sábado: "Sáb", Domingo: "Dom",
};
export const diaCorto = (d: DayName) => DIA_CORTO[d];
const sinCentavos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const pct1 = (n: number) => `${n.toFixed(1)}%`;

export function calcularNominaVenta(
  months: Record<string, MonthData>,
  horarios: Record<string, HorarioMonthData>,
  empleados: EmpleadoEntry[],
  cerradas: WeekTrendPoint[],
  t: TendenciasSemana
): NominaVenta {
  // Semanas cerradas con horario (sin horario la nómina sale en $0).
  const conNomina = cerradas.filter((p) => p.nomina > 0 && p.ventaTotal > 0);

  // ---- Esta semana: solo los días que ya cuentan en la venta ----------
  let semana: NominaVenta["semana"] = null;
  const actual = Object.keys(months).flatMap((mk) =>
    [0, 1, 2, 3].filter((wi) => resolveWeekStartDate(mk, wi, months[mk]) === t.lunes).map((wi) => ({ mk, wi }))
  )[0];
  if (actual && t.diasContados > 0) {
    const dias = diasDeSemana(months, horarios, empleados, actual.mk, actual.wi);
    const nominaHastaHoy = round2(DAYS.slice(0, t.diasContados).reduce((s, d) => s + dias[d].nomina, 0));
    const nominaSemana = round2(DAYS.reduce((s, d) => s + dias[d].nomina, 0));
    if (nominaHastaHoy > 0 && t.hastaHoy > 0) {
      const proyeccion = t.diasContados < 7 ? t.proyeccionRitmo : t.hastaHoy;
      const tope = proyeccion ? (proyeccion * META_NOMINA_PCT) / 100 : null;
      semana = {
        nomina: nominaHastaHoy,
        venta: t.hastaHoy,
        pct: round2((nominaHastaHoy / t.hastaHoy) * 100),
        diasContados: t.diasContados,
        ventaPara16: Math.round((nominaSemana * 100) / META_NOMINA_PCT),
        proyeccion,
        recorte: tope !== null && nominaSemana > tope ? Math.round(nominaSemana - tope) : null,
      };
    }
  }

  // ---- Por día de la semana: promedio de las últimas 4 semanas cerradas
  const base = conNomina.slice(-SEMANAS_POR_DIA).map((p) => diasDeSemana(months, horarios, empleados, p.monthKey, p.weekIndex));
  const porDia = DAYS.map((dia) => {
    const vals = base.map((s) => s[dia]).filter((x) => x.venta > 0);
    const n = vals.length;
    const venta = n ? round2(vals.reduce((s, x) => s + x.venta, 0) / n) : 0;
    const nomina = n ? round2(vals.reduce((s, x) => s + x.nomina, 0) / n) : 0;
    const personas = n ? Math.round(vals.reduce((s, x) => s + x.personas, 0) / n) : 0;
    return {
      dia,
      venta,
      personas,
      nomina,
      pct: venta > 0 ? round2((nomina / venta) * 100) : null,
      ventaPorPersona: venta > 0 && personas > 0 ? Math.round(venta / personas) : null,
    };
  });

  // ---- Sugerencias -----------------------------------------------------
  const sugerencias: NominaVenta["sugerencias"] = [];
  if (base.length >= 2) {
    porDia
      .filter((d) => d.pct !== null && d.pct > META_NOMINA_PCT && d.personas > 1)
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
      .slice(0, 2)
      .forEach((d) => {
        const conUnaMenos = round2(((d.nomina - d.nomina / d.personas) / d.venta) * 100);
        sugerencias.push({
          tipo: "menos",
          dia: d.dia,
          texto: `**${d.dia}:** ${pct1(d.pct!)} con ${d.personas} personas. Con ${d.personas - 1} bajaría a ~${pct1(conUnaMenos)}; revisa si un turno puede cubrir dos puestos.`,
        });
      });
    const conVpp = porDia.filter((d) => d.ventaPorPersona !== null);
    if (conVpp.length >= 2) {
      const mejor = conVpp.reduce((a, b) => (b.ventaPorPersona! > a.ventaPorPersona! ? b : a));
      const peor = conVpp.reduce((a, b) => (b.ventaPorPersona! < a.ventaPorPersona! ? b : a));
      const veces = mejor.ventaPorPersona! / peor.ventaPorPersona!;
      if (veces >= 1.8 && mejor.pct !== null && mejor.pct <= META_NOMINA_VERDE_PCT) {
        sugerencias.push({
          tipo: "mas",
          dia: mejor.dia,
          texto: `**${mejor.dia}:** cada persona saca ${sinCentavos(mejor.ventaPorPersona!)}, ${veces >= 2 ? "más del doble" : `${veces.toFixed(1)} veces lo`} que el ${peor.dia.toLowerCase()}. Si el servicio se satura, ahí sí cabe alguien más.`,
        });
      }
    }
  }

  return {
    semana,
    cerradas: conNomina.slice(-6).reverse().map((p) => ({ label: p.label, pct: round2(p.nominaPct) })),
    porDia,
    semanasPorDia: base.length,
    sugerencias,
  };
}

// Fecha del último día contado de la semana ("mié"), para el texto.
export function ultimoDiaContado(lunes: string, diasContados: number): string {
  const d = new Date(`${addDaysIso(lunes, diasContados - 1)}T00:00:00`);
  return DIA_CORTO[DAYS[(d.getDay() + 6) % 7]].toLowerCase();
}
