import { normalizarNombre } from "./dataModel";
import type { AppData } from "./types";

// Une productos repetidos del catálogo en el que se queda: los nombres y
// apodos de los otros pasan a ser apodos suyos (así las notas viejas se
// siguen leyendo), toma lo que le falte (precio, proveedor, presentación)
// y las capturas viejas por insumo (conteo diario e inventario/pedido
// semanal) se pasan a él. El historial en texto no cambia.
// `sinApodos`: nombres que NO deben quedar como apodo (p. ej. "Limón", que
// ya es otro producto).
export function unirInsumosEn(next: AppData, quedaId: string, otrosIds: string[], sinApodos: string[] = []): boolean {
  const queda = next.insumos.find((i) => i.id === quedaId);
  const otros = next.insumos.filter((i) => otrosIds.includes(i.id) && i.id !== quedaId);
  if (!queda || otros.length === 0) return false;
  const excluidos = sinApodos.map(normalizarNombre);
  const nombres = [...(queda.apodos || []), ...otros.flatMap((o) => [o.nombre, ...(o.apodos || [])])];
  const apodos = nombres.filter(
    (a, i) =>
      normalizarNombre(a) !== normalizarNombre(queda.nombre) &&
      !excluidos.includes(normalizarNombre(a)) &&
      nombres.findIndex((b) => normalizarNombre(b) === normalizarNombre(a)) === i
  );
  if (apodos.length > 0) queda.apodos = apodos;
  else delete queda.apodos;
  otros.forEach((o) => {
    if (queda.precio === undefined && o.precio !== undefined) queda.precio = o.precio;
    if (!queda.proveedorId && o.proveedorId) queda.proveedorId = o.proveedorId;
    if (!queda.unidadPedido && o.unidadPedido) {
      queda.unidadPedido = o.unidadPedido;
      if (o.equivalenciaPedido) queda.equivalenciaPedido = o.equivalenciaPedido;
    }
    if (o.altaRotacion && o.area === queda.area) queda.altaRotacion = true;
  });
  const mover = (filas: Record<string, unknown> | undefined) => {
    if (!filas) return;
    otros.forEach((o) => {
      if (filas[o.id] !== undefined && filas[queda.id] === undefined) filas[queda.id] = filas[o.id];
      delete filas[o.id];
    });
  };
  Object.values(next.conteosDiarios || {}).forEach(mover);
  Object.values(next.inventarioSemanal || {}).forEach((m) => m.weeks.forEach((w) => mover(w?.filas)));
  Object.values(next.pedidosSemanal || {}).forEach((m) => m.weeks.forEach((w) => mover(w?.filas)));
  next.insumos = next.insumos.filter((i) => !otros.some((o) => o.id === i.id));
  return true;
}

// Une un proveedor repetido (seVa) con el que se queda: sus insumos (y
// facturas) pasan al que se queda, su nombre queda como apodo para que
// Importar catálogo no lo vuelva a crear, y si alguno se contaba los
// jueves, el que se queda también.
export function unirProveedoresEn(next: AppData, quedaId: string, seVaId: string): boolean {
  if (quedaId === seVaId) return false;
  const queda = next.proveedores.find((p) => p.id === quedaId);
  const seVa = next.proveedores.find((p) => p.id === seVaId);
  if (!queda || !seVa) return false;
  next.insumos.forEach((i) => {
    if (i.proveedorId === seVaId) i.proveedorId = quedaId;
  });
  next.facturas.forEach((f) => {
    if (f.proveedorId === seVaId) f.proveedorId = quedaId;
  });
  const apodos = [...(queda.apodos || []), seVa.nombre, ...(seVa.apodos || [])];
  queda.apodos = apodos.filter(
    (a, i) => normalizarNombre(a) !== normalizarNombre(queda.nombre) && apodos.findIndex((b) => normalizarNombre(b) === normalizarNombre(a)) === i
  );
  if (seVa.incluyeJueves) queda.incluyeJueves = true;
  next.proveedores = next.proveedores.filter((p) => p.id !== seVaId);
  return true;
}

// Limpieza única del catálogo (noviembre 2026), aprobada por el dueño:
// 1) une Limonadas con Sabroeats, 2) quita apodos que confunden productos,
// 3) ordena nombres, unidad, área y "Se pide por" repetido. Todo por id, así
// que es seguro correrla otra vez: lo que ya está hecho no cambia nada.
const SABROEATS = "mtws6mzh-vop7pz";
const LIMONADAS = "mvgk1krc-qccm73";
const LACTEOS = "mtws6b5h-vortfi";

