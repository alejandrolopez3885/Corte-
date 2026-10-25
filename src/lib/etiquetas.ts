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

// Lo que se muestra de un día: sus etiquetas y la quincena (si toca).
export function etiquetasDelDia(day: DayData | null | undefined, fechaIso: string | null | undefined): { icono: string; texto: string; auto?: boolean }[] {
  const out: { icono: string; texto: string; auto?: boolean }[] = [];
  if (fechaIso && esQuincena(fechaIso)) out.push({ icono: "💰", texto: "Quincena", auto: true });
  (day?.etiquetas?.tipos || []).forEach((t) => {
    const e = etiquetaDe(t);
    if (e) out.push({ icono: e.icono, texto: e.texto });
  });
  return out;
}
