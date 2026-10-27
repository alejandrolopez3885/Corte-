import { addDaysIso, round2 } from "./dataModel";
import type { DayData, DayName } from "./types";

// Cuadrar con Johnster (Corte › ⚖︎ Cuadrar): compara cada día de la semana
// contra lo que tiene Johnster Bot (lo trae la función "johnster" a la tabla
// johnster_datos): venta, tarjetas, transferencias, efectivo de ventas y los
// gastos en efectivo uno por uno. Solo compara; no cambia nada.

export interface JohnsterIngreso {
  fecha: string;
  venta: number;
  ventaSala: number;
  apps: number;
  tarjetas: number;
  transferencias: number;
  efectivo: number;
}
export interface JohnsterGasto {
  id: string;
  fecha: string;
  monto: number;
  concepto: string;
  destino: string;
}
export interface JohnsterDatos {
  sucursal: string | null;
  ingresos: JohnsterIngreso[];
  gastos: JohnsterGasto[];
  actualizado_en: string | null;
  error: string | null;
}

// Diferencias de este tamaño o menos en los totales cuentan como "cuadra"
// (centavos y redondeos).
export const TOLERANCIA = 5;

export type EstadoGasto = "igual" | "solo-tu" | "solo-johnster" | "otro-dia" | "otro-monto";
export interface GastoComparado {
  estado: EstadoGasto;
  concepto: string;
  monto: number; // el tuyo (o el de Johnster si es "solo-johnster")
  montoJohnster?: number;
  fechaJohnster?: string; // "otro-dia": en qué día está en Johnster
  fechaTuya?: string; // "otro-dia" visto desde el día de Johnster
}
export interface Renglon {
  clave: "venta" | "tarjetas" | "transferencias" | "efectivo" | "gastos";
  titulo: string;
  tuyo: number;
  johnster: number;
  dif: number; // Johnster − tuyo
}
export interface DiaComparado {
  dia: DayName;
  fecha: string;
  sinJohnster: boolean; // Johnster no tiene ese día
  sinCorte: boolean; // tu app no tiene nada ese día
  renglones: Renglon[]; // solo los que no cuadran
  todos: Renglon[]; // los 5, cuadren o no (solo si Johnster tiene el día)
  gastos: GastoComparado[]; // solo los que no cuadran
  iguales: number; // gastos que cuadran
}

const sumar = (xs: number[]) => round2(xs.reduce((t, x) => t + (x || 0), 0));

function palabras(s: string) {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[a-z]{3,}/g) || []
  );
}
const parecidos = (a: string, b: string) => {
  const pa = palabras(a);
  return [...palabras(b)].some((w) => pa.has(w));
};
const diasEntre = (a: string, b: string) => Math.round(Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 864e5);

export function totalesDelDia(day: DayData | undefined) {
  const meseros = day?.meseros || [];
  const sala = sumar(meseros.map((m) => m.venta));
  const tarjetas = sumar(meseros.map((m) => m.tarjetas));
  const transferencias = sumar(meseros.map((m) => m.transferencia));
  return {
    venta: round2(sala + (day?.ventaApps || 0)),
    tarjetas,
    transferencias,
    efectivo: round2(sala - tarjetas - transferencias),
    gastos: sumar((day?.gastos || []).map((g) => g.total)),
  };
}

