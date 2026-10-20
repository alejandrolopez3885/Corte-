import { addDaysIso, dateForDay, round2, todayIso } from "./dataModel";
import { DAYS } from "./types";
import type { DayData, MonthData } from "./types";

// Cálculos de Negocio > Tendencias por fecha real del calendario (semanas de
// lunes a domingo), sin importar en qué mes/semana del corte quedó cada
// día: venta de la semana en curso hasta hoy contra los mismos días de
// semanas pasadas, proyección de cierre, día a día, semanas completas,
// patrón por día de la semana y mezcla de cobro.

export const SEMANAS_PROMEDIO = 4; // ventana para promedios y proyección
const SEMANAS_PATRON = 8; // ventana para el patrón por día de la semana

interface VentaDia {
  venta: number; // meseros + apps (igual que el Dashboard)
  tarjetas: number;
  apps: number;
}

export function lunesDe(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return addDaysIso(iso, -((d.getDay() + 6) % 7));
}

// fecha real -> venta de ese día del corte.
function ventasPorFecha(months: Record<string, MonthData>): Map<string, VentaDia> {
  const mapa = new Map<string, VentaDia>();
  Object.keys(months)
    .sort()
    .forEach((mk) => {
      const month = months[mk];
      month.weeks.forEach((w, wi) =>
        DAYS.forEach((d) => {
          const day: DayData | undefined = w?.days?.[d];
          if (!day) return;
          const meseros = day.meseros.reduce((s, m) => s + m.venta, 0);
          const apps = day.ventaApps || 0;
          if (meseros + apps === 0) return;
          mapa.set(dateForDay(mk, wi, month, d), {
            venta: round2(meseros + apps),
            tarjetas: round2(day.meseros.reduce((s, m) => s + m.tarjetas, 0)),
            apps: round2(apps),
          });
        })
      );
    });
  return mapa;
}

const suma = (ns: number[]) => round2(ns.reduce((s, n) => s + n, 0));
const promedio = (ns: number[]) => (ns.length ? round2(suma(ns) / ns.length) : 0);
export const pctCambio = (actual: number, antes: number) => (antes > 0 ? round2(((actual - antes) / antes) * 100) : null);

export interface DiaComparado {
  dia: (typeof DAYS)[number];
  fecha: string;
  actual: number | null; // null = todavía no se cuenta (futuro o sin captura hoy)
  estimado: number; // promedio de ese día en las últimas semanas
  semanaPasada: number;
  cambio: number | null;
}

export interface SemanaCompleta {
  lunes: string;
  venta: number;
  cambio: number | null;
  estimada?: boolean;
}

export interface TendenciasSemana {
  lunes: string;
  diasContados: number; // 0..7 de lunes a hoy (hoy solo si ya tiene venta)
  hastaHoy: number;
  mismosDiasSemanaPasada: number;
  mismosDiasPromedio: number;
  semanaPasadaTotal: number;
  proyeccionRitmo: number | null;
  proyeccionHistorica: number | null;
  pesoDiasTranscurridos: number | null; // % que suelen pesar estos días
  dias: DiaComparado[];
  semanas: SemanaCompleta[];
  promedioSemanas: number;
  mejorSemana: number;
  patron: { dia: (typeof DAYS)[number]; promedio: number; pct: number }[];
  mezcla: { tarjetasPct: number | null; appsPct: number | null; tarjetasAntes: number | null; appsAntes: number | null };
  semanasBase: number; // semanas pasadas con venta usadas en promedios
}

