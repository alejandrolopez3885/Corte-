import { normalizarNombre } from "./dataModel";
import type { AppData, InsumoEntry } from "./types";

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
  Object.values(next.pedidosDiarios || {}).forEach((porFecha) => Object.values(porFecha || {}).forEach(mover));
  Object.values(next.pedidosInventario || {}).forEach(mover);
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
  ["mvghza23-birljk", "Contenedor negro 8x8"],
  ["mvgi6l1t-w80ptt", "Tapa vaso litro"],
  ["mvgfbffe-k92l4w", "Concentrado de limón"],
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
  cambios += catalogoLibreta(next);
  return { next, cambios };
}

// ---------------------------------------------------------------------------
// Segunda parte (noviembre 2026, aprobada por el dueño): el catálogo queda
// igual a la lista de la libreta de Metroplex + el Excel de precios base,
// sin repetidos. Une lo repetido en el que se queda (el de conteo diario si
// hay), pone nombres, unidad y "Se cuenta por" de la libreta, mueve
// productos de proveedor, quita apodos que confunden, borra los postres que
// ya no se venden y agrega los nuevos. Todo por id: correrla otra vez no
// cambia nada. Coca-Cola, cervezas y lo demás del Conteo diario no se tocan.
const P = {
  fracksa: "mtws53vr-qxksaz",
  lorsa: "mtws576s-5soov6",
  wish: "mtws624z-rbgqqq",
  johnster: "mtws6xje-0i1m1u",
};

