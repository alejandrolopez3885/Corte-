import { addDaysIso, round2 } from "./dataModel";
import { repartoComidas } from "./comidasGratis";
import type { DayData, DayName, EmpleadoEntry, Gasto, WeekData } from "./types";

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
  tarjetaDebito?: number;
  tarjetaCredito?: number;
  comprobanteBancario?: boolean; // comprobante del banco (tarjetas) subido al bot
  comprobanteUrl?: string | null; // link de Google Drive del bancario
}
export interface JohnsterGasto {
  id: string;
  fecha: string;
  monto: number;
  concepto: string;
  destino: string;
  comprobante?: boolean; // ticket subido al bot
  tipo?: "operacion" | "nomina" | "otro";
  comprobanteUrl?: string | null; // dónde está en el bot (lo usa la función)
}
export type TipoTransferencia = "operacion" | "fijos" | "bancaria" | "didi" | "uber" | "rappi" | "nomina" | "otro";
export interface JohnsterTransferencia {
  id: string;
  fecha: string;
  monto: number;
  concepto: string;
  tipo: TipoTransferencia;
}
export interface JohnsterDatos {
  sucursal: string | null;
  ingresos: JohnsterIngreso[];
  gastos: JohnsterGasto[];
  transferencias?: JohnsterTransferencia[];
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
  gastoId?: string; // "otro-dia": tu gasto, para cambiarlo de fecha
  ticketId?: string; // gasto de Johnster con comprobante, para verlo
  junto?: { fecha: string; monto: number }[]; // gasto que junta varios de la semana
}

// Cierre de la semana: lo que se sube a Johnster junto en un solo gasto el
// domingo (gastos de Nómina de quien tiene juntarAdelantos y las comidas
// gratis), y las comidas que sí se rebajan, cada una en su día.
export interface CierreSemana {
  adelantos: { nombre: string; concepto: string; items: { fecha: string; concepto: string; monto: number; gastoId?: string }[]; total: number }[];
  comidas: {
    nombre: string;
    porSemana: number;
    valor: number;
    items: { fecha: string; monto: number; gratis: number; rebaja: number; gastoId?: string }[];
    totalGratis: number;
  }[];
}

type DiaEntrada = { dia: DayName; fecha: string; day: DayData | undefined };

// Adelantos de quien los junta que ya están en el bot en su mismo día (mismo
// monto y de nómina o nombre parecido; ej. los subió quien cerró ese día):
// esos cuentan en su día y ya no se piden en el gasto junto del domingo.
export function adelantosEnSuDia(dias: DiaEntrada[], j: JohnsterDatos | null | undefined, empleados: EmpleadoEntry[] = []): Set<string> {
  const ids = new Set<string>();
  if (!j) return ids;
  const juntan = new Set(empleados.filter((e) => e.juntarAdelantos).map((e) => e.id));
  const usados = new Set<string>();
  dias.forEach((d) =>
    (d.day?.gastos || []).forEach((g) => {
      if (g.categoria !== "nomina" || !g.empleadoId || !juntan.has(g.empleadoId)) return;
      const par = j.gastos.find(
        (x) => !usados.has(x.id) && x.fecha === d.fecha && Math.abs(x.monto - g.total) < 0.01 && (x.tipo === "nomina" || parecidos(x.concepto, g.concepto))
      );
      if (par) {
        usados.add(par.id);
        ids.add(g.id);
      }
    })
  );
  return ids;
}

export function cierreSemana(dias: DiaEntrada[], empleados: EmpleadoEntry[] = [], yaSubidos: Set<string> = new Set()): CierreSemana {
  const fechaDe = (dia: DayName) => dias.find((d) => d.dia === dia)!.fecha;
  const week = { days: Object.fromEntries(dias.map((d) => [d.dia, d.day || { meseros: [], gastos: [], transferencias: [], ventaApps: 0 }])) } as unknown as WeekData;
  const adelantos = empleados
    .filter((e) => e.juntarAdelantos)
    .map((e) => {
      const items = dias.flatMap((d) =>
        (d.day?.gastos || [])
          .filter((g) => g.categoria === "nomina" && g.empleadoId === e.id && !yaSubidos.has(g.id))
          .map((g) => ({ fecha: d.fecha, concepto: g.concepto, monto: g.total, gastoId: g.id }))
      );
      return { nombre: e.nombre, concepto: `Adelanto nómina ${e.nombre}`, items, total: round2(items.reduce((t, x) => t + x.monto, 0)) };
    })
    .filter((a) => a.items.length);
  const comidas = empleados
    .filter((e) => e.comidasGratis?.porSemana)
    .map((e) => {
      const items = repartoComidas(week, e).map((c) => ({ fecha: fechaDe(c.dia), monto: c.total, gratis: c.gratis, rebaja: c.rebaja, gastoId: c.gastoId }));
      return { nombre: e.nombre, porSemana: e.comidasGratis!.porSemana, valor: e.comidasGratis!.valor, items, totalGratis: round2(items.reduce((t, x) => t + x.gratis, 0)) };
    })
    .filter((c) => c.items.length);
  return { adelantos, comidas };
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
  // Todas las transferencias del día, igual que el total del día en Corte:
  // las del corte de un mesero y las generales (sin corte, como las que se
  // capturaban antes de ligarlas a un corte).
  const transferencias = sumar((day?.transferencias || []).map((t) => t.total));
  return {
    venta: round2(sala + (day?.ventaApps || 0)),
    tarjetas,
    transferencias,
    efectivo: round2(sala - tarjetas - transferencias),
    gastos: sumar((day?.gastos || []).map((g) => g.total)),
  };
}