// dias: los 7 días de la semana con su fecha y lo capturado en tu app.
export function compararSemana(dias: { dia: DayName; fecha: string; day: DayData | undefined }[], j: JohnsterDatos): DiaComparado[] {
  const desde = addDaysIso(dias[0].fecha, -1);
  const hasta = addDaysIso(dias[dias.length - 1].fecha, 1);
  // Gastos de Johnster de la semana (y un día antes y después, para
  // encontrar los que se capturaron en otro día).
  const jg = j.gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta).map((g) => ({ ...g, usado: null as null | { fecha: string } }));
  const mios = dias.flatMap((d) =>
    (d.day?.gastos || []).map((g) => ({ fecha: d.fecha, concepto: g.concepto, monto: g.total, par: null as null | { j: (typeof jg)[number]; estado: EstadoGasto } }))
  );
  // Emparejar en 3 pasadas: mismo día y mismo monto; mismo día, parecido y
  // monto cercano; día de al lado, mismo monto y parecido.
  const pasadas: ((m: (typeof mios)[number], g: (typeof jg)[number]) => EstadoGasto | null)[] = [
    (m, g) => (g.fecha === m.fecha && Math.abs(g.monto - m.monto) < 0.01 ? "igual" : null),
    (m, g) => (g.fecha === m.fecha && Math.abs(g.monto - m.monto) <= TOLERANCIA && parecidos(g.concepto, m.concepto) ? "otro-monto" : null),
    (m, g) => (diasEntre(g.fecha, m.fecha) === 1 && Math.abs(g.monto - m.monto) < 0.01 && parecidos(g.concepto, m.concepto) ? "otro-dia" : null),
  ];
  for (const pasada of pasadas)
    for (const m of mios) {
      if (m.par) continue;
      for (const g of jg) {
        if (g.usado) continue;
        const estado = pasada(m, g);
        if (estado) {
          m.par = { j: g, estado };
          g.usado = { fecha: m.fecha };
          break;
        }
      }
    }

  return dias.map(({ dia, fecha, day }) => {
    const t = totalesDelDia(day);
    const ing = j.ingresos.find((i) => i.fecha === fecha);
    const jGastosDia = j.gastos.filter((g) => g.fecha === fecha);
    const renglones: Renglon[] = [];
    const todos: Renglon[] = [];
    if (ing) {
      const add = (clave: Renglon["clave"], titulo: string, tuyo: number, johnster: number) => {
        const dif = round2(johnster - tuyo);
        todos.push({ clave, titulo, tuyo, johnster, dif });
        if (Math.abs(dif) > TOLERANCIA) renglones.push({ clave, titulo, tuyo, johnster, dif });
      };
      add("venta", "Venta total", t.venta, ing.venta);
      add("tarjetas", "Tarjetas", t.tarjetas, ing.tarjetas);
      add("transferencias", "Transferencias", t.transferencias, ing.transferencias);
      add("efectivo", "Efectivo de ventas", t.efectivo, ing.efectivo);
    }
    const gastosJ = sumar(jGastosDia.map((g) => g.monto));
    const gastos: GastoComparado[] = [];
    let iguales = 0;
    mios
      .filter((m) => m.fecha === fecha)
      .forEach((m) => {
        if (!m.par) gastos.push({ estado: "solo-tu", concepto: m.concepto, monto: m.monto });
        else if (m.par.estado === "igual") iguales++;
        else if (m.par.estado === "otro-monto") gastos.push({ estado: "otro-monto", concepto: m.concepto, monto: m.monto, montoJohnster: m.par.j.monto });
        else gastos.push({ estado: "otro-dia", concepto: m.concepto, monto: m.monto, fechaJohnster: m.par.j.fecha });
      });
    jg.filter((g) => g.fecha === fecha).forEach((g) => {
      if (!g.usado) gastos.push({ estado: "solo-johnster", concepto: g.concepto, monto: g.monto });
      else if (g.usado.fecha !== fecha) gastos.push({ estado: "otro-dia", concepto: g.concepto, monto: g.monto, fechaTuya: g.usado.fecha });
    });
    if (ing || jGastosDia.length) {
      const dif = round2(gastosJ - t.gastos);
      const r: Renglon = { clave: "gastos", titulo: "Gastos en efectivo", tuyo: t.gastos, johnster: gastosJ, dif };
      todos.push(r);
      if (Math.abs(dif) > 0.009) renglones.push(r);
    }
    const sinCorte = !day || (!day.meseros.length && !day.gastos.length);
    return { dia, fecha, sinJohnster: !ing, sinCorte, renglones, todos, gastos, iguales };
  });
}
