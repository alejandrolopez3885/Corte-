export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export type DayName = (typeof DAYS)[number];

export const DAY_SHORT: Record<DayName, string> = {
  Lunes: "Lun", Martes: "Mar", Miércoles: "Mié", Jueves: "Jue", Viernes: "Vie", Sábado: "Sáb", Domingo: "Dom",
};

export type PropinaTipo = "p3" | "p2" | "manual" | "none";

export interface MeseroCatalogEntry {
  id: string;
  nombre: string;
}

// Lista de personal, separada del catálogo de meseros (ese es para el
// corte). sueldoDiario es la base para calcular la nómina a partir de
// Horarios — el sueldo semanal completo (6 días trabajados + 1 de
// descanso pagado) siempre es sueldoDiario × 7.
export interface EmpleadoEntry {
  id: string;
  nombre: string;
  sueldoDiario?: number;
}

// Valores rápidos para una celda de horario — el resto de las celdas
// admite cualquier texto libre (p.ej. una hora de entrada).
export const HORARIO_CHIPS = ["OFF", "O", "X", "Z"] as const;

// Áreas fijas del horario — no se pueden crear, renombrar ni borrar.
export const HORARIO_AREAS_FIJAS = [
  { id: "piso", nombre: "PISO" },
  { id: "cocina", nombre: "COCINA" },
] as const;

// Una fila de horario por empleado dentro de un área. `nombre` es una
// foto del nombre al momento de agregarlo a la semana, para que el
// historial no se rompa si después se borra ese empleado de Personal.
export interface HorarioFila {
  empleadoId: string;
  nombre: string;
  valores: Partial<Record<DayName, string>>;
}

// Un área/puesto (Piso, Cocina, ...) con su propia lista de empleados,
// igual que en el Excel que se llevaba antes.
export interface HorarioArea {
  id: string;
  nombre: string;
  filas: HorarioFila[];
}

export interface HorarioSemana {
  areas: HorarioArea[];
}

export interface HorarioMonthData {
  weeks: (HorarioSemana | null)[];
}

// Nómina calculada de un empleado en una semana, a partir de su horario
// y su sueldo diario — ver computeNominaFila/computeNominaSemana.
export interface NominaDia {
  day: DayName;
  valor: string;
  multiplicador: number;
  monto: number;
}

export interface NominaEmpleadoSemana {
  empleadoId: string;
  nombre: string;
  areaNombre: string;
  sueldoDiario: number;
  dias: NominaDia[];
  diasTrabajados: number;
  offPagado: boolean;
  bruto: number;
  descuentos: NominaDescuento[];
  totalDescuentos: number;
  neto: number;
}

// Descuentos de nómina capturados a mano por empleado — tardanzas,
// adelantos de efectivo durante la semana, comida, etc. Itemizados (no un
// solo total por tipo) para poder consultarlos uno por uno después, y
// guardados por semana igual que Horarios, para tener historial real.
export type NominaDescuentoTipo = "tardanza" | "adelanto" | "comida" | "otro";

export const NOMINA_DESCUENTO_TIPOS: { value: NominaDescuentoTipo; label: string }[] = [
  { value: "tardanza", label: "Tardanza" },
  { value: "adelanto", label: "Adelanto de efectivo" },
  { value: "comida", label: "Comida" },
  { value: "otro", label: "Otro" },
];

export interface NominaDescuento {
  id: string;
  empleadoId: string;
  tipo: NominaDescuentoTipo;
  concepto?: string;
  monto: number;
  // "corte" = derivado en vivo de un gasto del corte diario vinculado a
  // este empleado (adelanto o comida) — no se guarda ni se borra aquí,
  // se edita o elimina desde el gasto en Corte. Sin este campo (u
  // "manual") es un descuento capturado a mano en la propia Nómina.
  origen?: "manual" | "corte";
}

export interface NominaDescuentosSemana {
  descuentos: NominaDescuento[];
}

export interface NominaDescuentosMonthData {
  weeks: (NominaDescuentosSemana | null)[];
}

