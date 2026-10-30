import { historialOrdenado, mondayOnOrBefore, sueldoEnFecha, todayIso } from "./dataModel";
import type { CambioSueldo, EmpleadoEntry } from "./types";

// Personal › empleado: historial de sueldo, antigüedad y fechas para
// mostrar. El cálculo del sueldo de cada semana vive en dataModel
// (sueldoEnFecha), porque lo usa la nómina.

// "Desde" del sueldo que ya tenía antes de empezar el historial (cuenta
// para todas las semanas anteriores al primer cambio).
export const SUELDO_INICIAL_DESDE = "2000-01-01";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}
export function mesCorto(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

// "1 año 2 meses", "5 meses", "3 semanas", "4 días".
export function antiguedad(desde: string, hasta: string = todayIso()): string {
  const a = new Date(`${desde}T12:00:00`);
  const b = new Date(`${hasta}T12:00:00`);
  if (b < a) return "aún no entra";
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) meses--;
  const pl = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  if (meses >= 12) {
    const anios = Math.floor(meses / 12);
    const resto = meses % 12;
    return resto ? `${pl(anios, "año", "años")} ${pl(resto, "mes", "meses")}` : pl(anios, "año", "años");
  }
  if (meses >= 1) return pl(meses, "mes", "meses");
  const dias = Math.round((b.getTime() - a.getTime()) / 864e5);
  return dias >= 7 ? pl(Math.floor(dias / 7), "semana", "semanas") : pl(dias, "día", "días");
}

export type RenglonHistorial = CambioSueldo & { anterior: number | null; diferencia: number; futuro: boolean; vigente: boolean };

// El historial de más nuevo a más viejo, con la diferencia contra el
// sueldo anterior y cuál está vigente hoy.
export function renglonesHistorial(e: Pick<EmpleadoEntry, "historialSueldo">): RenglonHistorial[] {
  const h = historialOrdenado(e);
  const hoy = mondayOnOrBefore(todayIso());
  let vigenteId = h[0]?.id;
  h.forEach((c) => {
    if (mondayOnOrBefore(c.desde) <= hoy) vigenteId = c.id;
  });
  return h
    .map((c, i) => {
      const anterior = i > 0 ? h[i - 1].sueldoDiario : null;
      return { ...c, anterior, diferencia: anterior === null ? 0 : c.sueldoDiario - anterior, futuro: mondayOnOrBefore(c.desde) > hoy, vigente: c.id === vigenteId };
    })
    .reverse();
}

// Resumen para la tarjeta del empleado: cuánto ha cambiado desde el primer
// sueldo, el último cambio y el próximo programado.
export function resumenSueldo(e: EmpleadoEntry) {
  const h = historialOrdenado(e);
  const actual = sueldoEnFecha(e);
  const hoy = mondayOnOrBefore(todayIso());
  const pasados = h.filter((c) => mondayOnOrBefore(c.desde) <= hoy);
  const ultimo = pasados.length > 1 ? pasados[pasados.length - 1] : null;
  const anteriorUltimo = ultimo ? pasados[pasados.length - 2].sueldoDiario : 0;
  const proximo = h.find((c) => mondayOnOrBefore(c.desde) > hoy) || null;
  const inicial = h[0]?.sueldoDiario ?? actual;
  return {
    actual,
    inicial,
    cambioTotal: actual - inicial,
    ultimo: ultimo ? { desde: ultimo.desde, diferencia: ultimo.sueldoDiario - anteriorUltimo } : null,
    proximo: proximo ? { desde: proximo.desde, sueldoDiario: proximo.sueldoDiario, diferencia: proximo.sueldoDiario - actual } : null,
    cambios: Math.max(0, h.length - 1),
  };
}