// [se queda, se unen en él]
const UNIONES: [string, string[]][] = [
  ["muadacgx-kfe5ct", ["mvgfbffd-gnvkgc"]], // Catsup de sobre ← Ketchup de sobre
  ["muadang8-x6x2ix", ["mvgfbffd-hrgcma"]], // Bote de catsup ← Ketchup de servicios
  ["muadbgyn-rwyvuh", ["mvgfbffd-cbnj1w"]], // Pollo (conteo diario) ← Pechuga de pollo
  ["muadbrjm-az0ucr", ["mvgfbffd-u8kecr"]], // Alitas (conteo diario) ← Alitas 1 y 2
  ["mu9pxjj1-4co1re", ["mvgfbffd-ev9ojl"]], // Pan de hamburguesa ← Pan para burger
  ["mu9r9fpc-fkszmf", ["mvgfbffd-orc6tf"]], // Pan de hot dog ← Pan para hotdog
  ["mvgfbffd-akseez", ["muadf152-zzcd62"]], // Lyncott ← Crema para batir Lyncott
  ["mvgfbffd-9myr6f", ["muadhyrl-j4htb4"]], // Aceite ← Bidón de aceite
  ["mveg7ved-edldy5", ["muadkbt2-tfkoum"]], // Lemon buffalo ← Salsa lemon buffalo
  ["mvgfbffe-grdh11", ["muadn56t-ltgntf", "mvgfbfff-fql3um"]], // Mango habanero (Wish) ← Salsa mango habanero, Mango habanero (Johnster)
  ["mvghza23-birljk", ["mvgfbffe-8jzhye"]], // Contenedor negro 8x8 ← Contenedor liso negro 8x8
  ["muae59lb-1b4id2", ["mvgfbffe-t744wz"]], // Contenedor negro 6x6 ← Contenedor hamburguesero negro
  ["muadqopl-4jv1dt", ["mvgfbffe-8htage"]], // Ramiking ← Vaso para aderezo 2 oz
  ["muadr1mu-yk6jfm", ["mvgfbffe-avuy4o"]], // Tapa ramiking ← Tapa para vaso de aderezo 2 oz
  ["mvgfbffe-d6lgka", ["muadrh2c-is2jle"]], // Bolsa Johnster ← Millar bolsa Johnster
  ["muadtatb-wohby5", ["mvgfbffe-wvqc0j"]], // Bolsa 1 kg ← Bolsa en rollo alta densidad
  ["muaf4ycj-cn4jtt", ["mvgfbffe-96wqec"]], // Bolsa bollo 10x20 ← Bolsa 10x20 transparente granel
  ["muaf55c0-y8511n", ["mvgfbffe-qwq9b4"]], // Tenedor negro ← Cubierto negro
  ["muaf5p2l-sdmn4s", ["mvgfbffe-9j4eui"]], // Bolsa negra jumbo ← Bolsa para basura baja densidad
  ["muae45m0-p0laqs", ["mvgfbffe-0rfbn5"]], // Ajo molido ← a granel
  ["muae4crv-pt5y06", ["mvgfbffe-p93833"]], // Pimienta negra ← a granel
  ["muae4jz4-ewei9g", ["mvgfbffe-bavfs1"]], // Paprika ← a granel
  ["muae4ytf-isrwf3", ["mvgfbffe-c1cinj", "muadnl0l-m8hsi8"]], // Lemon pepper polvo (Lorsa) ← Pimienta limón, el de Wish
  ["muaeb22f-bi1k91", ["mvgfbffe-tp8edo"]], // Jalapeño ← Jalapeño (fresco)
  ["muaeb22f-5wce2s", ["mvgfbffe-eaybjh"]], // Limón ← Limón (fresco)
  ["muaeb22f-mfv6kj", ["mvgfbffe-ty4454"]], // Papa blanca ← Papa (fresca)
  ["muarm6uu-2iap14", ["mu9q1h8f-0oy2l3"]], // Agua natural ← Agua natural Johnster
  ["mvgfbffg-0on53a", ["mveg5b2s-ndpgs9"]], // Palillo elotero ← Palo elotero
  ["mu9ra2sp-b0un4j", ["mvgfbffe-67tdv2"]], // Carne de hamburguesa ← Carne molida 80/20
  ["muadp8eu-sqt69p", ["mvgfbffe-a9gqvp"]], // Carne de taco ← Pulpa china
  ["mu9qqvrr-brsblr", ["mvgfbffe-mo1i8q", "mv940wef-67hvj2"]], // XX Lager ← Dos Equis (XX) Lager, XX
  ["muarm6uv-95pjq9", ["mvgfbffe-o6c34m"]], // XX ultra ← Dos Equis (XX) Ultra
  ["muarm6uv-8gwouv", ["mvgfbffe-ycpnxr"]], // XX ámbar ← Dos Equis (XX) Ambar
  ["muarm6uv-db8w6j", ["mvgfbffe-foqn8c"]], // Coca light ← Coca-Cola Light
  ["muf8ghp6-6y67pf", ["mvgfbffe-ikbzkp"]], // Coca regular ← Coca-Cola Regular
  ["muarm6uv-ab2a29", ["mvgfbffe-n7mtup"]], // Coca zero ← Coca-Cola Sin Azúcar
];
// Nombres que NO deben quedar como apodo al unir (ya son otro producto).
const SIN_APODO = ["lemon pepper", "Limón", "Mango"];

