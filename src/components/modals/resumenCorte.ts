import { createContext } from "react";

export interface ResumenCorte {
  venta: number;
  efectivo: number;
  tarjetas: number;
  transferencias: number;
  gastos: number;
}

export const ResumenCorteContext = createContext<ResumenCorte | null>(null);
