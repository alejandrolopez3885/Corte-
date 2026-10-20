import { dateForDay } from "./dataModel";
import { DAYS } from "./types";
import type { AppData, DayName, Gasto, MonthData } from "./types";

// Búsqueda de gastos en efectivo (Control de gastos en efectivo) y
// autocompletado del concepto al capturar un gasto. Todo se calcula en el
// celular, sin servicios externos — salvo la sugerencia de ortografía de
// LanguageTool, que es opcional: si falla, simplemente no aparece.

// "Coca-Cola" → "coca cola": minúsculas, sin acentos, sin signos.
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ$.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Llave para agrupar variantes del mismo nombre: "Coca Cola", "coca-cola"
// y "cocacola" caen en la misma.
function llave(texto: string): string {
  return normalizar(texto).replace(/[\s.]/g, "");
}

function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function parecidoPalabra(q: string, c: string): number {
  if (c === q || c.startsWith(q)) return 1;
  if (q.length >= 3 && c.includes(q)) return 0.85;
  if (q.length < 3) return 0;
  // Una sola letra de diferencia cuenta como la misma palabra ("coliflr").
  if (q.length >= 4 && (distancia(q, c) <= 1 || distancia(q, c.slice(0, q.length)) <= 1)) return 0.9;
  const largo = Math.max(q.length, c.length);
  const ratio = 1 - distancia(q, c) / largo;
  // También contra el inicio de la palabra, para errores al ir escribiendo
  // ("coliflr" contra "coliflor").
  const inicio = c.slice(0, q.length);
  const ratioInicio = 1 - distancia(q, inicio) / q.length;
  const mejor = Math.max(ratio, ratioInicio * 0.95);
  return mejor >= 0.7 ? mejor * 0.9 : 0;
}

// Qué tanto se parece un concepto a lo buscado: 1 = todas las palabras
// buscadas están en el concepto, 0 = nada que ver. El orden no importa.
export function puntaje(busqueda: string, concepto: string): number {
  const q = normalizar(busqueda).split(" ").filter(Boolean);
  if (!q.length) return 0;
  const c = normalizar(concepto).split(" ").filter(Boolean);
  // "cocacola" contra "Coca Cola" (o al revés): se comparan sin espacios.
  const qJunto = q.join("");
  const cJunto = c.join("");
  if (qJunto.length >= 3 && cJunto.includes(qJunto)) return 1;
  const suma = q.reduce((s, palabra) => {
    let mejor = Math.max(0, ...c.map((cp) => parecidoPalabra(palabra, cp)));
    if (mejor < 1 && palabra.length >= 4 && cJunto.includes(palabra)) mejor = 0.9;
    return s + mejor;
  }, 0);
  return suma / q.length;
}

export const PUNTAJE_ENCONTRADO = 0.85;
export const PUNTAJE_PARECIDO = 0.4;

// ---------------------------------------------------------------------------
// Lectura de lo que se escribió en la búsqueda: "coca jueves", "coca 16".

const NOMBRES_DIA: Record<string, DayName> = {
  lunes: "Lunes", lun: "Lunes",
  martes: "Martes", mar: "Martes",
  miercoles: "Miércoles", mie: "Miércoles",
  jueves: "Jueves", jue: "Jueves",
  viernes: "Viernes", vie: "Viernes",
  sabado: "Sábado", sab: "Sábado",
  domingo: "Domingo", dom: "Domingo",
};

export interface BusquedaLeida {
  nombre: string;
  dia: DayName | null;
  // Número que parecía día pero no cae en la semana elegida.
  diaFuera: number | null;
}

export function leerBusqueda(texto: string, monthKey: string, weekIndex: number, month: MonthData): BusquedaLeida {
  const palabras = normalizar(texto).split(" ").filter(Boolean);
  const diaDelMes = new Map<number, DayName>();
  DAYS.forEach((d) => diaDelMes.set(Number(dateForDay(monthKey, weekIndex, month, d).slice(8, 10)), d));
  let dia: DayName | null = null;
  let diaFuera: number | null = null;
  const resto: string[] = [];
  for (const p of palabras) {
    // "mar" también es una palabra normal; solo se toma como día si no
    // hay ya uno y hay más texto o es la única palabra.
    if (!dia && NOMBRES_DIA[p] && (p.length > 3 || palabras.length > 1)) {
      dia = NOMBRES_DIA[p];
    } else if (!dia && /^\d{1,2}$/.test(p) && Number(p) >= 1 && Number(p) <= 31) {
      const d = diaDelMes.get(Number(p));
      if (d) dia = d;
      else diaFuera = Number(p);
    } else {
      resto.push(p);
    }
  }
  return { nombre: resto.join(" "), dia, diaFuera };
}