type Ajuste = { nombre?: string; unidad?: "kg" | "pieza"; presentacion?: string | null; proveedorId?: string; unidadPedido?: null; quitarApodos?: string[] };
const AJUSTES: Record<string, Ajuste> = {
  // Fracksa
  "muad9hlu-oobd5n": { nombre: "Elote" },
  "muad9sh2-ub09te": { presentacion: "bolsa", unidadPedido: null },
  "muadacgx-kfe5ct": { presentacion: "millar", unidadPedido: null },
  "muadang8-x6x2ix": { nombre: "Bote de catsup", unidadPedido: null },
  // Lácteos
  "muade007-qf2i7v": { nombre: "Crema ácida" },
  "mvgfbffd-akseez": { presentacion: "litro", unidadPedido: null },
  "muadfrzq-wvlxpr": { presentacion: "paquete", unidadPedido: null },
  "muaddcqt-95t27r": { nombre: "Queso cheddar" },
  // Aceite
  "mvgfbffd-9myr6f": { presentacion: "bidón", unidadPedido: null },
  // Wish
  "muadiqdj-c2nx4w": { nombre: "Salsa BBQ" },
  "mvgfbffe-grdh11": { nombre: "Mango habanero", quitarApodos: ["mango habanero galón"] },
  "mveg8dge-ovn07n": { nombre: "Lemon pepper líquido", presentacion: "galón", unidadPedido: null },
  "muadnukk-udf194": { nombre: "Queso amarillo", quitarApodos: ["queso"] },
  // Huachileteke
  "mvgfbffe-9d5roy": { nombre: "Jalapeño ranch" },
  // Lorsa
  "mvghza23-birljk": { nombre: "Contenedor negro 8x8", presentacion: null, unidadPedido: null, quitarApodos: ["8x8"] },
  "muae59lb-1b4id2": { nombre: "Contenedor negro 6x6" },
  "muadqopl-4jv1dt": { nombre: "Ramiking negro 2 oz", presentacion: null, unidadPedido: null },
  "muadr1mu-yk6jfm": { nombre: "Tapa ramiking 2 oz", presentacion: null, unidadPedido: null },
  "muaendvw-njiabi": { proveedorId: P.lorsa },
  "muaenjxh-yhw03i": { proveedorId: P.lorsa },
  "mvgfbffe-d6lgka": { presentacion: null, unidadPedido: null },
  "mvgfbffe-dit9jt": { nombre: "Botella PET 500 ml" },
  "mvgfbffe-lgm0l3": { nombre: "Popote estuchado", presentacion: "caja" },
  "muadtatb-wohby5": { nombre: "Bolsa 1 kg" },
  "muaf4ycj-cn4jtt": { nombre: "Bolsa bollo 10x20", unidad: "pieza", presentacion: "paquete" },
  "muaf55c0-y8511n": { presentacion: "paquete", quitarApodos: ["Palillo decoracion"] },
  "muaf5egp-rpp1z5": { unidad: "pieza", presentacion: "paquete" },
  "muaf5p2l-sdmn4s": { presentacion: "paquete" },
  "muae4ytf-isrwf3": { quitarApodos: ["Lemon pepper polvo"] },
  // Verdura
  "muaeb22f-rzj27d": { unidad: "pieza" },
  // Sabroeats: todos "Concentrado de …"
  "muaehwsg-3ufm3x": { nombre: "Concentrado de frutos rojos", quitarApodos: ["queso líquido"] },
  "mvgfbffe-k92l4w": { nombre: "Concentrado de limón" },
  "mvghs001-klra2t": { nombre: "Concentrado de mora" },
  "muaehwsg-wfwr92": { nombre: "Concentrado de pepino" },
  "muaehwsg-dnbstw": { nombre: "Concentrado de sandía" },
  "muaehwsg-q0uqge": { nombre: "Concentrado de tamarindo" },
  "mvghx4hs-4012cb": { nombre: "Concentrado de fresa" },
  "mvgfbffe-gecrx1": { nombre: "Concentrado de jamaica" },
  "mvgfbffe-z6dqnk": { nombre: "Concentrado de mango", quitarApodos: ["Mango"] },
  "mvghizmy-ehwevh": { nombre: "Concentrado de maracuyá" },
  "mvghx4hs-m3hika": { nombre: "Concentrado de piña" },
  // Postres
  "muaer6u0-9lib45": { nombre: "Cheesecake tortuga" },
  // Compras Johnster
  "mvgfbffg-aa8air": { presentacion: "paquete", unidadPedido: null },
  "muaoormm-r3i5cs": { unidad: "kg" },
  "mvgfbffg-d3ehsr": { nombre: "Caja combo (paquete de 25)", presentacion: "paquete", unidadPedido: null },
  "mvgfbfff-792d2m": { presentacion: "paquete", unidadPedido: null },
  "muaer6u0-5ymd03": { presentacion: "5 piezas", unidadPedido: null },
  "muaer6u0-q0cxq8": { presentacion: "porrón", unidadPedido: null },
  "muaer6u0-kk9oyt": { presentacion: "porrón", unidadPedido: null },
  "muaer6u0-hib8sk": { presentacion: "porrón", unidadPedido: null },
  "muaer6u0-h42blz": { presentacion: "paquete", unidadPedido: null },
  "muaer6u0-6dz0q6": { presentacion: "paquete", unidadPedido: null },
  "mvgfbffg-wwbp00": { presentacion: "paquete", unidadPedido: null },
  "mvgfbffg-slpxp9": { presentacion: "paquete", unidadPedido: null },
  "mveg6seb-1muuyy": { presentacion: "paquete", unidadPedido: null },
  "muaoormm-ev42h9": { presentacion: "paquete", unidadPedido: null },
  "muaoormm-izp7me": { presentacion: "bolsa", unidadPedido: null },
  "muaoormm-81vqnm": { presentacion: "bolsa", unidadPedido: null },
  "muaoormm-04cu51": { presentacion: "bolsa", unidadPedido: null },
  "muaoormm-ncih1l": { presentacion: "bolsa", unidadPedido: null },
  "muaoormm-m14q74": { presentacion: "bolsa", unidadPedido: null },
  "mvgfbffg-uuhi3w": { presentacion: "bolsa", unidadPedido: null },
  "mvgfbffg-0on53a": { presentacion: "bolsa", unidadPedido: null },
  "muaoormm-o1wl8e": { presentacion: "paquete", unidadPedido: null },
  "muaoormm-c7d7ox": { presentacion: "tapa", unidadPedido: null },
  "muaoormm-9v3fzw": { presentacion: "bote", unidadPedido: null },
  "muaoormm-8zgomh": { nombre: "José Cuervo" },
  "muaer6u0-56em4h": { nombre: "Jabón arcoíris" },
};
// Postres que ya no se venden.
const BORRAR = ["mvgfbfff-ppcpzb", "mvgfbfff-ajox55", "mvgfbfff-eobeeu"];
const NUEVOS: InsumoEntry[] = [
  { id: "libreta-polvo-azul", nombre: "Polvo azul", area: "general", unidad: "pieza", proveedorId: P.johnster },
  { id: "libreta-champu-azul", nombre: "Champú azul", area: "general", unidad: "pieza", proveedorId: P.johnster },
];

