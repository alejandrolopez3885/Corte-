import { DAYS, GASTO_CATEGORIAS, HORARIO_AREAS_FIJAS, type AppData, type AreaEntry, type DayData, type DayName, type EmpleadoEntry, type GastoCategoria, type HorarioFila, type HorarioMonthData, type HorarioSemana, type InsumoArea, type MeseroCatalogEntry, type MeseroCut, type MonthData, type NominaDescuento, type NominaDescuentosSemana, type NominaDia, type NominaEmpleadoSemana, type PuestoEntry, type VentaProyeccion, type WeekData, type WeekTrendPoint } from "./types";

export const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const money = (n: number | null | undefined): string => {
  const v = Number(n) || 0;
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
};

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function sumFromText(text: string | number | null | undefined): number {
  if (!text && text !== 0) return 0;
  const parts = String(text)
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return 0;
  return round2(parts.reduce((a, b) => a + b, 0));
}

export function propinaLabel(m: MeseroCut): string {
  if (m.propinaTipo === "p3") return `Propina 3% · ${money(m.propina)}`;
  if (m.propinaTipo === "p2") return `Propina 2% · ${money(m.propina)}`;
  if (m.propinaTipo === "manual") return `Propina manual · ${money(m.propina)}`;
  if (m.propinaTipo === "none") return "Sin propina";
  // Cortes guardados antes de este cambio, sin propinaTipo.
  return m.aplicaPropina ? `Propina · ${money(m.propina)}` : "Sin propina";
}

export function emptyDay(): DayData {
  return { meseros: [], gastos: [], transferencias: [], ventaApps: 0 };
}

// --- Fechas reales por semana/día -------------------------------------
// Cada semana ancla su Lunes a una fecha real (editable). Por default, la
// semana 1 empieza en el lunes que cae en o antes del día 1 del mes, y las
// siguientes 3 semanas avanzan de 7 en 7 días — así cada semana es siempre
// un Lunes-a-Domingo real, aunque la primera se asome al mes anterior.

export function addDaysIso(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function mondayOnOrBefore(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const jsDay = date.getDay(); // 0=Domingo..6=Sábado
  const offset = (jsDay + 6) % 7; // días desde el Lunes anterior (0 si ya es Lunes)
  return addDaysIso(dateStr, -offset);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultWeekStartDate(monthKey: string, weekIndex: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const week1Start = mondayOnOrBefore(firstOfMonth);
  return addDaysIso(week1Start, weekIndex * 7);
}

export function resolveWeekStartDate(monthKey: string, weekIndex: number, month: MonthData): string {
  const week1Start = month.week1StartDate || defaultWeekStartDate(monthKey, 0);
  return addDaysIso(week1Start, weekIndex * 7);
}

export function dateForDay(monthKey: string, weekIndex: number, month: MonthData, dayName: DayName): string {
  return addDaysIso(resolveWeekStartDate(monthKey, weekIndex, month), DAYS.indexOf(dayName));
}

// Semana más reciente de un mes: la que contiene hoy, o si hoy queda fuera
// de las 4 semanas, la más cercana (Semana 1 si el mes es futuro, Semana 4
// si ya quedó en el pasado). Se usa para que cualquier selector de semana
// en la app arranque siempre en la semana más relevante, sin que el dueño
// tenga que buscarla.
export function mostRecentWeekIndex(monthKey: string, month: MonthData): number {
  const today = todayIso();
  const week0Start = resolveWeekStartDate(monthKey, 0, month);
  if (today < week0Start) return 0;
  for (let i = 0; i < 4; i++) {
    const start = resolveWeekStartDate(monthKey, i, month);
    const end = addDaysIso(start, 6);
    if (today >= start && today <= end) return i;
  }
  return 3;
}

// Día más reciente dentro de una semana ya elegida: hoy mismo si esa
// semana lo incluye; si la semana es futura, Lunes (el primer día); si ya
// pasó, Domingo (el más cercano a hoy).
export function mostRecentDayInWeek(monthKey: string, weekIndex: number, month: MonthData): DayName {
  const today = todayIso();
  const weekStart = resolveWeekStartDate(monthKey, weekIndex, month);
  const weekEnd = addDaysIso(weekStart, 6);
  if (today < weekStart) return "Lunes";
  if (today > weekEnd) return "Domingo";
  for (const d of DAYS) {
    if (dateForDay(monthKey, weekIndex, month, d) === today) return d;
  }
  return "Lunes";
}

// "7" — solo el número de día, para chips angostos.
export function formatDayNumber(dateStr: string): string {
  return String(new Date(`${dateStr}T00:00:00`).getDate());
}

// "7 sep" — para chips y tablas compactas.
export function formatShortDayDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "");
}