// ---------------------------------------------------------------------------
// Historial de nombres de gastos (para autocompletar y para escribir bien).

// Marcas, tiendas y productos comunes — se usan para escribirlos bien
// aunque todavía no estén en el historial, y para que la revisión de
// ortografía no los marque como error.
const NOMBRES_COMUNES = [
  "Walmart", "Bodega Aurrera", "Sam's", "Costco", "Soriana", "Chedraui", "La Comer", "City Market", "Fresko", "HEB",
  "Oxxo", "7-Eleven", "Circle K", "Farmacias Guadalajara", "Farmacia del Ahorro", "Similares", "Home Depot",
  "Office Depot", "Coppel", "Liverpool", "Elektra", "Mercado Libre", "Amazon", "Cinépolis", "Pemex",
  "Coca Cola", "Pepsi", "Sprite", "Fanta", "Fresca", "Squirt", "Manzanita Sol", "Mundet", "Sidral", "Jarritos",
  "Peñafiel", "Topo Chico", "Ciel", "Bonafont", "Epura", "Electrolit", "Gatorade", "Red Bull", "Boing",
  "Corona", "Victoria", "Modelo", "Pacífico", "Tecate", "Indio", "XX Lager", "Bohemia", "Heineken", "Michelob",
  "Bacardí", "Don Julio", "José Cuervo", "Herradura", "Tequila", "Mezcal", "Smirnoff", "Absolut", "Clamato",
  "Bimbo", "Wonder", "Marinela", "Tía Rosa", "Sabritas", "Barcel", "Gamesa", "Lala", "Alpura", "Santa Clara",
  "Nestlé", "Nescafé", "Carnation", "La Costeña", "Herdez", "McCormick", "Knorr", "Maggi", "Valentina",
  "Tajín", "Búfalo", "Maseca", "Minsa", "Nutrioli", "1-2-3", "Capullo", "Kellogg's", "Fud", "San Rafael",
  "Zwan", "Chata", "Philadelphia", "Great Value", "Member's Mark", "Kirkland",
  "Fabuloso", "Pinol", "Cloralex", "Ariel", "Roma", "Foca", "Salvo", "Axion", "Suavitel", "Downy", "Vanish",
  "Kleenex", "Pétalo", "Regio", "Scott", "Raid", "Glad", "Ziploc", "Reynolds",
  "Didi", "Uber", "Rappi", "Telcel", "Telmex", "Izzi", "Totalplay", "CFE", "Gas", "Hielo", "Garrafón",
];

export interface NombreHistorial {
  nombre: string;
  usos: number;
}

function capitalizarPrimera(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

// Todos los nombres de gastos capturados en la app, agrupando variantes
// ("coca", "Coca cola", "Coca-Cola" → la forma más usada) y ordenados del
// más usado al menos usado.
export function historialNombres(data: AppData): NombreHistorial[] {
  const grupos = new Map<string, Map<string, number>>();
  Object.values(data.months || {}).forEach((m) =>
    (m.weeks || []).forEach((w) =>
      DAYS.forEach((d) =>
        (w?.days?.[d]?.gastos || []).forEach((g: Gasto) => {
          const nombre = g.concepto.trim().replace(/\s+/g, " ");
          const k = llave(nombre);
          if (!k) return;
          const variantes = grupos.get(k) || new Map<string, number>();
          variantes.set(nombre, (variantes.get(nombre) || 0) + 1);
          grupos.set(k, variantes);
        }),
      ),
    ),
  );
  const comunes = new Map(NOMBRES_COMUNES.map((n) => [llave(n), n]));
  const lista: NombreHistorial[] = [];
  grupos.forEach((variantes, k) => {
    let usos = 0;
    let mejor = "";
    let mejorUsos = -1;
    variantes.forEach((n, nombre) => {
      usos += n;
      // En empate gana la que empieza con mayúscula.
      const gana = n > mejorUsos || (n === mejorUsos && /^[A-ZÁÉÍÓÚÑ]/.test(nombre) && !/^[A-ZÁÉÍÓÚÑ]/.test(mejor));
      if (gana) {
        mejor = nombre;
        mejorUsos = n;
      }
    });
    lista.push({ nombre: comunes.get(k) || capitalizarPrimera(mejor), usos });
  });
  return lista.sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, "es"));
}