export interface MeseroCut {
  id: string;
  meseroId: string;
  nombre: string;
  venta: number;
  tarjetas: number;
  transferencia: number;
  propinaTipo?: PropinaTipo;
  propina: number;
  gastosTotal: number;
  total: number;
  aplicaPropina?: boolean; // legacy field from cuts saved before propinaTipo existed
}

export type GastoEstado = "pendiente" | "ingresado";
export type GastoOrigen = "mesero" | "manual";

export type GastoCategoria =
  | "operacion"
  | "nomina"
  | "cortesia"
  | "retiro"
  | "mantenimiento"
  | "comida_empleado"
  | "envios"
  | "cancelaciones"
  | "otro";

export const GASTO_CATEGORIAS: { value: GastoCategoria; label: string }[] = [
  { value: "operacion", label: "Operación" },
  { value: "nomina", label: "Nómina" },
  { value: "cortesia", label: "Cortesía" },
  { value: "retiro", label: "Retiro" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "comida_empleado", label: "Comida empleado" },
  { value: "envios", label: "Envíos" },
  { value: "cancelaciones", label: "Cancelaciones" },
  { value: "otro", label: "Otro" },
];

export interface Gasto {
  id: string;
  concepto: string;
  total: number;
  estado: GastoEstado;
  origen: GastoOrigen;
  meseroNombre?: string;
  meseroCutId?: string;
  categoria?: GastoCategoria;
  // A qué empleado de Personal se le descuenta este gasto de su nómina —
  // solo aplica a categoría "nomina" (adelanto) o "comida_empleado". Se
  // limpia solo si la categoría cambia a otra cosa.
  empleadoId?: string;
  // A qué mesero del catálogo se le asigna esta cancelación — solo aplica
  // a categoría "cancelaciones". Distinto de meseroCutId (que liga un
  // gasto al corte específico de un día, no al mesero como tal). Se
  // limpia solo si la categoría cambia a otra cosa.
  meseroId?: string;
}

export interface Transferencia {
  id: string;
  persona: string;
  total: number;
  origen?: "mesero";
  meseroCutId?: string;
}

export interface ProveedorCatalogEntry {
  id: string;
  nombre: string;
  // Si también se le hace un pedido parcial los jueves (para entrega el
  // viernes), aparte del pedido completo de todos los proveedores que se
  // cuenta cada domingo (Negocio > Pedidos a proveedores).
  incluyeJueves?: boolean;
}

// Catálogo de insumos de Bar/Cocina — el primer paso de Control de Bar y
// Control de Cocina. Cada insumo puede ligarse a un proveedor (mismo
// catálogo de arriba, para no duplicar proveedores entre secciones) y
// marcarse de alta rotación para aparecer primero en el conteo diario.
export type InsumoArea = "bar" | "cocina";

export interface InsumoEntry {
  id: string;
  area: InsumoArea;
  nombre: string;
  unidad: string;
  precio?: number;
  proveedorId?: string;
  altaRotacion?: boolean;
}

// Inventario semanal para pedidos (Negocio > Pedidos a proveedores) — una
// fila por insumo, por semana (mismas semanas que Corte). Domingo: cantidad
// inicio/fin y compras de TODOS los proveedores, para decidir el pedido
// completo que llega el lunes. Jueves: mismo formato, pero solo de los
// proveedores marcados incluyeJueves, para el pedido parcial que llega el
// viernes — ambos ciclos caen dentro de la misma semana Lunes-Domingo, así
// que comparten la misma fila.
export interface InventarioFila {
  cantidadInicio?: number;
  comprasSemana?: number;
  cantidadFin?: number;
}

export interface InventarioSemanal {
  filas: Record<string, InventarioFila>; // insumoId -> fila
  ventaSemana?: number; // capturado a mano, para comparar costo de consumo contra venta más adelante
}

export interface InventarioSemanalMonthData {
  weeks: (InventarioSemanal | null)[];
}

// Facturas/notas de proveedores pagadas por transferencia — no son efectivo,
// no afectan ningún total de caja, y se administran aparte del corte diario
// (no viven dentro de un mes/semana/día). Categoría fija (no editable) para
// que desde ya queden listas para un futuro análisis por categoría.
export interface FacturaProveedor {
  id: string;
  proveedorId: string;
  numero: string;
  total: number;
  fecha: string; // ISO date (YYYY-MM-DD)
  estado: GastoEstado;
  categoria: "operacion";
}