// Tus gastos de la semana como se suben a Johnster, emparejados con los
// gastos de Johnster (lo usan Cuadrar y Control de gastos en efectivo).
function emparejar(dias: DiaEntrada[], j: JohnsterDatos, empleados: EmpleadoEntry[]) {
  const desde = addDaysIso(dias[0].fecha, -1);
  const hasta = addDaysIso(dias[dias.length - 1].fecha, 1);
  // Gastos de Johnster de la semana (y un día antes y después, para
  // encontrar los que se capturaron en otro día).
  const jg = j.gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta).map((g) => ({ ...g, usado: null as null | { fecha: string; gastoId?: string } }));
  // Tus gastos como se suben a Johnster: los que se juntan en el domingo
  // (adelantos de quien los junta y comidas gratis) salen de su día; de las
  // comidas solo queda en su día lo que se rebaja.
  const juntaAdelantos = new Set(empleados.filter((e) => e.juntarAdelantos).map((e) => e.id));
  const conComidas = new Map(empleados.filter((e) => e.comidasGratis?.porSemana).map((e) => [e.id, e]));
  const yaSubidos = adelantosEnSuDia(dias, j, empleados);
  const cierre = cierreSemana(dias, empleados, yaSubidos);
  const week = { days: Object.fromEntries(dias.map((d) => [d.dia, d.day || { meseros: [], gastos: [], transferencias: [], ventaApps: 0 }])) } as unknown as WeekData;
  const rebajas = new Map([...conComidas.values()].flatMap((e) => repartoComidas(week, e).map((c) => [c.gastoId, c.rebaja] as const)));
  type Mio = { fecha: string; gastoId?: string; concepto: string; monto: number; junto?: { fecha: string; monto: number }[]; juntoIds?: string[]; par: null | { j: (typeof jg)[number]; estado: EstadoGasto } };
  const mios: Mio[] = dias.flatMap((d) =>
    (d.day?.gastos || []).flatMap((g): Mio[] => {
      if (g.categoria === "nomina" && g.empleadoId && juntaAdelantos.has(g.empleadoId) && !yaSubidos.has(g.id)) return [];
      if (g.categoria === "comida_empleado" && rebajas.has(g.id)) {
        const r = rebajas.get(g.id)!;
        return r > 0 ? [{ fecha: d.fecha, gastoId: g.id, concepto: g.concepto, monto: r, par: null }] : [];
      }
      return [{ fecha: d.fecha, gastoId: g.id, concepto: g.concepto, monto: g.total, par: null }];
    })
  );
  const domingo = dias[dias.length - 1].fecha;
  cierre.adelantos.forEach((a) =>
    mios.push({ fecha: domingo, concepto: a.concepto, monto: a.total, junto: a.items.map((x) => ({ fecha: x.fecha, monto: x.monto })), juntoIds: a.items.map((x) => x.gastoId!), par: null })
  );
  cierre.comidas
    .filter((c) => c.totalGratis > 0)
    .forEach((c) =>
      mios.push({
        fecha: domingo,
        concepto: `Comida empleado ${c.nombre} (gratis)`,
        monto: c.totalGratis,
        junto: c.items.filter((x) => x.gratis > 0).map((x) => ({ fecha: x.fecha, monto: x.gratis })),
        juntoIds: c.items.filter((x) => x.gratis > 0).map((x) => x.gastoId!),
        par: null,
      })
    );
  // Emparejar en 3 pasadas: mismo día y mismo monto; mismo día, parecido y
  // monto cercano; día de al lado, mismo monto y parecido.
  const pasadas: ((m: Mio, g: (typeof jg)[number]) => EstadoGasto | null)[] = [
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
          g.usado = { fecha: m.fecha, gastoId: m.gastoId };
          break;
        }
      }
    }
  return { mios, jg };
}

// Control de gastos en efectivo: el gasto de Johnster que le corresponde a
// cada uno de tus gastos (por id), para ver su comprobante.
export function gastosEnJohnster(dias: DiaEntrada[], j: JohnsterDatos, empleados: EmpleadoEntry[] = []): Map<string, JohnsterGasto> {
  const { mios } = emparejar(dias, j, empleados);
  return new Map(mios.filter((m) => m.gastoId && m.par).map((m) => [m.gastoId!, m.par!.j]));
}

