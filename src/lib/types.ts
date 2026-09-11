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

export interface Gasto {
  id: string;
  concepto: string;
  total: number;
  estado: GastoEstado;
  origen: GastoOrigen;
  meseroNombre?: string;
  meseroCutId?: string;
}

export interface Transferencia {
  id: string;
  persona: string;
  total: number;
  origen?: "mesero";
  meseroCutId?: string;
}

export interface DayData {
  meseros: MeseroCut[];
  gastos: Gasto[];
  transferencias: Transferencia[];
  ventaApps: number;
}

export interface WeekData {
  days: Record<DayName, DayData>;
  efectivoReal?: number | null;
}

export interface MonthData {
  label: string;
  weeks: WeekData[];
}

export interface AppData {
  meseros: MeseroCatalogEntry[];
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
}