function catalogoLibreta(next: AppData): number {
  let cambios = 0;
  UNIONES.forEach(([queda, otros]) => {
    if (unirInsumosEn(next, queda, otros, SIN_APODO)) cambios++;
  });
  Object.entries(AJUSTES).forEach(([id, a]) => {
    const i = next.insumos.find((x) => x.id === id);
    if (!i) return;
    if (a.nombre && i.nombre !== a.nombre) {
      // El nombre de antes queda como apodo (las notas viejas se siguen leyendo).
      const viejo = i.nombre;
      i.nombre = a.nombre;
      if (normalizarNombre(viejo) !== normalizarNombre(a.nombre) && !(i.apodos || []).some((x) => normalizarNombre(x) === normalizarNombre(viejo)))
        i.apodos = [...(i.apodos || []), viejo];
      cambios++;
    }
    if (a.unidad && i.unidad !== a.unidad) {
      i.unidad = a.unidad;
      cambios++;
    }
    if (a.presentacion !== undefined && (i.presentacion ?? null) !== a.presentacion) {
      if (a.presentacion) i.presentacion = a.presentacion;
      else delete i.presentacion;
      cambios++;
    }
    if (a.unidadPedido === null && (i.unidadPedido !== undefined || i.equivalenciaPedido !== undefined)) {
      delete i.unidadPedido;
      delete i.equivalenciaPedido;
      cambios++;
    }
    if (a.proveedorId && i.proveedorId !== a.proveedorId) {
      i.proveedorId = a.proveedorId;
      cambios++;
    }
    if (a.quitarApodos && i.apodos) {
      const malos = a.quitarApodos.map(normalizarNombre);
      const quedan = i.apodos.filter((x) => !malos.includes(normalizarNombre(x)));
      if (quedan.length !== i.apodos.length) {
        if (quedan.length) i.apodos = quedan;
        else delete i.apodos;
        cambios++;
      }
    }
  });
  const antes = next.insumos.length;
  next.insumos = next.insumos.filter((i) => !BORRAR.includes(i.id));
  cambios += antes - next.insumos.length;
  NUEVOS.forEach((n) => {
    if (!next.insumos.some((i) => i.id === n.id) && next.proveedores.some((p) => p.id === n.proveedorId)) {
      next.insumos.push({ ...n });
      cambios++;
    }
  });
  return cambios;
}
