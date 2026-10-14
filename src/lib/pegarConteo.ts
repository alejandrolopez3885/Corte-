import type { InsumoEntry } from "./types";

// Lector de la nota de WhatsApp del conteo diario — el jefe de cocina/barra
// anota en su chat lo que va viendo ("Ff 11.77kg", "Pan B 44pz",
// "Elotes 10 mitades") y pega el mensaje completo en Conteo diario. Cada
// línea se separa en nombre + cantidad, y el nombre se busca contra los
// insumos de esa pantalla: primero por nombre o apodo exacto, después por
// abreviatura (cada palabra escrita es el inicio de la palabra del
// insumo: "Toci" → Tocino, "Pan B" → Pan Brioche) y al final por iniciales
// ("CC" → Carne Cocida). Solo se acepta una coincidencia si es única — lo
// ambiguo o desconocido se le pregunta al usuario, que puede guardarlo como
// apodo del insumo para que la próxima vez salga solo.

export interface LineaReconocida {
  linea: string;
  texto: string; // lo escrito como nombre, tal cual
  cantidad: number;
  unidad?: string; // lo escrito después del número ("kg", "pz", "mitades"...)
  insumoId?: string;
  candidatos: string[]; // insumoIds posibles cuando hubo más de uno
}

export interface ResultadoPegado {
  lineas: LineaReconocida[];
  ignoradas: string[]; // líneas sin número (títulos, saludos...)
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Encabezado que agrega WhatsApp al copiar varios mensajes:
// "[14/10/26, 22:15] Juan: ..." o "14/10/26 22:15 - Juan: ...".
const ENCABEZADO_WHATSAPP = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?[^:]{1,40}:\s*/i;
const NUMERO = /(\d+(?:[.,]\d+)?)/;

function parsearLinea(lineaOriginal: string): { texto: string; cantidad: number; unidad?: string } | null {
  const linea = lineaOriginal.replace(ENCABEZADO_WHATSAPP, "").trim();
  const m = linea.match(NUMERO);
  if (!m || m.index === undefined) return null;
  const cantidad = Number(m[1].replace(",", "."));
  if (!Number.isFinite(cantidad)) return null;
  const antes = linea.slice(0, m.index);
  const despues = linea.slice(m.index + m[1].length);
  // Unidad: la palabra pegada o inmediatamente después del número.
  const unidadMatch = despues.match(/^\s*([a-záéíóúñ]+)\.?/i);
  const unidad = unidadMatch ? unidadMatch[1].toLowerCase() : undefined;
  const resto = unidadMatch ? despues.slice(unidadMatch[0].length) : despues;
  // Nombre: lo que esté antes del número ("Pollo 9kg"); si el número va
  // primero ("5 jitomate"), lo que quede después de la unidad.
  let texto = normalizar(antes);
  if (!texto) texto = normalizar(resto) || (unidad ? normalizar(unidad) : "");
  if (!texto) return null;
  return { texto, cantidad, unidad: normalizar(antes) ? unidad : undefined };
}

function palabras(t: string): string[] {
  return t.split(" ").filter(Boolean);
}

function esAbreviatura(escrito: string, nombre: string): boolean {
  const e = palabras(escrito);
  const n = palabras(nombre);
  if (e.length === 0 || e.length > n.length) return false;
  // Plural tolerado: "Elotes" también es "Elote".
  return e.every((w, i) => n[i].startsWith(w) || (w.startsWith(n[i]) && w.length - n[i].length <= 2 && /^(s|es)$/.test(w.slice(n[i].length))));
}

function esIniciales(escrito: string, nombre: string): boolean {
  if (escrito.includes(" ") || escrito.length < 2) return false;
  const n = palabras(nombre);
  return n.length === escrito.length && n.every((w, i) => w[0] === escrito[i]);
}

export function buscarInsumo(texto: string, insumos: InsumoEntry[]): string[] {
  const t = normalizar(texto);
  const claves = (i: InsumoEntry) => [i.nombre, ...(i.apodos || [])].map(normalizar);
  const pasos: ((clave: string) => boolean)[] = [
    (c) => c === t,
    (c) => esAbreviatura(t, c),
    (c) => esIniciales(t, c),
  ];
  for (const paso of pasos) {
    const hits = insumos.filter((i) => claves(i).some(paso)).map((i) => i.id);
    if (hits.length > 0) return hits;
  }
  return [];
}

export function leerNotaWhatsApp(texto: string, insumos: InsumoEntry[]): ResultadoPegado {
  const lineas: LineaReconocida[] = [];
  const ignoradas: string[] = [];
  texto.split(/\r?\n/).forEach((raw) => {
    const linea = raw.trim();
    if (!linea) return;
    const p = parsearLinea(linea);
    if (!p) {
      ignoradas.push(linea);
      return;
    }
    const hits = buscarInsumo(p.texto, insumos);
    lineas.push({
      linea,
      texto: p.texto,
      cantidad: p.cantidad,
      unidad: p.unidad,
      insumoId: hits.length === 1 ? hits[0] : undefined,
      candidatos: hits.length > 1 ? hits : [],
    });
  });
  return { lineas, ignoradas };
}

// "kg" escrito contra un insumo en Pieza (o al revés) — solo para avisar,
// nunca convierte nada.
export function unidadNoCoincide(unidadEscrita: string | undefined, unidadInsumo: string): boolean {
  if (!unidadEscrita) return false;
  const esKg = ["kg", "kgs", "kilo", "kilos", "k"].includes(unidadEscrita);
  const esPieza = ["pz", "pza", "pzas", "pzs", "pieza", "piezas"].includes(unidadEscrita);
  if (unidadInsumo === "kg") return esPieza;
  if (unidadInsumo === "pieza") return esKg;
  return false;
}
