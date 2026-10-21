import { normalizarNombre, round2, unidadConteo } from "./dataModel";
import { leerNotasInventario, type RenglonInventario } from "./inventarioNotas";
import type { InsumoEntry } from "./types";

// Pedidos cargados (cuenta con el permiso "Pedidos", o el dueño): se pegan
// de un jalón los mensajes de WhatsApp con los pedidos de la semana —
// mezclados de varios proveedores — y la app reconoce cada producto, lo
// acomoda con su proveedor y suma las cantidades. Se guarda por semana
// (lunes) y proveedor; al volver a pegar, lo de ese proveedor se reemplaza.
// Las cantidades van en la presentación "Se pide por" (igual que los
// pedidos del Conteo diario y del Inventario), por nombre normalizado.

export interface PedidoCargado {
  cantidades: Record<string, number>; // normalizarNombre(insumo.nombre) -> cantidad
  por: string; // quién lo cargó
  en: string; // ISO de cuándo
}

export interface ProductoLeido {
  clave: string;
  insumo: InsumoEntry;
  partes: number[]; // cada cantidad que se sumó, ya en la presentación de pedido
  total: number;
  presentacion: string;
  aviso?: string; // se escribió en otra unidad que no se pudo convertir
}

export interface PedidosLeidos {
  porProveedor: { proveedorId: string; productos: ProductoLeido[] }[]; // "" = sin proveedor
  noReconocidos: RenglonInventario[];
}

const singular = (u: string) => normalizarNombre(u).replace(/e?s$/, "");
// Misma unidad escrita de distintas formas ("paq" = "paquete").
const CANON: Record<string, string> = { paquete: "paq", pieza: "pz", pza: "pz", kilo: "kg", k: "kg", litro: "l", lt: "l" };
const canon = (u: string) => CANON[singular(u)] || singular(u);

// Una cantidad escrita ("5kg", "1 caja", "1paq") a la presentación de pedido.
function aPresentacion(cantidad: number, unidad: string | undefined, insumo: InsumoEntry): { valor: number; aviso?: string } {
  const presentacion = insumo.unidadPedido || unidadConteo(insumo);
  if (!unidad) return { valor: cantidad };
  const u = canon(unidad);
  const p = canon(presentacion);
  if (u === p) return { valor: cantidad };
  if ((u === "kg" || u === "g") && unidadConteo(insumo) === "kg") {
    const kg = u === "g" ? cantidad / 1000 : cantidad;
    if (p === "kg") return { valor: kg };
    if (insumo.equivalenciaPedido) return { valor: round2(kg / insumo.equivalenciaPedido) };
  }
  return { valor: cantidad, aviso: `Se escribió en ${unidad}; se pide por ${presentacion}` };
}

export function leerPedidosPegados(texto: string, insumos: InsumoEntry[]): PedidosLeidos {
  const { renglones } = leerNotasInventario(texto, insumos);
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const productos = new Map<string, ProductoLeido>();
  const noReconocidos: RenglonInventario[] = [];
  renglones.forEach((r) => {
    const insumo = r.insumoId ? porId.get(r.insumoId) : undefined;
    if (!insumo) {
      noReconocidos.push(r);
      return;
    }
    const { valor, aviso } = aPresentacion(r.cantidad, r.unidad, insumo);
    const prev = productos.get(insumo.id);
    if (prev) {
      prev.partes.push(valor);
      prev.total = round2(prev.total + valor);
      prev.aviso ||= aviso;
    } else {
      productos.set(insumo.id, {
        clave: normalizarNombre(insumo.nombre),
        insumo,
        partes: [valor],
        total: round2(valor),
        presentacion: insumo.unidadPedido || unidadConteo(insumo),
        aviso,
      });
    }
  });
  const grupos = new Map<string, ProductoLeido[]>();
  productos.forEach((p) => {
    const k = p.insumo.proveedorId || "";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(p);
  });
  return {
    porProveedor: [...grupos.entries()].map(([proveedorId, ps]) => ({ proveedorId, productos: ps })),
    noReconocidos,
  };
}

// Semana (lunes) de los mensajes pegados, según las fechas que pone WhatsApp
// al copiar ("[22/10/26, 10:48 p.m.]" o "22/10/26, 10:48 p. m. -"): la del
// mensaje más reciente. null si no trae fechas.
export function semanaDeLosMensajes(texto: string): { lunes: string; desde: string; hasta: string } | null {
  const fechas: string[] = [];
  for (const m of texto.matchAll(/^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}/gm)) {
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(anio, Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime())) fechas.push(`${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  }
  if (fechas.length === 0) return null;
  fechas.sort();
  const hasta = fechas[fechas.length - 1];
  const d = new Date(`${hasta}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const lunes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { lunes, desde: fechas.find((f) => f >= lunes) || lunes, hasta };
}