// [producto de Limonadas, concentrado de Sabroeats en el que se une]
const UNIONES_LIMONADAS: [string, string][] = [
  ["mvgk1krc-jhqg66", "mvghx4hs-m3hika"], // Concentrado de piña → Concentrado Piña
  ["mvgk1krc-7etcgx", "mvghx4hs-4012cb"], // Fresa → Concentrado Fresa
  ["mvgk1krc-n7lq3u", "muaehwsg-3ufm3x"], // Frutos rojos → Concentrado de Frutos rojos
  ["mvgk1krc-58b21c", "mvgfbffe-k92l4w"], // Limón (Bar) → Concentrado de Limón
  ["mvgk1krc-ejbkyi", "mvgfbffe-z6dqnk"], // Mango → Concentrado Mango
  ["mvgk1krc-ipm2hh", "mvghizmy-ehwevh"], // Maracuyá → Concentrado Maracuyá
  ["mvgk1krc-p20zvn", "muaehwsg-wfwr92"], // Pepino → Concentrado de Pepino
];

const APODOS_MALOS: [string, string[]][] = [
  ["muae59lb-1b4id2", ["Fresa"]], // Contenedor 6x6 negro
  ["mvgfbfff-438y26", ["lemon búfalo galón"]], // Chorizo
  ["muado9n3-7xp93m", ["búfalo"]], // Chipotle ranch
  ["mvgfbffg-uuhi3w", ["Hoja perejil"]], // Palillo para decorar
  ["muaeb22f-5wce2s", ["limón", "Limon"]], // Limón (Verdura): ya se reconoce por su nombre
];

const NOMBRES: [string, string][] = [
  ["mvghza23-birljk", "Contenedor 8x8"],
  ["mvgi6l1t-w80ptt", "Tapa vaso litro"],
  ["mvgfbffe-k92l4w", "Concentrado de Limón"],
];

const PIDE_LO_MISMO = ["Carne de hamburguesa", "Carne de taco", "Tapa vaso medio litro"];
const PIDE_LO_MISMO_IDS = ["muaeb22f-5wce2s", "mvghza23-birljk", "mvgi6l1t-w80ptt"];

export function limpiarCatalogo(base: AppData): { next: AppData; cambios: number } {
  const next = structuredClone(base);
  let cambios = 0;
  const marca = (hecho: boolean) => {
    if (hecho) cambios++;
  };

  UNIONES_LIMONADAS.forEach(([otro, queda]) => marca(unirInsumosEn(next, queda, [otro], ["Limón"])));
  if (!next.insumos.some((i) => i.proveedorId === LIMONADAS)) marca(unirProveedoresEn(next, SABROEATS, LIMONADAS));

  APODOS_MALOS.forEach(([id, malos]) => {
    const i = next.insumos.find((x) => x.id === id);
    if (!i?.apodos) return;
    const quedan = i.apodos.filter((a) => !malos.includes(a));
    if (quedan.length === i.apodos.length) return;
    if (quedan.length > 0) i.apodos = quedan;
    else delete i.apodos;
    cambios++;
  });

  const lacteos = next.proveedores.find((p) => p.id === LACTEOS);
  if (lacteos && lacteos.nombre === "Lacteos") {
    lacteos.nombre = "Lácteos";
    lacteos.apodos = [...(lacteos.apodos || []), "Lacteos"];
    cambios++;
  }
  NOMBRES.forEach(([id, nombre]) => {
    const i = next.insumos.find((x) => x.id === id);
    if (i && i.nombre !== nombre) {
      i.nombre = nombre;
      cambios++;
    }
  });
  next.insumos.forEach((i) => {
    if (i.unidad === "Pieza") {
      i.unidad = "pieza";
      cambios++;
    }
    if (i.id === "muaoormm-75tb8i" && i.area === "general") {
      i.area = "cocina"; // Chiles jalapeños enlatados
      cambios++;
    }
    const pideLoMismo = PIDE_LO_MISMO_IDS.includes(i.id) || (PIDE_LO_MISMO.includes(i.nombre) && !!i.unidadPedido);
    if (pideLoMismo && i.unidadPedido && ["kilos", "kg", "pz"].includes(i.unidadPedido.trim().toLowerCase())) {
      delete i.unidadPedido;
      delete i.equivalenciaPedido;
      cambios++;
    }
  });
  return { next, cambios };
}
