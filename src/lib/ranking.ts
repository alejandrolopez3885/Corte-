import { addDaysIso, mondayOnOrBefore, normalizarNombre, round2, todayIso } from "./dataModel";
import { ubicarFechas } from "./inicio";
import type { AppData, EmpleadoEntry, Profile } from "./types";

// Ranking de meseros: un puntaje por periodo con la venta y las
// cancelaciones de cada mesero del corte (sin el usuario de para llevar ni
// las apps). La venta promedio por día trabajado da hasta 100 puntos (100 =
// quien más vende por día en ese periodo) y cada 1% de cancelaciones sobre
// su venta resta 10. Para aparecer hacen falta 2 días trabajados.

export const MINIMO_DIAS_RANKING = 2;
const PUNTOS_POR_PCT_CANCELACION = 10;

export interface FilaRanking {
  meseroId: string;
  nombre: string;
  empleado?: EmpleadoEntry; // para la foto
  dias: number;
  venta: number; // total del periodo
  ventaPorDia: number;
  cancelaciones: number; // total en dinero
  pctCancelacion: number; // 0–100, un decimal
  puntosVenta: number;
  puntosCancelacion: number; // lo que resta (positivo)
  puntos: number;
  lugar: number;
}

export interface Ranking {
  desde: string;
  hasta: string;
  filas: FilaRanking[]; // ya ordenadas
  sinEntrar: { meseroId: string; nombre: string; dias: number }[];
}

// Su persona en Personal: la que tiene ese usuario del sistema o se llama
// igual (o el usuario del sistema es su primer nombre).
export function empleadoDeMesero(data: AppData, meseroId: string, nombre: string): EmpleadoEntry | undefined {
  const n = normalizarNombre(nombre);
  return (
    data.empleados.find((e) => e.usuarioSistemaId === meseroId) ||
    data.empleados.find((e) => normalizarNombre(e.nombre) === n) ||
    data.empleados.find((e) => normalizarNombre(e.nombre).split(" ")[0] === n)
  );
}

// El mesero que es esta cuenta de equipo (para marcar "Tú").
export function meseroDeEmpleado(data: AppData, empleado: EmpleadoEntry | undefined): string | undefined {
  if (!empleado) return undefined;
  if (empleado.usuarioSistemaId && data.meseros.some((m) => m.id === empleado.usuarioSistemaId)) return empleado.usuarioSistemaId;
  const n = normalizarNombre(empleado.nombre);
  const opciones = data.meseros.filter((m) => !m.acumulado);
  return (
    opciones.find((m) => normalizarNombre(m.nombre) === n)?.id ||
    opciones.find((m) => normalizarNombre(m.nombre) === n.split(" ")[0])?.id
  );
}

export function calcularRanking(data: AppData, desde: string, hasta: string): Ranking {
  const acumulados = new Set(data.meseros.filter((m) => m.acumulado).map((m) => m.id));
  const ubicaciones = ubicarFechas(data);
  const porMesero = new Map<string, { nombre: string; venta: number; dias: Set<string>; cancelaciones: number }>();
  const de = (id: string, nombre: string) => {
    if (!porMesero.has(id)) porMesero.set(id, { nombre, venta: 0, dias: new Set(), cancelaciones: 0 });
    return porMesero.get(id)!;
  };
  for (let f = desde; f <= hasta; f = addDaysIso(f, 1)) {
    const day = ubicaciones.get(f)?.day;
    if (!day) continue;
    day.meseros.forEach((m) => {
      if (acumulados.has(m.meseroId)) return;
      const x = de(m.meseroId, data.meseros.find((c) => c.id === m.meseroId)?.nombre || m.nombre);
      x.venta += m.venta;
      if (m.venta > 0) x.dias.add(f);
    });
    day.gastos.forEach((g) => {
      if (g.categoria !== "cancelaciones" || !g.meseroId || acumulados.has(g.meseroId)) return;
      de(g.meseroId, data.meseros.find((c) => c.id === g.meseroId)?.nombre || "Mesero").cancelaciones += g.total;
    });
  }
  const entran = [...porMesero.entries()].filter(([, x]) => x.dias.size >= MINIMO_DIAS_RANKING && x.venta > 0);
  const sinEntrar = [...porMesero.entries()]
    .filter(([, x]) => x.dias.size > 0 && x.dias.size < MINIMO_DIAS_RANKING)
    .map(([meseroId, x]) => ({ meseroId, nombre: x.nombre, dias: x.dias.size }));
  const mejor = Math.max(0, ...entran.map(([, x]) => x.venta / x.dias.size));
  const filas = entran
    .map(([meseroId, x]) => {
      const ventaPorDia = round2(x.venta / x.dias.size);
      const pctCancelacion = Math.round((x.cancelaciones / x.venta) * 1000) / 10;
      const puntosVenta = mejor > 0 ? Math.round((100 * ventaPorDia) / mejor) : 0;
      const puntosCancelacion = Math.round(pctCancelacion * PUNTOS_POR_PCT_CANCELACION);
      return {
        meseroId,
        nombre: x.nombre,
        empleado: empleadoDeMesero(data, meseroId, x.nombre),
        dias: x.dias.size,
        venta: round2(x.venta),
        ventaPorDia,
        cancelaciones: round2(x.cancelaciones),
        pctCancelacion,
        puntosVenta,
        puntosCancelacion,
        puntos: Math.max(0, puntosVenta - puntosCancelacion),
        lugar: 0,
      };
    })
    .sort((a, b) => b.puntos - a.puntos || b.puntosVenta - a.puntosVenta || a.nombre.localeCompare(b.nombre));
  // Empates: mismo lugar.
  filas.forEach((f, i) => (f.lugar = i > 0 && filas[i - 1].puntos === f.puntos ? filas[i - 1].lugar : i + 1));
  return { desde, hasta, filas, sinEntrar };
}

export type PeriodoRanking = "semana" | "semanaPasada" | "mes";

export function rangoRanking(periodo: PeriodoRanking, hoy = todayIso()): { desde: string; hasta: string } {
  const lunes = mondayOnOrBefore(hoy);
  if (periodo === "semanaPasada") return { desde: addDaysIso(lunes, -7), hasta: addDaysIso(lunes, -1) };
  if (periodo === "mes") return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  return { desde: lunes, hasta: hoy };
}

// Las cuentas de equipo del área Piso ven el ranking (sin montos), y
// también quien tiene cortes como mesero aunque sea de otra área (ej. de
// barra): ellos juegan en el ranking, las encuestas y los puntos.
export function esDePiso(data: AppData, profile: Profile): boolean {
  const empleado = data.empleados.find((e) => e.id === profile.empleado_id);
  const puesto = empleado?.puestoId ? data.puestos.find((p) => p.id === empleado.puestoId) : undefined;
  const area = puesto ? data.areas.find((a) => a.id === puesto.areaId) : undefined;
  if (area && normalizarNombre(area.nombre) === "piso") return true;
  const meseroId = meseroDeEmpleado(data, empleado);
  return !!meseroId && tieneCortesRecientes(data, meseroId);
}

// Si ese mesero tiene venta en algún corte de los últimos 3 meses del corte.
function tieneCortesRecientes(data: AppData, meseroId: string): boolean {
  return Object.keys(data.months)
    .sort()
    .slice(-3)
    .some((mk) => data.months[mk].weeks.some((w) => Object.values(w?.days || {}).some((d) => d.meseros.some((m) => m.meseroId === meseroId && m.venta > 0))));
}