// "Lunes 7 de septiembre de 2026" — para encabezados.
export function formatLongDayDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const label = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// "1 – 7 sep" — para mostrar junto a la pestaña de cada semana.
export function formatWeekRange(startDate: string): string {
  const end = addDaysIso(startDate, 6);
  const startD = new Date(`${startDate}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  const sameMonth = startD.getMonth() === endD.getMonth();
  const startLabel = startD.toLocaleDateString("es-MX", { day: "numeric", month: sameMonth ? undefined : "short" });
  const endLabel = endD.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `${startLabel} – ${endLabel}`;
}

// Semana del año (ISO 8601) que corresponde a una fecha — solo para
// mostrarla en reportes exportados (ej. la imagen de Nómina), nunca en la
// app misma: ahí siempre se navega por "Semana 1" a "4" dentro del mes.
export function isoWeekNumber(dateIso: string): number {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// A qué área de insumos (Bar/Cocina, para Catálogo/Conteo diario/Inventario)
// corresponde un puesto de Personal — no es lo mismo que su área de Personal
// (Gerencia/Piso/Cocina): "Barra" vive bajo el área "Piso" en Personal, pero
// sus insumos son los de Bar. Se resuelve por el nombre del puesto, no del
// área, para que el permiso "Conteo diario" de una cuenta de equipo apunte
// al catálogo correcto.
export function insumoAreaForPuesto(puestoNombre: string): InsumoArea | null {
  const n = puestoNombre.toLowerCase();
  if (n.includes("barra") || n === "bar") return "bar";
  if (n.includes("cocin")) return "cocina";
  return null;
}

// De las cuentas de equipo con el permiso "Horarios", solo el dueño (que
// no pasa por aquí — tiene su propia pantalla sin restricciones) y el
// jefe de cocina pueden capturar/editar y descargar la imagen. Todos los
// demás puestos (mesero, barra, etc.) solo pueden ver el horario de su
// área, sin poder editarlo ni descargarlo.
export function puedeEditarHorarios(puestoNombre: string): boolean {
  const n = puestoNombre.toLowerCase();
  return n.includes("jefe") && n.includes("cocin");
}

// week1Start: fecha real (Lunes) donde debe empezar la semana 1, cuando ya
// se conoce (ej. hoy, si apenas estás empezando a usar el mes; o la fecha
// real de una asignación de staff). Si no se da, usa el default por
// día-del-mes (menos confiable si empiezas a capturar a media semana/mes).
export function buildMonth(monthKey: string, week1Start?: string): MonthData {
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const weeks: WeekData[] = Array.from({ length: 4 }, () => ({
    days: Object.fromEntries(DAYS.map((d) => [d, emptyDay()])) as Record<DayName, DayData>,
  }));
  return {
    label: label.charAt(0).toUpperCase() + label.slice(1),
    weeks,
    week1StartDate: week1Start || defaultWeekStartDate(monthKey, 0),
  };
}

// Áreas y puestos con los que arranca cualquier negocio nuevo — Gerencia
// (Gerente, Subgerente), Piso (Barra, Mesero, Calidad) y Cocina (Jefe de
// cocina, Cocinero). Editable después desde Personal, esto es solo el
// punto de partida para no empezar de cero.
function seedAreasYPuestos(): { areas: AreaEntry[]; puestos: PuestoEntry[] } {
  const gerencia: AreaEntry = { id: uid(), nombre: "Gerencia" };
  const piso: AreaEntry = { id: uid(), nombre: "Piso" };
  const cocina: AreaEntry = { id: uid(), nombre: "Cocina" };
  const puestos: PuestoEntry[] = [
    { id: uid(), nombre: "Gerente", areaId: gerencia.id },
    { id: uid(), nombre: "Subgerente", areaId: gerencia.id },
    { id: uid(), nombre: "Barra", areaId: piso.id },
    { id: uid(), nombre: "Mesero", areaId: piso.id },
    { id: uid(), nombre: "Calidad", areaId: piso.id },
    { id: uid(), nombre: "Jefe de cocina", areaId: cocina.id },
    { id: uid(), nombre: "Cocinero", areaId: cocina.id },
  ];
  return { areas: [gerencia, piso, cocina], puestos };
}

export function defaultData(): AppData {
  const { areas, puestos } = seedAreasYPuestos();
  return {
    meseros: [], empleados: [], areas, puestos, proveedores: [], facturas: [], months: {}, horarios: {}, nominaDescuentos: {},
    insumos: [], conteosDiarios: {}, inventarioSemanal: {}, pedidosSemanal: {},
  };
}

// Repara datos guardados antes de que existieran `proveedores`/`facturas`, y
// migra las facturas que en una versión anterior vivían dentro de cada día
// (day.facturas) hacia la lista plana de nivel superior. Nunca se pierden
// datos ya capturados. Devuelve `changed: true` solo si hubo algo que migrar
// o normalizar, para no reescribir el registro sin necesidad.
export function migrateAppData(raw: AppData): { data: AppData; changed: boolean } {
  let changed = false;
  const data: AppData = { ...raw };

  if (!data.empleados) {
    data.empleados = [];
    changed = true;
  }
  if (!data.areas || !data.puestos) {
    const seed = seedAreasYPuestos();
    data.areas = data.areas || seed.areas;
    data.puestos = data.puestos || seed.puestos;
    changed = true;
  }
  if (!data.proveedores) {
    data.proveedores = [];
    changed = true;
  }
  if (!data.facturas) {
    data.facturas = [];
    changed = true;
  }
  if (!data.horarios) {
    data.horarios = {};
    changed = true;
  }
  if (!data.nominaDescuentos) {
    data.nominaDescuentos = {};
    changed = true;
  }
  if (!data.insumos) {
    data.insumos = [];
    changed = true;
  }
  if (!data.conteosDiarios) {
    data.conteosDiarios = {};
    changed = true;
  }
  if (!data.inventarioSemanal) {
    data.inventarioSemanal = {};
    changed = true;
  }
  if (!data.pedidosSemanal) {
    data.pedidosSemanal = {};
    changed = true;
  }

  // Los insumos de bar solo se cuentan por pieza — si alguno quedó con
  // otra unidad (de antes de que este campo se volviera fijo), se
  // normaliza aquí.
  if (data.insumos.some((i) => i.area === "bar" && i.unidad !== "pieza")) {
    data.insumos = data.insumos.map((i) => (i.area === "bar" && i.unidad !== "pieza" ? { ...i, unidad: "pieza" } : i));
    changed = true;
  }

  const proveedores = [...data.proveedores];
  const facturas = [...data.facturas];

  function proveedorIdFor(nombre: string): string {
    const existing = proveedores.find((p) => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    if (existing) return existing.id;
    const entry = { id: uid(), nombre: nombre.trim() };
    proveedores.push(entry);
    return entry.id;
  }

  Object.entries(data.months).forEach(([monthKey, month]) => {
    // Migra la fecha ancla por semana (diseño anterior, de muy corta vida)
    // a la fecha ancla única por mes.
    if (!month.week1StartDate) {
      const weekWithLegacyDate = month.weeks
        .map((w, i) => ({ w: w as WeekData & { startDate?: string }, i }))
        .find(({ w }) => w.startDate);
      if (weekWithLegacyDate) {
        month.week1StartDate = addDaysIso(weekWithLegacyDate.w.startDate as string, -weekWithLegacyDate.i * 7);
        changed = true;
      }
    }
    month.weeks.forEach((week) => {
      const legacyStartDate = (week as WeekData & { startDate?: string }).startDate;
      if (legacyStartDate !== undefined) {
        delete (week as WeekData & { startDate?: string }).startDate;
        changed = true;
      }
    });

    month.weeks.forEach((week, weekIndex) => {
      DAYS.forEach((dayName) => {
        const day = week.days[dayName] as DayData & { facturas?: unknown[] };
        const legacy = day.facturas as
          | { id: string; proveedor: string; total: number; estado: "pendiente" | "ingresado" }[]
          | undefined;
        if (!legacy || legacy.length === 0) return;
        legacy.forEach((f) => {
          facturas.push({
            id: f.id,
            proveedorId: proveedorIdFor(f.proveedor),
            numero: "",
            total: f.total,
            fecha: approximateDateForLocation(monthKey, weekIndex, dayName),
            estado: f.estado,
            categoria: "operacion",
          });
        });
        delete day.facturas;
        changed = true;
      });
    });
  });

  data.proveedores = proveedores;
  data.facturas = facturas;

  // Insumos que el dueño ya llevaba en papel, agrupados por proveedor —
  // se siembran una sola vez si no existen ya en el catálogo de esa área
  // (por nombre, sin importar mayúsculas), para no duplicarlos en cuentas
  // donde ya se hayan dado de alta a mano.
  if (sembrarInsumosPorProveedor(data, "cocina", "kg", "Verdura", [
    "Zanahoria", "Jalapeño", "Tomate bola", "Cebolla blanca", "Cebolla morada",
    "Papa blanca", "Tomatillo", "Cilantro", "Coliflor", "Piña", "Limón", "Naranja",
    "Jamaica", "Lechuga orejona", "Lechuga romana",
  ])) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "bar", "pieza", "Limonadas", [
    "Limón", "Mango", "Fresa", "Maracuyá", "Frutos rojos", "Pepino",
    "Concentrado de piña", "Concentrado de tamarindo", "Concentrado de sandía", "Concentrado de mora",
  ])) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "general", "pieza", "Postres", [
    "Cheescake tortuga",
  ])) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "general", "pieza", "Compras Johnster", [
    "Rollos térmicos", "Fibras de esponja", "Cloro", "Encendedor de cocina",
    "Cloro genérico", "Fabuloso genérico", "Desengrasante", "Windex",
    "Fibras de alambre", "Escoba", "Recogedor", "Trapeador", "Rastrillo",
    "Cubetas", "Trapos", "Cofias negras", "Malla para mingitorio",
    "Papel sanitario", "Papel secante", "Sobre de nómina",
    "Paquete de servilletas", "Chiles jalapeños", "Chocolate líquido",
  ])) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "general", "kg", "Compras Johnster", [
    "Jabón arcoiris",
  ])) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "bar", "pieza", "Compras Johnster", [
    "Clamato", "Calahua", "Squirt", "Agua mineral", "Granadina", "Jarabe natural",
    "Jugo de piña", "Jugo de mango", "Bacardí", "Captain Morgan", "Black & White",
    "Gran Malo", "Red Label", "Buchanan's", "Jose Cuervo", "Maestro Tequilero",
    "Smirnoff Tamarindo", "Viuda de Sánchez", "Tarugo",
    "Pepsi", "Sprite", "Gin", "Mezcal", "Curazao", "Licor de fresa", "Azúcar",
  ])) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "bar", "pieza", "Compras Johnster", [
    "Coca de sabor para llevar", "Agua natural", "Pepsi",
  ], true)) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "bar", "pieza", "Cerveza", [
    "Tecate Light", "Indio", "XX", "Tecate rojo", "XX ámbar", "XX ultra", "Amstel", "Carta blanca",
  ], true)) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "bar", "pieza", "Coca Cola", [
    "Coca regular", "Coca zero", "Coca light",
  ], true)) {
    changed = true;
  }
  if (sembrarInsumosPorProveedor(data, "cocina", "pieza", "Compras Johnster", [
    "Pan artesanal", "Aderezo Caesar", "Mayonesa", "Mostaza", "Frijoles refritos",
    "Chipotle", "Salsa marinara", "Crotones", "Puré de papa", "Sal",
    "Sazonador italiano", "Perejil", "Consomé de pollo", "Harina", "Leche",
    "Pasta penne", "Frijol ranch", "Consomate", "Huevo", "Tortilla amarilla",
    "Tortilla blanca", "Tortilla para burrito", "Pepinillos", "Aluminio",
  ])) {
    changed = true;
  }
  return { data, changed };
}

// Agrega los insumos de `nombres` a `data.insumos` bajo el proveedor
// `proveedorNombre` (lo crea si no existe), pero solo los que no existan
// ya en esa área (comparando por nombre, sin importar mayúsculas).
// Devuelve true si agregó algo.
function sembrarInsumosPorProveedor(
  data: AppData,
  area: InsumoArea,
  unidad: string,
  proveedorNombre: string,
  nombres: string[],
  altaRotacion = false
): boolean {
  const yaExiste = (nombre: string) =>
    data.insumos.some((i) => i.area === area && i.nombre.trim().toLowerCase() === nombre.toLowerCase());
  const faltantes = nombres.filter((n) => !yaExiste(n));
  if (faltantes.length === 0) return false;
  let proveedor = data.proveedores.find((p) => p.nombre.trim().toLowerCase() === proveedorNombre.toLowerCase());
  if (!proveedor) {
    proveedor = { id: uid(), nombre: proveedorNombre };
    data.proveedores = [...data.proveedores, proveedor];
  }
  data.insumos = [
    ...data.insumos,
    ...faltantes.map((nombre) => ({ id: uid(), area, nombre, unidad, proveedorId: proveedor.id, altaRotacion })),
  ];
  return true;
}

// Solo para migrar facturas que antes vivían en un día del corte: aproxima
// una fecha real a partir de mes/semana/día usando la misma convención de
// locateDate (semana 1 = días 1-7, semana 2 = 8-14, ...).
function approximateDateForLocation(monthKey: string, weekIndex: number, dayName: DayName): string {
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dayOfMonth = Math.min(weekIndex * 7 + 1 + DAYS.indexOf(dayName), daysInMonth);
  return `${y}-${String(m).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

export interface DateLocation {
  monthKey: string;
  weekIndex: number;
  dayName: DayName;
}

// Convención: semana 1 = días 1-7 del mes, semana 2 = 8-14, semana 3 = 15-21, semana 4 = 22-fin.
export function locateDate(dateStr: string): DateLocation {
  const date = new Date(`${dateStr}T00:00:00`);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const monthKey = `${y}-${String(m).padStart(2, "0")}`;
  const dayOfMonth = date.getDate();
  const weekIndex = Math.min(3, Math.floor((dayOfMonth - 1) / 7));
  // getDay(): 0 = Domingo ... 6 = Sábado. DAYS empieza en Lunes.
  const jsDay = date.getDay();
  const dayName = DAYS[(jsDay + 6) % 7];
  return { monthKey, weekIndex, dayName };
}

// El mes y el día de la semana de una fecha siempre son inequívocos, pero la
// semana ("Semana 1/2/3/4") es una pestaña manual del corte — no siempre
// coincide con el cálculo automático por fecha. Si la asignación ya trae su
// propia semana guardada (elegida por el dueño), se usa esa; si no (datos
// viejos), se usa el cálculo automático como respaldo.
export function resolveAssignmentLocation(dateStr: string, weekIndexOverride: number | null | undefined): DateLocation {
  const loc = locateDate(dateStr);
  if (weekIndexOverride !== null && weekIndexOverride !== undefined) {
    return { ...loc, weekIndex: weekIndexOverride };
  }
  return loc;
}

export function formatAssignedDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const label = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function computeWeekGastos(week: WeekData) {
  let totalMonto = 0, totalIngresado = 0, totalPendiente = 0, countIngresado = 0, countPendiente = 0;
  const perDay = DAYS.map((d) => {
    const items = week.days[d].gastos;
    const dayTotal = items.reduce((s, g) => s + g.total, 0);
    items.forEach((g) => {
      totalMonto += g.total;
      if (g.estado === "ingresado") { totalIngresado += g.total; countIngresado += 1; }
      else { totalPendiente += g.total; countPendiente += 1; }
    });
    return { day: d, items, dayTotal: round2(dayTotal) };
  });
  return {
    perDay,
    totalMonto: round2(totalMonto),
    totalIngresado: round2(totalIngresado),
    totalPendiente: round2(totalPendiente),
    countIngresado,
    countPendiente,
    countTotal: countIngresado + countPendiente,
  };
}

export function computeWeekSummary(week: WeekData) {
  let ventaMeseros = 0, ventaApps = 0, tarjetas = 0, propina = 0, gastos = 0, transferencias = 0, efectivoSum = 0;
  const perDay = DAYS.map((d) => {
    const day = week.days[d];
    const dVentaMeseros = day.meseros.reduce((s, m) => s + m.venta, 0);
    const dTarjetas = day.meseros.reduce((s, m) => s + m.tarjetas, 0);
    const dPropina = day.meseros.reduce((s, m) => s + m.propina, 0);
    const dApps = day.ventaApps || 0;
    const dGastos = day.gastos.reduce((s, g) => s + g.total, 0);
    const dTransfer = day.transferencias.reduce((s, t) => s + t.total, 0);
    // Efectivo del día: venta de meseros menos tarjetas, gastos y transferencias. No incluye propinas ni ventas de apps.
    const dEfectivo = round2(dVentaMeseros - dTarjetas - dGastos - dTransfer);

    ventaMeseros += dVentaMeseros; ventaApps += dApps; tarjetas += dTarjetas; propina += dPropina;
    gastos += dGastos; transferencias += dTransfer; efectivoSum += dEfectivo;

    return {
      day: d,
      ventaLocal: round2(dVentaMeseros),
      ventaApps: round2(dApps),
      ventaTotal: round2(dVentaMeseros + dApps),
      tarjetas: round2(dTarjetas),
      transferencias: round2(dTransfer),
      gastos: round2(dGastos),
      propina: round2(dPropina),
      efectivo: dEfectivo,
    };
  });
  return {
    perDay,
    ventaLocal: round2(ventaMeseros),
    ventaApps: round2(ventaApps),
    ventaTotal: round2(ventaMeseros + ventaApps),
    tarjetas: round2(tarjetas),
    transferencias: round2(transferencias),
    gastos: round2(gastos),
    propina: round2(propina),
    efectivoRecibido: round2(efectivoSum),
    efectivoReal: week.efectivoReal ?? null,
  };
}

// Reporte de resultados de la semana: solo lectura (salvo Nómina, que por
// ahora se captura a mano porque no existe todavía un generador de nómina).
// "Gastos operativos" junta los gastos en efectivo categorizados como
// Operación con los gastos operativos en transferencia de Proveedores —
// son el mismo concepto, solo con distinta forma de pago. Gastos fijos y
// las 3 comisiones de apps vienen tal cual de Proveedores. El resto de
// categorías en efectivo (cortesía, retiro, mantenimiento, comida
// empleado, envíos, cancelaciones, otro, o sin categoría) se desglosan
// cada una en su propia línea, para que la Utilidad reste todo lo
// gastado con total transparencia de en qué se fue cada peso.
//
// La nómina en efectivo (gastos del día categorizados "Nómina", p.ej.
// adelantos) ya queda incluida dentro del total de nómina que el dueño
// captura a mano — no son dos gastos distintos, es el mismo gasto visto
// parcialmente. Por eso esa categoría se sigue mostrando en el desglose
// (para ver cuánto de la nómina ya se pagó en efectivo), pero no se resta
// una segunda vez en la Utilidad: ahí solo cuenta el total capturado a
// mano, tal como se capturó.
// Comisión bancaria estándar que cobra la terminal por cada venta con
// tarjeta — se calcula sobre el total de tarjetas de la semana. No es
// editable en ningún lado; siempre se deriva de las tarjetas ya
// capturadas en el corte.
const COMISION_TARJETAS_TASA = 0.03;

export function computeComisionTarjetas(week: WeekData): number {
  return round2(computeWeekSummary(week).tarjetas * COMISION_TARJETAS_TASA);
}

// Las áreas del horario son fijas (PISO y COCINA, no se crean ni se
// borran) — esto arma siempre esas dos, tomando el personal ya
// capturado si la semana (guardada o precargada de una anterior) ya
// tenía algo con ese mismo id de área.
export function normalizeHorarioSemana(semana: HorarioSemana | null): HorarioSemana {
  return {
    areas: HORARIO_AREAS_FIJAS.map((fixed) => {
      const existing = semana?.areas.find((a) => a.id === fixed.id);
      return { id: fixed.id, nombre: fixed.nombre, filas: existing?.filas ?? [] };
    }),
    festivos: semana?.festivos ?? [],
  };
}

// Busca la semana de horario más reciente ya guardada antes de
// (monthKey, weekIndex), recorriendo hacia atrás semana por semana (y mes
// por mes si hace falta). Se usa para precargar áreas y personal en una
// semana que todavía no tiene nada capturado, para que el dueño solo
// ajuste lo que cambió en vez de armar todo desde cero cada semana. No
// persiste nada por sí sola — el resultado solo se guarda de verdad en
// cuanto el dueño hace el primer cambio sobre la semana actual.
export function findPreviousHorarioSemana(
  horarios: Record<string, HorarioMonthData>,
  monthKeys: string[],
  monthKey: string,
  weekIndex: number
): HorarioSemana | null {
  const sorted = [...monthKeys].sort();
  const idx = sorted.indexOf(monthKey);
  if (idx === -1) return null;
  for (let mi = idx; mi >= 0; mi--) {
    const mk = sorted[mi];
    const weeks = horarios[mk]?.weeks;
    if (!weeks) continue;
    const startWeek = mk === monthKey ? weekIndex - 1 : 3;
    for (let wi = startWeek; wi >= 0; wi--) {
      const semana = weeks[wi];
      if (semana && semana.areas.length > 0) return structuredClone(semana);
    }
  }
  return null;
}

// --- Nómina calculada a partir de Horarios ------------------------------
// El sueldo diario captura la base; el sueldo semanal completo (6 días
// trabajados + 1 de descanso pagado) siempre es sueldoDiario × 7. Cada
// día del horario paga distinto: Z paga doble, O/X o cualquier hora
// capturada pagan 1x, y OFF solo paga 1x si esa semana ya se trabajaron
// los otros 6 días — si se trabajaron 5 o menos, el descanso no se paga.
// Una celda sin capturar no se paga y tampoco cuenta como día trabajado.
// Si el día está marcado como festivo (ver HorarioSemana.festivos) y sí se
// trabajó, se suma 1 turno extra al multiplicador que le tocaba (normal o
// Z) — el descanso pagado en un día festivo no cuenta como "trabajado",
// así que no recibe el extra.
export function computeNominaFila(
  fila: HorarioFila,
  sueldoDiario: number,
  festivos: DayName[] = []
): { dias: NominaDia[]; diasTrabajados: number; offPagado: boolean; total: number } {
  const diasTrabajados = DAYS.filter((d) => {
    const v = fila.valores[d];
    return !!v && v !== "OFF";
  }).length;
  const offPagado = diasTrabajados >= 6;
  let total = 0;
  const dias: NominaDia[] = DAYS.map((d) => {
    const valor = fila.valores[d] || "";
    let multiplicador = 0;
    if (valor === "Z") multiplicador = 2;
    else if (valor === "OFF") multiplicador = offPagado ? 1 : 0;
    else if (valor) multiplicador = 1;
    const esFestivo = festivos.includes(d) && !!valor && valor !== "OFF";
    if (esFestivo) multiplicador += 1;
    const monto = round2(sueldoDiario * multiplicador);
    total += monto;
    return { day: d, valor, multiplicador, monto, esFestivo };
  });
  return { dias, diasTrabajados, offPagado, total: round2(total) };
}

// El Dashboard usa el bruto generado hasta hoy (sin descuentos) para
// calcular la Utilidad en tiempo real — por eso descuentosSemana/week son
// opcionales aquí: ni eso ni computeNominaTotalHastaHoy los necesitan,
// solo la propia página de Nómina, donde sí importa mostrar cuánto se le
// descontó a cada quien y cuánto le toca neto.
//
// Además de los descuentos capturados a mano, cualquier gasto del corte
// diario de esa semana categorizado "Nómina" (adelanto) o "Comida
// empleado" y vinculado a este empleado se suma también como descuento
// "del corte" — así un adelanto que se le dio a Aldair del dinero de otro
// corte se refleja solo en su nómina, sin capturarlo dos veces. Estos se
// derivan en vivo del gasto (nunca se guardan aparte), así que si el
// gasto se edita o se borra en Corte, el descuento cambia con él.
export function computeNominaSemana(
  semana: HorarioSemana | null,
  empleados: EmpleadoEntry[],
  descuentosSemana?: NominaDescuentosSemana | null,
  week?: WeekData | null
): NominaEmpleadoSemana[] {
  if (!semana) return [];
  const result: NominaEmpleadoSemana[] = [];
  semana.areas.forEach((area) => {
    area.filas.forEach((fila) => {
      const sueldoDiario = empleados.find((e) => e.id === fila.empleadoId)?.sueldoDiario || 0;
      const { dias, diasTrabajados, offPagado, total: bruto } = computeNominaFila(fila, sueldoDiario, semana.festivos || []);

      const delCorte: NominaDescuento[] = [];
      if (week) {
        DAYS.forEach((dayName) => {
          week.days[dayName].gastos.forEach((g) => {
            if (g.empleadoId !== fila.empleadoId) return;
            if (g.categoria !== "nomina" && g.categoria !== "comida_empleado") return;
            delCorte.push({
              id: `gasto-${g.id}`,
              empleadoId: fila.empleadoId,
              tipo: g.categoria === "comida_empleado" ? "comida" : "adelanto",
              concepto: `${g.concepto} · ${dayName}`,
              monto: g.total,
              origen: "corte",
            });
          });
        });
      }
      const manuales = (descuentosSemana?.descuentos || []).filter((d) => d.empleadoId === fila.empleadoId);
      const descuentos = [...delCorte, ...manuales];
      const totalDescuentos = round2(descuentos.reduce((s, d) => s + d.monto, 0));
      const extras = (descuentosSemana?.extras || []).filter((x) => x.empleadoId === fila.empleadoId);
      const totalExtras = round2(extras.reduce((s, x) => s + x.monto, 0));
      const neto = round2(bruto + totalExtras - totalDescuentos);
      const confirmacion = (descuentosSemana?.confirmaciones || []).find((c) => c.empleadoId === fila.empleadoId);
      result.push({
        empleadoId: fila.empleadoId, nombre: fila.nombre, areaNombre: area.nombre, sueldoDiario,
        dias, diasTrabajados, offPagado, bruto, extras, totalExtras, descuentos, totalDescuentos, neto,
        confirmado: !!confirmacion, confirmadoEn: confirmacion?.confirmadoEn,
      });
    });
  });
  return result;
}

// Nómina bruta generada hasta hoy, por empleado: de los 7 días de la
// semana, solo cuenta lo ganado en los que su fecha real (dateForDay) ya
// pasó o es hoy — en una semana ya cerrada equivale al bruto completo; en
// una futura, a $0. Se usa tanto en la propia página de Nómina (por
// persona) como en el Dashboard (el total), para que ambas vean el mismo
// número en tiempo real sin duplicar la lógica.
export function computeNominaHastaHoyPorEmpleado(
  monthKey: string,
  weekIndex: number,
  month: MonthData,
  semana: HorarioSemana | null,
  empleados: EmpleadoEntry[]
): Record<string, number> {
  const today = todayIso();
  const result: Record<string, number> = {};
  computeNominaSemana(semana, empleados).forEach((e) => {
    result[e.empleadoId] = round2(
      e.dias.filter((d) => dateForDay(monthKey, weekIndex, month, d.day) <= today).reduce((s, d) => s + d.monto, 0)
    );
  });
  return result;
}

// Total bruto generado hasta hoy, sin descuentos — es lo que usa el
// Dashboard para la Utilidad, por decisión explícita: así el reporte
// refleja el estado real en tiempo real, sin adelantar el costo de días
// que todavía no llegan.
export function computeNominaTotalHastaHoy(
  monthKey: string,
  weekIndex: number,
  month: MonthData,
  semana: HorarioSemana | null,
  empleados: EmpleadoEntry[]
): number {
  const porEmpleado = computeNominaHastaHoyPorEmpleado(monthKey, weekIndex, month, semana, empleados);
  return round2(Object.values(porEmpleado).reduce((s, n) => s + n, 0));
}

export function computeDashboardReport(week: WeekData, nominaCalculada: number, meseros: MeseroCatalogEntry[]) {
  const { ventaTotal } = computeWeekSummary(week);
  const comisionTarjetas = computeComisionTarjetas(week);

  let operacionEfectivo = 0;
  const otrosPorCategoria: Partial<Record<GastoCategoria | "sin_categoria", number>> = {};
  const otrosItemsPorCategoria: Partial<Record<GastoCategoria | "sin_categoria", { concepto: string; total: number }[]>> = {};
  // Cancelaciones se desglosa distinto al resto: por mesero (nombre y
  // total de la semana), no gasto por gasto — así se ve de un vistazo a
  // quién se le canceló cuánto, sin importar cuántos gastos lo componen.
  const cancelacionesPorMesero: Record<string, number> = {};
  DAYS.forEach((d) => {
    week.days[d].gastos.forEach((g) => {
      if (g.categoria === "operacion") {
        operacionEfectivo += g.total;
      } else {
        const key = g.categoria || "sin_categoria";
        otrosPorCategoria[key] = round2((otrosPorCategoria[key] || 0) + g.total);
        if (g.categoria === "cancelaciones") {
          const meseroKey = g.meseroId || "sin_asignar";
          cancelacionesPorMesero[meseroKey] = round2((cancelacionesPorMesero[meseroKey] || 0) + g.total);
        } else {
          (otrosItemsPorCategoria[key] ||= []).push({ concepto: g.concepto, total: g.total });
        }
      }
    });
  });
  otrosItemsPorCategoria.cancelaciones = Object.entries(cancelacionesPorMesero).map(([meseroId, total]) => ({
    concepto: meseroId === "sin_asignar" ? "Sin asignar" : meseros.find((m) => m.id === meseroId)?.nombre || "Mesero eliminado",
    total,
  }));

  const credito = week.creditoProveedores;
  const gastosOperativosEfectivo = round2(operacionEfectivo);
  const gastosOperativosTransferencia = round2(credito?.operativos || 0);
  const gastosOperativos = round2(gastosOperativosEfectivo + gastosOperativosTransferencia);
  const gastosFijos = round2(credito?.fijos || 0);
  const comisionDidi = round2(credito?.comisionDidi || 0);
  const comisionUber = round2(credito?.comisionUber || 0);
  const comisionRappi = round2(credito?.comisionRappi || 0);
  const comisionesApps = round2(comisionDidi + comisionUber + comisionRappi);
  const nomina = round2(nominaCalculada);

  const pct = (n: number) => (ventaTotal > 0 ? round2((n / ventaTotal) * 100) : 0);

  const otrosCategorias = [
    ...GASTO_CATEGORIAS.filter((c) => c.value !== "operacion").map((c) => ({
      key: c.value as string,
      label: c.value === "nomina" ? "Nómina (gastos en efectivo)" : c.label,
      total: otrosPorCategoria[c.value] || 0,
      items: otrosItemsPorCategoria[c.value] || [],
    })),
    {
      key: "sin_categoria",
      label: "Sin categoría",
      total: otrosPorCategoria.sin_categoria || 0,
      items: otrosItemsPorCategoria.sin_categoria || [],
    },
  ].map((c) => ({ ...c, pct: pct(c.total) }));

  // Para la Utilidad no se suma la nómina en efectivo aparte — ya está
  // dentro del total que el dueño capturó a mano.
  const otrosTotalSinNomina = round2(
    otrosCategorias.filter((c) => c.key !== "nomina").reduce((s, c) => s + c.total, 0)
  );

  const totalGastos = round2(
    gastosOperativos + gastosFijos + comisionesApps + comisionTarjetas + otrosTotalSinNomina + nomina
  );
  const utilidad = round2(ventaTotal - totalGastos);

  return {
    ventaTotal,
    gastosOperativos,
    gastosOperativosEfectivo,
    gastosOperativosTransferencia,
    gastosFijos,
    comisionesApps,
    comisionDidi,
    comisionUber,
    comisionRappi,
    comisionTarjetas,
    otrosCategorias,
    nomina,
    utilidad,
    pct: {
      ventaTotal: 100,
      gastosOperativos: pct(gastosOperativos),
      gastosOperativosEfectivo: pct(gastosOperativosEfectivo),
      gastosOperativosTransferencia: pct(gastosOperativosTransferencia),
      gastosFijos: pct(gastosFijos),
      comisionesApps: pct(comisionesApps),
      comisionDidi: pct(comisionDidi),
      comisionUber: pct(comisionUber),
      comisionRappi: pct(comisionRappi),
      comisionTarjetas: pct(comisionTarjetas),
      nomina: pct(nomina),
      utilidad: pct(utilidad),
    },
  };
}

export type DashboardReport = ReturnType<typeof computeDashboardReport>;

// Meta de gasto operativo del negocio: 42% o menos de la venta total se
// considera saludable — usado tanto en la pantalla del Dashboard como en
// su imagen descargable para pintar ese número en verde/rojo.
export const META_GASTOS_OPERATIVOS_PCT = 42;

// --- Tendencias y proyección de venta (Negocio > Tendencias) -----------
// Un resumen de salud del negocio por cada semana ya capturada (con
// actividad real — venta o meseros — para no diluir la tendencia con
// semanas vacías), en orden cronológico sin importar el mes, para poder
// comparar semana tras semana y detectar tendencias reales. Reutiliza
// exactamente el mismo cálculo que ya usan Dashboard y Nómina, así que
// nunca se desincroniza de esas cifras.
export function computeVentaTrend(
  months: Record<string, MonthData>,
  horarios: Record<string, HorarioMonthData>,
  empleados: EmpleadoEntry[],
  meseros: MeseroCatalogEntry[]
): WeekTrendPoint[] {
  const monthKeys = Object.keys(months).sort();
  const points: WeekTrendPoint[] = [];
  monthKeys.forEach((monthKey) => {
    const month = months[monthKey];
    for (let weekIndex = 0; weekIndex < 4; weekIndex++) {
      const week = month.weeks[weekIndex];
      const summary = computeWeekSummary(week);
      const huboActividad = summary.ventaTotal > 0 || DAYS.some((d) => week.days[d].meseros.length > 0);
      if (!huboActividad) continue;
      const semana = horarios[monthKey]?.weeks?.[weekIndex] ?? null;
      const nominaCalculada = computeNominaTotalHastaHoy(monthKey, weekIndex, month, semana, empleados);
      const report = computeDashboardReport(week, nominaCalculada, meseros);
      points.push({
        monthKey,
        weekIndex,
        label: formatWeekRange(resolveWeekStartDate(monthKey, weekIndex, month)),
        weekStartDate: resolveWeekStartDate(monthKey, weekIndex, month),
        ventaTotal: report.ventaTotal,
        gastoTotal: round2(report.ventaTotal - report.utilidad),
        nomina: report.nomina,
        utilidad: report.utilidad,
        margenPct: report.pct.utilidad,
      });
    }
  });
  return points;
}

// Proyección de la venta de la próxima semana: promedio ponderado de las
// últimas hasta 4 semanas (más peso a las más recientes) ajustado por la
// tendencia semanal promedio de esa misma ventana (cuánto sube o baja en
// promedio semana a semana). Con solo 1 semana de base no hay tendencia
// que calcular, así que la proyección es esa misma semana, marcada como
// poco confiable; con menos de 3 semanas también se marca poco confiable
// — no hay suficiente historial para una tendencia estable.
export function computeVentaProyeccion(puntos: WeekTrendPoint[]): VentaProyeccion | null {
  if (puntos.length === 0) return null;
  const ventana = puntos.slice(-4);
  const n = ventana.length;
  if (n === 1) {
    return { monto: ventana[0].ventaTotal, confiable: false, semanasBase: 1, tendenciaSemanal: 0 };
  }
  const pesos = ventana.map((_, i) => i + 1);
  const sumaPesos = pesos.reduce((s, p) => s + p, 0);
  const promedioPonderado = ventana.reduce((s, p, i) => s + p.ventaTotal * pesos[i], 0) / sumaPesos;
  const tendenciaSemanal = round2((ventana[n - 1].ventaTotal - ventana[0].ventaTotal) / (n - 1));
  const monto = Math.max(0, round2(promedioPonderado + tendenciaSemanal));
  return { monto, confiable: n >= 3, semanasBase: n, tendenciaSemanal };
}

