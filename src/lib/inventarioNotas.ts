import type { InsumoEntry } from "./types";

// Lector de las notas libres del Inventario (domingo/jueves): el cocinero
// escribe lo que va contando, un producto por renglón, como le salga
// (".6 consomé", "1k ajo en polvo", "500 bolsas Johnster", "Pollo 9kg").
// Cada renglón se separa en cantidad + unidad (si la escribió) + nombre, y
// el nombre se busca en el catálogo por nombre o apodo — exacto, abreviado
// ("Toci" → Tocino), en otro orden de palabras o por iniciales. Solo se
// acepta si la coincidencia es única; lo demás se le pregunta al usuario,
// que lo liga una vez y queda guardado como apodo del insumo.

export interface RenglonInventario {
  linea: string; // el renglón tal cual
  cantidad: number;
  cantidadTexto: string; // "0.6", "500"
  unidad?: string; // "kg", "g", "bolsa"... solo si la escribió
  texto: string; // el nombre como lo escribió
  insumoId?: string;
  candidatos: string[]; // cuando hubo más de uno posible
}

export interface NotasLeidas {
  renglones: RenglonInventario[];
  sinCantidad: string[]; // renglones con texto pero sin número
}

// Unidades que se reconocen pegadas o junto al número; la llave es como se
// escribe y el valor como se muestra.
const UNIDADES: Record<string, string> = {
  k: "kg", kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg",
  g: "g", gr: "g", grs: "g", gm: "g", gms: "g", gramos: "g",
  pz: "pz", pza: "pz", pzas: "pz", pzs: "pz", pieza: "pz", piezas: "pz",
  paq: "paq", paquete: "paq", paquetes: "paq",
  bolsa: "bolsa", bolsas: "bolsa", caja: "caja", cajas: "caja", bote: "bote", botes: "bote",
  l: "l", lt: "l", lts: "l", litro: "l", litros: "l", ml: "ml",
};