// Desde esta semana el estado de cada gasto (Pendiente / Ingresado) lo
// decide Johnster; las semanas anteriores se quedan como se marcaron a mano.
export const ESTADO_AUTO_DESDE = "2026-10-26";
// Aviso de que llegaron datos del bot (cualquier pantalla): CortesApp
// recalcula el estado de los gastos con ellos.
export const EVENTO_JOHNSTER = "johnster-datos";
export function avisarDatosJohnster(d: JohnsterDatos | null | undefined) {
  if (d?.actualizado_en) window.dispatchEvent(new CustomEvent(EVENTO_JOHNSTER, { detail: d }));
}
export const estadoAutomatico = (fecha: string | null | undefined) => !!fecha && fecha >= ESTADO_AUTO_DESDE;
export type RazonPendiente = NonNullable<Gasto["estadoBot"]>;

// Estado de cada gasto de la semana según Johnster: Ingresado si está en el
// bot con su ticket (o con la justificación "sin ticket" del dueño); los de
// nómina y comida de empleado no piden ticket. Los adelantos que se juntan y
// las comidas gratis quedan "Se sube junto el domingo" hasta que su gasto
// junto está en el bot.
export function estadosDesdeBot(dias: DiaEntrada[], j: JohnsterDatos, empleados: EmpleadoEntry[] = []) {
  const { mios } = emparejar(dias, j, empleados);
  const gastos = new Map(dias.flatMap((d) => (d.day?.gastos || []).map((g) => [g.id, g] as const)));
  const res = new Map<string, { estado: "pendiente" | "ingresado"; razon?: RazonPendiente }>();
  const peor = (id: string, r: { estado: "pendiente" | "ingresado"; razon?: RazonPendiente }) => {
    const antes = res.get(id);
    if (!antes || (antes.estado === "ingresado" && r.estado === "pendiente")) res.set(id, r);
  };
  const sinTicketOk = (g: Gasto | undefined) => !!g && (!!g.sinTicket || g.categoria === "nomina" || g.categoria === "comida_empleado" || g.categoria === "retiro");
  mios.forEach((m) => {
    if (m.junto) {
      m.juntoIds?.forEach((id) => peor(id, m.par ? { estado: "ingresado" } : { estado: "pendiente", razon: "domingo" }));
      return;
    }
    if (!m.gastoId) return;
    const g = gastos.get(m.gastoId);
    if (!m.par) peor(m.gastoId, { estado: "pendiente", razon: "no-esta" });
    else if (m.par.estado !== "igual") peor(m.gastoId, { estado: "pendiente", razon: "diferente" });
    else if (m.par.j.comprobante === false && !sinTicketOk(g)) peor(m.gastoId, { estado: "pendiente", razon: "sin-ticket" });
    else peor(m.gastoId, { estado: "ingresado" });
  });
  return res;
}

// dias: los 7 días de la semana con su fecha y lo capturado en tu app.
export function compararSemana(dias: DiaEntrada[], j: JohnsterDatos, empleados: EmpleadoEntry[] = []): DiaComparado[] {
  const { mios, jg } = emparejar(dias, j, empleados);
  const ticket = (g: JohnsterGasto) => (g.comprobante ? g.id : undefined);
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
        if (!m.par) gastos.push({ estado: "solo-tu", concepto: m.concepto, monto: m.monto, junto: m.junto });
        else if (m.par.estado === "igual") iguales++;
        else if (m.par.estado === "otro-monto") gastos.push({ estado: "otro-monto", concepto: m.concepto, monto: m.monto, montoJohnster: m.par.j.monto, ticketId: ticket(m.par.j) });
        else gastos.push({ estado: "otro-dia", concepto: m.concepto, monto: m.monto, fechaJohnster: m.par.j.fecha, gastoId: m.gastoId, ticketId: ticket(m.par.j) });
      });
    jg.filter((g) => g.fecha === fecha).forEach((g) => {
      if (!g.usado) gastos.push({ estado: "solo-johnster", concepto: g.concepto, monto: g.monto, ticketId: ticket(g) });
      else if (g.usado.fecha !== fecha) gastos.push({ estado: "otro-dia", concepto: g.concepto, monto: g.monto, fechaTuya: g.usado.fecha, gastoId: g.usado.gastoId, ticketId: ticket(g) });
    });
    if (ing || jGastosDia.length) {
      const tuyos = sumar(mios.filter((m) => m.fecha === fecha).map((m) => m.monto));
      const dif = round2(gastosJ - tuyos);
      const r: Renglon = { clave: "gastos", titulo: "Gastos en efectivo", tuyo: tuyos, johnster: gastosJ, dif };
      todos.push(r);
      if (Math.abs(dif) > 0.009) renglones.push(r);
    }
    const sinCorte = !day || (!day.meseros.length && !day.gastos.length);
    return { dia, fecha, sinJohnster: !ing, sinCorte, renglones, todos, gastos, iguales };
  });
}
