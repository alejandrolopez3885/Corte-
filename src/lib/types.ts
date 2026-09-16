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
  proveedores: ProveedorCatalogEntry[];
  facturas: FacturaProveedor[];
  months: Record<string, MonthData>;
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