// Sugerencias para el cuadro de concepto mientras se escribe: primero lo
// que más se parece, y entre iguales, lo más usado.
export function sugerirNombres(texto: string, historial: NombreHistorial[], max = 5): NombreHistorial[] {
  if (normalizar(texto).length < 2) return [];
  return historial
    .map((h) => ({ h, p: puntaje(texto, h.nombre) }))
    .filter((x) => x.p >= 0.7)
    .sort((a, b) => b.p - a.p || b.h.usos - a.h.usos)
    .slice(0, max)
    .map((x) => x.h);
}

// La forma "bien escrita" de un nombre si ya existe tal cual (ignorando
// mayúsculas, acentos y guiones) en el historial o en los nombres comunes.
export function nombreConocido(texto: string, historial: NombreHistorial[]): string | null {
  const k = llave(texto);
  if (!k) return null;
  return historial.find((h) => llave(h.nombre) === k)?.nombre || NOMBRES_COMUNES.find((n) => llave(n) === k) || null;
}

// ---------------------------------------------------------------------------
// Ortografía con LanguageTool (gratis, sin clave). Las palabras que ya
// están en el historial o en los nombres comunes se respetan tal cual.

const cacheOrtografia = new Map<string, string | null>();

function palabrasConocidas(historial: NombreHistorial[]): Map<string, string> {
  const conocidas = new Map<string, string>();
  [...NOMBRES_COMUNES, ...historial.map((h) => h.nombre)].forEach((n) =>
    n.split(/\s+/).forEach((p) => {
      const k = llave(p);
      if (k && !conocidas.has(k)) conocidas.set(k, p);
    }),
  );
  return conocidas;
}

export async function corregirOrtografia(texto: string, historial: NombreHistorial[]): Promise<string | null> {
  const limpio = texto.trim().replace(/\s+/g, " ");
  if (limpio.length < 3) return null;
  if (cacheOrtografia.has(limpio)) return cacheOrtografia.get(limpio) ?? null;

  const conocidas = palabrasConocidas(historial);
  // Primero las marcas y palabras ya conocidas, con su forma correcta.
  const palabras = limpio.split(" ").map((p) => conocidas.get(llave(p)) || p);
  let resultado = palabras.join(" ");

  try {
    const body = new URLSearchParams({ text: resultado, language: "es" });
    const resp = await fetch("https://api.languagetool.org/v2/check", { method: "POST", body });
    if (resp.ok) {
      const json = (await resp.json()) as {
        matches?: { offset: number; length: number; replacements?: { value: string }[] }[];
      };
      // De atrás para adelante, para que los offsets no se muevan.
      const cambios = (json.matches || [])
        .filter((m) => m.replacements?.length)
        .filter((m) => !conocidas.has(llave(resultado.slice(m.offset, m.offset + m.length))))
        .sort((a, b) => b.offset - a.offset);
      for (const m of cambios) {
        resultado = resultado.slice(0, m.offset) + m.replacements![0].value + resultado.slice(m.offset + m.length);
      }
    }
  } catch {
    // Sin internet o el servicio no respondió: solo se usan las conocidas.
  }

  resultado = capitalizarPrimera(resultado);
  // Solo vale la pena sugerir si cambia algo más que la primera mayúscula.
  const sugerencia = resultado.slice(1) !== limpio.slice(1) || llave(resultado) !== llave(limpio) ? resultado : null;
  cacheOrtografia.set(limpio, sugerencia);
  return sugerencia;
}

// Nombre para un gasto nuevo a partir de lo buscado: si ya existe uno
// igual en el historial se usa esa forma; si no, con mayúscula inicial.
export function nombreParaNuevo(texto: string, historial: NombreHistorial[]): string {
  const conocido = nombreConocido(texto, historial);
  if (conocido) return conocido;
  const conocidas = palabrasConocidas(historial);
  return capitalizarPrimera(
    texto
      .trim()
      .split(/\s+/)
      .map((p) => conocidas.get(llave(p)) || p)
      .join(" "),
  );
}
