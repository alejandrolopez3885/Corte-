import { unzipSync, strFromU8 } from "fflate";
import { normalizarNombre } from "./dataModel";
import type { InsumoArea, InsumoEntry, ProveedorCatalogEntry } from "./types";

// Importar catálogo (Negocio > Compras > Importar catálogo): lee la hoja
// "PRECIOS BASE" del Excel de inventario de Johnster (.xlsx/.xlsm) en el
// navegador — un .xlsx es un zip con XML adentro — y la compara contra el
// catálogo de la app.

// ---- Lector mínimo de .xlsx ------------------------------------------------
function xml(texto: string): Document {
  return new DOMParser().parseFromString(texto, "application/xml");
}
const porTag = (n: Document | Element, tag: string) => Array.from(n.getElementsByTagName(tag));

function columnaIndice(ref: string): number {
  const letras = ref.replace(/[0-9]/g, "");
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// Filas de una hoja como arreglos de texto (valores ya calculados).
export function leerHoja(archivo: ArrayBuffer, nombreHoja: string): string[][] | null {
  const zip = unzipSync(new Uint8Array(archivo));
  const leer = (ruta: string) => (zip[ruta] ? strFromU8(zip[ruta]) : null);
  const libro = leer("xl/workbook.xml");
  const rels = leer("xl/_rels/workbook.xml.rels");
  if (!libro || !rels) return null;
  const hoja = porTag(xml(libro), "sheet").find((s) => (s.getAttribute("name") || "").trim().toUpperCase() === nombreHoja.toUpperCase());
  if (!hoja) return null;
  const rid = hoja.getAttribute("r:id") || hoja.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const rel = porTag(xml(rels), "Relationship").find((r) => r.getAttribute("Id") === rid);
  if (!rel) return null;
  const destino = (rel.getAttribute("Target") || "").replace(/^\//, "");
  const ruta = destino.startsWith("xl/") ? destino : `xl/${destino}`;
  const sheetXml = leer(ruta);
  if (!sheetXml) return null;

  const compartidos = (() => {
    const ss = leer("xl/sharedStrings.xml");
    if (!ss) return [] as string[];
    return porTag(xml(ss), "si").map((si) => porTag(si, "t").map((t) => t.textContent || "").join(""));
  })();

  const filas: string[][] = [];
  porTag(xml(sheetXml), "row").forEach((row) => {
    const fila: string[] = [];
    porTag(row, "c").forEach((c) => {
      const i = columnaIndice(c.getAttribute("r") || "A1");
      const tipo = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let valor = v;
      if (tipo === "s") valor = compartidos[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = porTag(c, "t").map((t) => t.textContent || "").join("");
      fila[i] = valor;
    });
    filas.push(Array.from(fila, (x) => (x ?? "").replace(/\s+/g, " ").trim()));
  });
  return filas;
}

// ---- Hoja PRECIOS BASE -------------------------------------------------------
export interface FilaPrecio {
  nombre: string;
  proveedor: string;
  seccion: string;
  presentacion: string;
  precio: number;
  nota: string;
}

export function leerPreciosBase(filas: string[][]): FilaPrecio[] {
  const iEnc = filas.findIndex((f) => f.some((c) => c.toUpperCase() === "INSUMO"));
  if (iEnc < 0) return [];
  const enc = filas[iEnc].map((c) => c.toUpperCase());
  const col = (txt: string) => enc.findIndex((c) => c.includes(txt));
  const cNombre = col("INSUMO");
  const cProv = col("PROVEEDOR");
  const cPres = col("PRESENTACI");
  const cPrecio = col("PRECIO");
  const cNota = col("NOTA");
  const out: FilaPrecio[] = [];
  let seccion = "";
  filas.slice(iEnc + 1).forEach((f) => {
    const nombre = f[cNombre] || "";
    if (nombre.includes("▶")) {
      seccion = nombre.replace("▶", "").trim();
      return;
    }
    const precio = Number(f[cPrecio]);
    if (!nombre || !Number.isFinite(precio) || precio <= 0) return;
    out.push({
      nombre,
      proveedor: f[cProv] || "",
      seccion,
      presentacion: f[cPres] || "",
      precio: Math.round(precio * 100) / 100,
      nota: cNota >= 0 ? f[cNota] || "" : "",
    });
  });
  return out;
}

// ---- De fila del Excel a insumo de la app -----------------------------------
const ES_KG = /^(kg|kgs|kilo|kilos)$/i;
const ES_PIEZA = /^(pza|pz|pzas|pieza|piezas)$/i;

// Bar siempre cuenta en piezas (igual que su modal de insumo).
export function unidadDe(presentacion: string, area?: InsumoArea): "kg" | "pieza" {
  if (area === "bar") return "pieza";
  return ES_KG.test(presentacion.trim()) ? "kg" : "pieza";
}

// "Bolsa", "Millar", "12 Piezas"… se guardan como "Se pide por"; kg o pieza no.
export function seDidePor(presentacion: string): string | undefined {
  const p = presentacion.trim();
  if (!p || ES_KG.test(p) || ES_PIEZA.test(p)) return undefined;
  return p.toLowerCase();
}

const BAR = /COCA|HEINEKEN|CERVEZA|BEBIDAS|MIXERS|VINOS|LICORES|CONCENTRADOS|LIMONADAS/i;
const GENERAL = /DESECHABLES|LIMPIEZA|HIGIENE|OTROS|VARIOS/i;
const ESPECIA = /ajo|pimienta|paprika|sal\b|especia/i;

export function areaSugerida(f: FilaPrecio): InsumoArea {
  if (BAR.test(f.seccion)) return "bar";
  if (GENERAL.test(f.seccion)) return ESPECIA.test(f.nombre) ? "cocina" : "general";
  return "cocina";
}

export const esPendiente = (nota: string) => /PENDIENTE|CONFIRMAR/i.test(nota);

// ---- Comparación contra el catálogo -----------------------------------------
function distancia(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

export type TipoCambio = "nuevo" | "cambia" | "igual";

export interface CambioCatalogo {
  fila: FilaPrecio;
  tipo: TipoCambio;
  existente?: InsumoEntry; // el insumo de la app que corresponde
  parecido?: InsumoEntry; // nombre parecido: se pregunta si es el mismo
  diferencias: { campo: string; antes: string; despues: string }[];
  area: InsumoArea; // para los nuevos (sugerida, editable)
  pendiente: boolean;
}

const dinero = (n?: number) => (n === undefined ? "—" : `$${n.toFixed(2)}`);

export function compararCatalogo(filas: FilaPrecio[], insumos: InsumoEntry[], proveedores: ProveedorCatalogEntry[]): CambioCatalogo[] {
  const nombreProv = (id?: string) => proveedores.find((p) => p.id === id)?.nombre || "";
  const usados = new Set<string>();
  return filas.map((f) => {
    const clave = normalizarNombre(f.nombre);
    const exacto = insumos.find(
      (i) => !usados.has(i.id) && (normalizarNombre(i.nombre) === clave || (i.apodos || []).some((a) => normalizarNombre(a) === clave))
    );
    let parecido: InsumoEntry | undefined;
    if (!exacto) {
      parecido = insumos.find((i) => {
        if (usados.has(i.id)) return false;
        const n = normalizarNombre(i.nombre);
        return distancia(n, clave) <= Math.max(1, Math.floor(Math.min(n.length, clave.length) / 6));
      });
    }
    const existente = exacto || parecido;
    if (existente) usados.add(existente.id);
    const base = { fila: f, area: existente?.area ?? areaSugerida(f), pendiente: esPendiente(f.nota) };
    if (!existente) return { ...base, tipo: "nuevo" as const, diferencias: [] };
    const diferencias: CambioCatalogo["diferencias"] = [];
    if (existente.precio !== f.precio) diferencias.push({ campo: "Precio", antes: dinero(existente.precio), despues: dinero(f.precio) });
    const pide = seDidePor(f.presentacion) || "";
    const unidad = unidadDe(f.presentacion, existente.area);
    if ((existente.unidadPedido || "").toLowerCase() !== pide)
      diferencias.push({ campo: "Se pide por", antes: existente.unidadPedido || existente.unidad, despues: pide || unidad });
    if (existente.unidad !== unidad) diferencias.push({ campo: "Unidad", antes: existente.unidad, despues: unidad });
    if (normalizarNombre(nombreProv(existente.proveedorId)) !== normalizarNombre(f.proveedor))
      diferencias.push({ campo: "Proveedor", antes: nombreProv(existente.proveedorId) || "—", despues: f.proveedor });
    return {
      ...base,
      tipo: diferencias.length || parecido ? ("cambia" as const) : ("igual" as const),
      existente: exacto,
      parecido,
      diferencias,
    };
  });
}
