import type { DayData, EtiquetaDia } from "./types";

// Etiquetas del día: qué pasó (o va a pasar) ese día que mueve la venta —
// música en vivo, partido, festivo o puente, evento privado u otro, con una
// nota. Se guardan en el día del corte (así se ven igual en Horarios y en
// Corte) y más adelante sirven para pronosticar la venta y sugerir el
// horario. La quincena no se captura: se calcula sola.

export const ETIQUETAS: { id: EtiquetaDia; icono: string; texto: string }[] = [
  { id: "musica", icono: "🎵", texto: "Música en vivo" },
  { id: "partido", icono: "⚽", texto: "Partido" },
  { id: "festivo", icono: "🎉", texto: "Festivo o puente" },
  { id: "evento", icono: "🎂", texto: "Evento privado" },
  { id: "otro", icono: "📌", texto: "Otro" },
];

export const etiquetaDe = (id: EtiquetaDia) => ETIQUETAS.find((e) => e.id === id)!;

// Quincena: se paga el 15 y el último día del mes; si cae en sábado o
// domingo, el viernes anterior. Devuelve si ese día es día de pago.
export function esQuincena(fechaIso: string): boolean {
  const [y, m] = fechaIso.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return [15, ultimo].some((dia) => {
    const pago = new Date(y, m - 1, dia);
    const dow = pago.getDay(); // 0 domingo, 6 sábado
    if (dow === 6) pago.setDate(dia - 1);
    if (dow === 0) pago.setDate(dia - 2);
    const iso = `${pago.getFullYear()}-${String(pago.getMonth() + 1).padStart(2, "0")}-${String(pago.getDate()).padStart(2, "0")}`;
    return iso === fechaIso;
  });
}

// --- Festivos de México, fechas especiales y puentes (automáticos) ---

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// El n-ésimo lunes (o día de la semana `dow`, 0 = domingo) de un mes.
const enesimo = (y: number, mes: number, dow: number, n: number) => {
  const d = new Date(y, mes - 1, 1);
  d.setDate(1 + ((dow - d.getDay() + 7) % 7) + (n - 1) * 7);
  return d;
};
// Domingo de Pascua (algoritmo anónimo gregoriano).
function pascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}

export interface FechaEspecial {
  nombre: string;
  // oficial: descanso obligatorio por ley (art. 74 LFT); tradicion: no es
  // descanso pero mueve la venta (Día de las Madres, Semana Santa, ...).
  tipo: "oficial" | "tradicion";
}

const cacheAnio = new Map<number, Map<string, FechaEspecial>>();
export function fechasEspeciales(y: number): Map<string, FechaEspecial> {
  const ya = cacheAnio.get(y);
  if (ya) return ya;
  const m = new Map<string, FechaEspecial>();
  const of = (d: Date, nombre: string) => m.set(iso(d), { nombre, tipo: "oficial" });
  const tr = (d: Date, nombre: string) => {
    if (!m.has(iso(d))) m.set(iso(d), { nombre, tipo: "tradicion" });
  };
  of(new Date(y, 0, 1), "Año Nuevo");
  of(enesimo(y, 2, 1, 1), "Día de la Constitución");
  of(enesimo(y, 3, 1, 3), "Natalicio de Benito Juárez");
  of(new Date(y, 4, 1), "Día del Trabajo");
  of(new Date(y, 8, 16), "Día de la Independencia");
  if ((y - 2024) % 6 === 0) of(new Date(y, 9, 1), "Cambio de Presidente");
  of(enesimo(y, 11, 1, 3), "Día de la Revolución");
  of(new Date(y, 11, 25), "Navidad");
  const p = pascua(y);
  tr(new Date(y, p.getMonth(), p.getDate() - 3), "Jueves Santo");
  tr(new Date(y, p.getMonth(), p.getDate() - 2), "Viernes Santo");
  tr(new Date(y, 0, 6), "Día de Reyes");
  tr(new Date(y, 1, 14), "San Valentín");
  tr(new Date(y, 3, 30), "Día del Niño");
  tr(new Date(y, 4, 10), "Día de las Madres");
  tr(enesimo(y, 6, 0, 3), "Día del Padre");
  tr(new Date(y, 8, 15), "Noche Mexicana");
  tr(new Date(y, 9, 31), "Halloween");
  tr(new Date(y, 10, 1), "Día de Muertos");
  tr(new Date(y, 10, 2), "Día de Muertos");
  tr(new Date(y, 11, 12), "Día de la Virgen de Guadalupe");
  tr(new Date(y, 11, 24), "Nochebuena");
  tr(new Date(y, 11, 31), "Fin de año");
  cacheAnio.set(y, m);
  return m;
}

export function fechaEspecial(fechaIso: string): FechaEspecial | undefined {
  return fechasEspeciales(Number(fechaIso.slice(0, 4))).get(fechaIso);
}

// Puente: los días que se juntan con un festivo oficial para hacer fin de
// semana largo — si cae en lunes, el sábado y domingo antes; en viernes, el
// sábado y domingo después; en jueves, el viernes; en martes, el lunes.
export function puenteDe(fechaIso: string): string | undefined {
  const [y, mo, d] = fechaIso.split("-").map(Number);
  const dia = new Date(y, mo - 1, d);
  for (let delta = -3; delta <= 3; delta++) {
    if (!delta) continue;
    const otro = new Date(y, mo - 1, d + delta);
    const f = fechaEspecial(iso(otro));
    if (f?.tipo !== "oficial") continue;
    const dow = otro.getDay();
    const hoy = dia.getDay();
    const es =
      (dow === 1 && (hoy === 6 || hoy === 0) && delta > 0 && delta <= 2) ||
      (dow === 5 && (hoy === 6 || hoy === 0) && delta < 0 && delta >= -2) ||
      (dow === 4 && hoy === 5 && delta === -1) ||
      (dow === 2 && hoy === 1 && delta === 1);
    if (es) return f.nombre;
  }
  return undefined;
}

// Lo que se muestra de un día: sus etiquetas, y lo automático (quincena,
// festivo o fecha especial y puente).
export function etiquetasDelDia(day: DayData | null | undefined, fechaIso: string | null | undefined): { icono: string; texto: string; auto?: boolean }[] {
  const out: { icono: string; texto: string; auto?: boolean }[] = [];
  if (fechaIso) {
    const f = fechaEspecial(fechaIso);
    if (f) out.push({ icono: f.tipo === "oficial" ? "🇲🇽" : "✨", texto: f.nombre, auto: true });
    const puente = puenteDe(fechaIso);
    if (puente) out.push({ icono: "🌉", texto: `Puente (${puente})`, auto: true });
  }
  if (fechaIso && esQuincena(fechaIso)) out.push({ icono: "💰", texto: "Quincena", auto: true });
  (day?.etiquetas?.tipos || []).forEach((t) => {
    const e = etiquetaDe(t);
    if (e) out.push({ icono: e.icono, texto: e.texto });
  });
  return out;
}