export function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(w: string): string {
  if (w.length > 4 && w.endsWith("es") && !/[aeiou]es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

// Palabras que no ayudan a distinguir un producto ("1 caja de francesa",
// "carne para taco" ≈ "Carne de taco").
const VACIAS = new Set(["de", "del", "la", "las", "el", "los", "para", "con", "y", "a", "al"]);

function palabras(t: string): string[] {
  const todas = normalizar(t).split(" ").filter(Boolean);
  const utiles = todas.filter((w) => !VACIAS.has(w));
  return (utiles.length > 0 ? utiles : todas).map(singular);
}

const NUM = String.raw`(\d*[.,]?\d+)`;
const ENCABEZADO_WHATSAPP = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?[^:]{1,40}:\s*/i;

function aNumero(s: string): number {
  return Number(s.replace(",", "."));
}

function partirRenglon(raw: string): { cantidadTexto: string; unidadEscrita?: string; texto: string } | null {
  const linea = raw.replace(ENCABEZADO_WHATSAPP, "").replace(/^[-•*·]\s*/, "").trim();
  // Número al inicio: "500 bolsas Johnster", "1k ajo", "250 gms habanero".
  let m = linea.match(new RegExp(`^${NUM}\\s*([a-záéíóúñ]+)?\\.?(?:\\s+(.*))?$`, "i"));
  if (m) {
    const [, n, palabra, resto] = m;
    // Palabra pegada al número que no es unidad (ej. "6x6") — todo es nombre.
    if (palabra && !resto && !UNIDADES[palabra.toLowerCase()]) return { cantidadTexto: n, texto: palabra };
    return { cantidadTexto: n, unidadEscrita: palabra, texto: resto || "" };
  }
  // Número al final: "Pollo 9kg", "Tocino: 1".
  m = linea.match(new RegExp(`^(.*?)[\\s:]+${NUM}\\s*([a-záéíóúñ]+)?\\.?$`, "i"));
  if (m) return { cantidadTexto: m[2], unidadEscrita: m[3], texto: m[1] };
  return null;
}

function claves(i: InsumoEntry): string[][] {
  return [i.nombre, ...(i.apodos || [])].map(palabras);
}

function igual(a: string[], b: string[]) {
  return a.length === b.length && a.every((w, i) => w === b[i]);
}
// Cada palabra escrita es el inicio de la palabra del nombre, en orden.
function abreviado(e: string[], n: string[]) {
  return e.length > 0 && e.length <= n.length && e.every((w, i) => n[i].startsWith(w));
}
// Mismas palabras (o su inicio) pero en cualquier orden / con palabras de más
// en el catálogo: "queso suizo" ≈ "Queso suizo rebanado".
function contenido(e: string[], n: string[]) {
  return e.length > 0 && e.every((w) => n.some((x) => x.startsWith(w)));
}
function iniciales(e: string[], n: string[]) {
  return e.length === 1 && e[0].length >= 2 && n.length === e[0].length && n.every((x, i) => x[0] === e[0][i]);
}

export function buscarInsumo(texto: string, insumos: InsumoEntry[]): string[] {
  const e = palabras(texto);
  if (e.length === 0) return [];
  // Lo que el usuario ya ligó a mano (apodo exacto de un solo insumo) gana,
  // aunque otro insumo se llame igual.
  const porApodo = insumos.filter((i) => (i.apodos || []).some((a) => igual(e, palabras(a))));
  if (porApodo.length === 1) return [porApodo[0].id];
  for (const prueba of [igual, abreviado, contenido, iniciales]) {
    const hits = insumos.filter((i) => claves(i).some((k) => prueba(e, k))).map((i) => i.id);
    if (hits.length > 0) return hits;
  }
  return [];
}

export function leerNotasInventario(notas: string, insumos: InsumoEntry[]): NotasLeidas {
  const renglones: RenglonInventario[] = [];
  const sinCantidad: string[] = [];
  notas.split(/\r?\n/).forEach((raw) => {
    const linea = raw.trim();
    if (!linea) return;
    const p = partirRenglon(linea);
    if (!p || !p.texto.trim()) {
      if (/[a-záéíóúñ]/i.test(linea)) sinCantidad.push(linea);
      return;
    }
    const unidad = p.unidadEscrita ? UNIDADES[p.unidadEscrita.toLowerCase()] : undefined;
    // Si la palabra después del número no es unidad, es parte del nombre
    // ("5 huevos"). Si es unidad pero también puede ser parte del nombre
    // ("500 bolsas Johnster"), primero se prueba con ella y luego sin ella.
    // "0 Limón (Bar)": el área entre paréntesis al final dice de cuál
    // catálogo es (la escribe "Faltan por contar" cuando hay dos productos
    // con el mismo nombre en áreas distintas).
    const conArea = p.texto.match(/^(.*?)\s*\((bar|cocina|general)\)\s*$/i);
    const entre = conArea ? insumos.filter((i) => i.area === conArea[2].toLowerCase()) : insumos;
    if (conArea) p.texto = conArea[1];
    const conPalabra = p.unidadEscrita ? `${p.unidadEscrita} ${p.texto}` : p.texto;
    let texto = unidad ? p.texto : conPalabra;
    let hits = buscarInsumo(texto, entre);
    let unidadFinal = unidad;
    if (unidad) {
      const hitsCon = buscarInsumo(conPalabra, entre);
      if (hitsCon.length === 1 || (hitsCon.length > 0 && hits.length !== 1)) {
        hits = hitsCon;
        texto = conPalabra;
        unidadFinal = undefined;
      }
    }
    const cantidad = aNumero(p.cantidadTexto);
    renglones.push({
      linea,
      cantidad,
      cantidadTexto: String(cantidad),
      unidad: unidadFinal,
      texto: texto.trim(),
      insumoId: hits.length === 1 ? hits[0] : undefined,
      candidatos: hits.length > 1 ? hits : [],
    });
  });
  return { renglones, sinCantidad };
}
