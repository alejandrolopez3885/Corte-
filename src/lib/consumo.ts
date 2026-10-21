import { addDaysIso, normalizarNombre, pidePorOtraUnidad, round2, unidadConteo } from "./dataModel";
import { leerNotasInventario } from "./inventarioNotas";
import type { AppData, ConteoTextoArea, InsumoEntry } from "./types";

// Consumo de insumos de una semana de domingo a domingo, en la unidad en que
// se cuenta (kg/pz): inventario del domingo anterior + lo pedido en la
// semana − inventario de este domingo. Lo pedido entra desde el domingo
// anterior (el pedido que se hace junto con ese inventario llega en la
// semana) hasta el sábado. Lo que no se puede pasar a kg/pz (falta la
// equivalencia del catálogo o la unidad escrita no se reconoce) se deja
// fuera de esa semana.

const singular = (u: string) => normalizarNombre(u).replace(/e?s$/, "");

// Una cantidad del inventario ("2 cajas", "500 g", "3") a la unidad de conteo.
function inventarioAConteo(cantidad: number, unidad: string | undefined, insumo: InsumoEntry): number | null {
  const base = unidadConteo(insumo);
  if (!unidad || unidad === base) return cantidad;
  if (base === "kg" && unidad === "g") return cantidad / 1000;
  if (base === "l" && unidad === "ml") return cantidad / 1000;
  if (insumo.unidadPedido && singular(unidad) === singular(insumo.unidadPedido)) {
    return insumo.equivalenciaPedido ? cantidad * insumo.equivalenciaPedido : null;
  }
  return null;
}

// Lo pedido (en la presentación "Se pide por") a la unidad de conteo.
function pedidoAConteo(cantidad: number, insumo: InsumoEntry): number | null {
  if (!pidePorOtraUnidad(insumo)) return cantidad;
  return insumo.equivalenciaPedido ? cantidad * insumo.equivalenciaPedido : null;
}

// insumoId -> cantidad en ese inventario; null si algún renglón no se pudo
// pasar a la unidad de conteo.
function leerInventario(notas: string, insumos: InsumoEntry[]): Map<string, number | null> {
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const out = new Map<string, number | null>();
  leerNotasInventario(notas, insumos).renglones.forEach((r) => {
    if (!r.insumoId) return;
    const v = inventarioAConteo(r.cantidad, r.unidad, porId.get(r.insumoId)!);
    const previo = out.get(r.insumoId);
    out.set(r.insumoId, v === null || previo === null ? null : (previo || 0) + v);
  });
  return out;
}

// insumoId -> consumo de la semana que termina en `domingoFin`. Solo de los
// insumos que aparecen en alguno de los dos inventarios. Vacío si falta
// cualquiera de los dos.
export function consumoSemana(data: AppData, domingoFin: string): Map<string, number> {
  const domingoIni = addDaysIso(domingoFin, -7);
  const notasIni = data.inventariosNotas?.[domingoIni];
  const notasFin = data.inventariosNotas?.[domingoFin];
  const out = new Map<string, number>();
  if (notasIni === undefined || notasFin === undefined) return out;
  const ini = leerInventario(notasIni, data.insumos);
  const fin = leerInventario(notasFin, data.insumos);

  const porNombre = new Map(data.insumos.map((i) => [normalizarNombre(i.nombre), i]));
  const pedido = new Map<string, number | null>();
  const sumarPedido = (lista: Record<string, number> | undefined) =>
    Object.entries(lista || {}).forEach(([clave, n]) => {
      const insumo = porNombre.get(clave);
      if (!insumo || !(n > 0)) return;
      const v = pedidoAConteo(n, insumo);
      const previo = pedido.get(insumo.id);
      pedido.set(insumo.id, v === null || previo === null ? null : (previo || 0) + v);
    });
  // Proveedores con la semana cargada (pedidos pegados de WhatsApp, por
  // semana de lunes a domingo): se toma la carga y no los pedidos sueltos.
  const cargados = data.pedidosCargados?.[addDaysIso(domingoIni, 1)] || {};
  const sinCargados = (lista: Record<string, number> | undefined) =>
    lista &&
    Object.fromEntries(Object.entries(lista).filter(([clave]) => !cargados[porNombre.get(clave)?.proveedorId || "sin-proveedor"]));
  for (let f = domingoIni; f < domingoFin; f = addDaysIso(f, 1)) {
    (["cocina", "bar"] as ConteoTextoArea[]).forEach((area) => sumarPedido(sinCargados(data.pedidosDiarios?.[area]?.[f])));
    sumarPedido(sinCargados(data.pedidosInventario?.[f]));
  }
  Object.values(cargados).forEach((c) => sumarPedido(c.cantidades));

  new Set([...ini.keys(), ...fin.keys()]).forEach((id) => {
    const a = ini.get(id) ?? 0;
    const b = fin.get(id) ?? 0;
    const p = pedido.get(id) ?? 0;
    if (a === null || b === null || p === null) return;
    out.set(id, round2(a + p - b));
  });
  return out;
}

// Insumos que se piden en otra presentación sin decir cuánto trae.
export function insumosSinEquivalencia(insumos: InsumoEntry[]): number {
  return insumos.filter((i) => pidePorOtraUnidad(i) && !(i.equivalenciaPedido && i.equivalenciaPedido > 0)).length;
}