export interface DayData {
  meseros: MeseroCut[];
  gastos: Gasto[];
  transferencias: Transferencia[];
  ventaApps: number;
}

// Control de gastos que los proveedores dan a crédito, pagados después por
// transferencia — solo informativo: no afecta el efectivo a entregar ni
// ningún total de caja del corte. Se lleva por semana, igual que
// `efectivoReal`.
export interface CreditoProveedores {
  operativos: number;
  fijos: number;
  comisionDidi: number;
  comisionUber: number;
  comisionRappi: number;
}

export interface WeekData {
  days: Record<DayName, DayData>;
  efectivoReal?: number | null;
  creditoProveedores?: CreditoProveedores;
}

export interface MonthData {
  label: string;
  weeks: WeekData[];
  // Fecha real (ISO) del Lunes de la Semana 1. Se calcula sola al crear el
  // mes, pero es editable — las semanas 2-4 siempre son +7/+14/+21 días a
  // partir de esta, así que corregirla recorre el mes completo de una vez
  // y las semanas nunca quedan desalineadas entre sí.
  week1StartDate?: string;
}

export interface AppData {
  meseros: MeseroCatalogEntry[];
  empleados: EmpleadoEntry[];
  proveedores: ProveedorCatalogEntry[];
  facturas: FacturaProveedor[];
  months: Record<string, MonthData>;
  // Horarios por semana, usando las mismas semanas (mes/índice) que Corte —
  // así ambas secciones comparten la misma noción de "Semana N" sin
  // duplicar la fecha ancla. Solo existe entrada para los meses/semanas
  // donde ya se capturó algo.
  horarios: Record<string, HorarioMonthData>;
  // Descuentos de nómina por semana (mismas semanas que Horarios).
  nominaDescuentos: Record<string, NominaDescuentosMonthData>;
  // Catálogo de insumos de Bar y Cocina (Negocio > Control de Bar/Cocina).
  insumos: InsumoEntry[];
  // Conteo diario de insumos de alta rotación (Control de Bar/Cocina),
  // mismo formato en ambas áreas: fecha real (ISO) -> insumoId -> cantidad.
  // Solo existe entrada para las fechas donde ya se capturó algo.
  conteosDiarios: Record<string, Record<string, number>>;
  // Inventario semanal para pedidos a proveedores (mismas semanas que
  // Corte/Horarios).
  inventarioSemanal: Record<string, InventarioSemanalMonthData>;
}

// Un punto de la tendencia semanal (Negocio > Tendencias) — un resumen de
// salud del negocio por cada semana ya capturada (venta, gastos, nómina,
// utilidad y margen), en orden cronológico, sin importar el mes.
export interface WeekTrendPoint {
  monthKey: string;
  weekIndex: number;
  label: string;
  weekStartDate: string;
  ventaTotal: number;
  gastoTotal: number;
  nomina: number;
  utilidad: number;
  margenPct: number;
}

// Proyección de venta de la próxima semana, calculada con un promedio
// ponderado (más peso a las semanas recientes) ajustado por la tendencia
// semanal promedio de la ventana usada — ver computeVentaProyeccion.
export interface VentaProyeccion {
  monto: number;
  confiable: boolean;
  semanasBase: number;
  tendenciaSemanal: number;
}

export type Role = "owner" | "staff";

export interface Profile {
  id: string;
  role: Role;
  display_name: string | null;
  owner_id: string | null;
}

export interface StaffAssignment {
  id: string;
  staff_id: string;
  assigned_date: string; // ISO date (YYYY-MM-DD)
  // A qué pestaña "Semana N" del corte corresponde (0-3). Lo elige el dueño
  // al asignar, porque las semanas del corte son manuales y no siempre
  // coinciden con un cálculo automático por fecha. Nulo en asignaciones
  // guardadas antes de que existiera este campo.
  week_index: number | null;
}
