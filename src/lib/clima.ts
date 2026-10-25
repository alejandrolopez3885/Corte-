import { useEffect, useState } from "react";

// Clima de cada día en el restaurante (Apodaca, N.L.), de Open-Meteo
// (gratis, sin clave): máxima, mínima, lluvia y el tipo de cielo. Los días
// pasados y el pronóstico de los próximos 16 días salen de una sola consulta
// (hasta 92 días atrás); más viejos, del histórico. Se guarda en memoria de
// la sesión. Es el paso 2 hacia el pronóstico de venta y el horario sugerido.

export const UBICACION = { nombre: "Apodaca, N.L.", lat: 25.7817, lon: -100.1883 };

export interface ClimaDia {
  max: number;
  min: number;
  lluvia: number; // mm
  probLluvia?: number; // % (solo pronóstico)
  codigo: number; // código WMO del cielo
  pronostico: boolean; // true si todavía no pasa
}

const DIARIO = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max";
const cache = new Map<string, ClimaDia>();
const pendientes = new Map<string, Promise<void>>();

const hoyIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Monterrey" });
const restaDias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

async function traer(url: string, hoy: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`clima ${r.status}`);
  const j = (await r.json()) as { daily?: Record<string, (number | null)[]> & { time: string[] } };
  const d = j.daily;
  if (!d) return;
  d.time.forEach((fecha, i) => {
    if (d.temperature_2m_max?.[i] == null) return;
    cache.set(fecha, {
      max: Math.round(d.temperature_2m_max[i] as number),
      min: Math.round((d.temperature_2m_min?.[i] as number) ?? 0),
      lluvia: Math.round(((d.precipitation_sum?.[i] as number) ?? 0) * 10) / 10,
      probLluvia: d.precipitation_probability_max?.[i] ?? undefined,
      codigo: (d.weather_code?.[i] as number) ?? 0,
      pronostico: fecha > hoy,
    });
  });
}

// Trae el clima de un rango de fechas (ISO) y lo deja en memoria.
export function cargarClima(desde: string, hasta: string): Promise<void> {
  const clave = `${desde}|${hasta}`;
  if (pendientes.has(clave)) return pendientes.get(clave)!;
  const hoy = hoyIso();
  const base = `latitude=${UBICACION.lat}&longitude=${UBICACION.lon}&timezone=America%2FMonterrey`;
  const p = (async () => {
    // Reciente y pronóstico: una consulta con días pasados.
    if (restaDias(hoy, desde) <= 92 && restaDias(hasta, hoy) <= 16) {
      const pasados = Math.max(0, Math.min(92, restaDias(hoy, desde)));
      await traer(`https://api.open-meteo.com/v1/forecast?${base}&daily=${DIARIO}&past_days=${pasados}&forecast_days=16`, hoy);
    } else if (hasta < hoy) {
      await traer(`https://archive-api.open-meteo.com/v1/archive?${base}&daily=${DIARIO.replace(",precipitation_probability_max", "")}&start_date=${desde}&end_date=${hasta}`, hoy);
    }
  })().catch((e) => console.error("No se pudo traer el clima", e));
  pendientes.set(clave, p);
  return p;
}

export const climaDe = (fechaIso: string) => cache.get(fechaIso);

// Ícono y texto del cielo según el código WMO.
export function cielo(codigo: number): { icono: string; texto: string } {
  if (codigo === 0) return { icono: "☀️", texto: "Despejado" };
  if (codigo <= 2) return { icono: "🌤️", texto: "Poco nublado" };
  if (codigo === 3) return { icono: "☁️", texto: "Nublado" };
  if (codigo === 45 || codigo === 48) return { icono: "🌫️", texto: "Niebla" };
  if (codigo >= 95) return { icono: "⛈️", texto: "Tormenta" };
  if (codigo >= 80) return { icono: "🌦️", texto: "Chubascos" };
  if (codigo >= 71 && codigo <= 77) return { icono: "❄️", texto: "Nieve" };
  if (codigo >= 51) return { icono: "🌧️", texto: "Lluvia" };
  return { icono: "🌤️", texto: "Poco nublado" };
}

// Texto corto: "☀️ 31° · 22°" y, si llovió o puede llover, "· 🌧️ 4 mm" / "60%".
export function textoClima(c: ClimaDia): string {
  const lluvia = c.pronostico
    ? c.probLluvia && c.probLluvia >= 30
      ? ` · lluvia ${c.probLluvia}%`
      : ""
    : c.lluvia >= 1
      ? ` · lluvia ${c.lluvia} mm`
      : "";
  return `${cielo(c.codigo).icono} ${c.max}° / ${c.min}°${lluvia}`;
}

// Hook: carga el clima del rango y vuelve a pintar cuando llega.
export function useClima(desde: string | null | undefined, hasta: string | null | undefined): (fecha: string) => ClimaDia | undefined {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!desde || !hasta) return;
    let vivo = true;
    cargarClima(desde, hasta).then(() => vivo && setVersion((v) => v + 1));
    return () => {
      vivo = false;
    };
  }, [desde, hasta]);
  return climaDe;
}