export function computeTendenciasSemana(months: Record<string, MonthData>, hoy = todayIso()): TendenciasSemana {
  const ventas = ventasPorFecha(months);
  const lunes = lunesDe(hoy);
  const fechasDe = (l: string) => DAYS.map((_, i) => addDaysIso(l, i));
  const venta = (f: string) => ventas.get(f)?.venta ?? 0;
  const totalSemana = (l: string) => suma(fechasDe(l).map(venta));

  // Semanas pasadas con venta, de la más reciente a la más vieja.
  const pasadas: string[] = [];
  for (let i = 1; i <= 60 && pasadas.length < SEMANAS_PATRON; i++) {
    const l = addDaysIso(lunes, -7 * i);
    if (totalSemana(l) > 0) pasadas.push(l);
  }
  const base = pasadas.slice(0, SEMANAS_PROMEDIO);
  const semanaPasada = addDaysIso(lunes, -7);

  // Días de esta semana que ya cuentan: los anteriores a hoy, y hoy solo si
  // ya se capturó algo (el corte se hace en la noche).
  const fechas = fechasDe(lunes);
  let diasContados = fechas.filter((f) => f < hoy).length;
  if (ventas.has(hoy)) diasContados += 1;
  const hastaHoy = suma(fechas.slice(0, diasContados).map(venta));

  const primeros = (l: string, n: number) => suma(fechasDe(l).slice(0, n).map(venta));
  const resto = (l: string, n: number) => suma(fechasDe(l).slice(n).map(venta));
  const mismosDiasSemanaPasada = primeros(semanaPasada, diasContados);
  const mismosDiasPromedio = promedio(base.map((l) => primeros(l, diasContados)));

  // Proyección de cierre: al ritmo (lo que llevas ÷ lo que suelen pesar
  // estos días) e histórica (lo que llevas + lo que suele venderse el resto).
  const pesos = base.map((l) => (totalSemana(l) > 0 ? primeros(l, diasContados) / totalSemana(l) : 0)).filter((p) => p > 0);
  const peso = pesos.length ? promedio(pesos.map((p) => p * 100)) / 100 : null;
  // Son estimados: a pesos enteros.
  const proyeccionHistorica = base.length ? Math.round(hastaHoy + promedio(base.map((l) => resto(l, diasContados)))) : null;
  const proyeccionRitmo =
    diasContados === 0 ? proyeccionHistorica : diasContados === 7 ? hastaHoy : peso && peso > 0 ? Math.round(hastaHoy / peso) : null;

  const dias: DiaComparado[] = DAYS.map((dia, i) => {
    const fecha = fechas[i];
    const actual = i < diasContados ? venta(fecha) : null;
    const pasada = venta(addDaysIso(fecha, -7));
    return {
      dia,
      fecha,
      actual,
      estimado: promedio(base.map((l) => venta(addDaysIso(l, i)))),
      semanaPasada: pasada,
      cambio: actual === null ? null : pctCambio(actual, pasada),
    };
  });

  const completas = pasadas.map((l) => ({ lunes: l, venta: totalSemana(l) }));
  const semanas: SemanaCompleta[] = completas.map((s, i) => ({
    ...s,
    cambio: completas[i + 1] ? pctCambio(s.venta, completas[i + 1].venta) : null,
  }));
  if (proyeccionRitmo !== null && diasContados > 0) {
    semanas.unshift({
      lunes,
      venta: proyeccionRitmo,
      cambio: completas[0] ? pctCambio(proyeccionRitmo, completas[0].venta) : null,
      estimada: diasContados < 7,
    });
  }

  const patronProm = DAYS.map((dia, i) => ({ dia, promedio: promedio(pasadas.map((l) => venta(addDaysIso(l, i)))) }));
  const totalPatron = suma(patronProm.map((p) => p.promedio));
  const patron = patronProm.map((p) => ({ ...p, pct: totalPatron > 0 ? round2((p.promedio / totalPatron) * 100) : 0 }));

  const mezclaDe = (fs: string[]) => {
    const v = suma(fs.map(venta));
    if (v <= 0) return { t: null, a: null };
    return {
      t: round2((suma(fs.map((f) => ventas.get(f)?.tarjetas ?? 0)) / v) * 100),
      a: round2((suma(fs.map((f) => ventas.get(f)?.apps ?? 0)) / v) * 100),
    };
  };
  const ahora = mezclaDe(fechas.slice(0, diasContados));
  const antes = mezclaDe(fechasDe(semanaPasada).slice(0, Math.max(diasContados, 1)));

  return {
    lunes,
    diasContados,
    hastaHoy,
    mismosDiasSemanaPasada,
    mismosDiasPromedio,
    semanaPasadaTotal: totalSemana(semanaPasada),
    proyeccionRitmo,
    proyeccionHistorica,
    pesoDiasTranscurridos: peso === null ? null : Math.round(peso * 1000) / 10,
    dias,
    semanas,
    promedioSemanas: promedio(base.map(totalSemana)),
    mejorSemana: Math.max(0, ...base.map(totalSemana)),
    patron,
    mezcla: { tarjetasPct: ahora.t, appsPct: ahora.a, tarjetasAntes: antes.t, appsAntes: antes.a },
    semanasBase: base.length,
  };
}
