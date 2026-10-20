import { addDaysIso, computeNominaSemana, computeWeekSummary, dateForDay, money, resolveWeekStartDate, round2 } from "./dataModel";
import { leerNotasInventario } from "./inventarioNotas";
import { lunesDe } from "./tendencias";
import { calcularTendencias, type TarjetaId } from "./tendenciasAnalisis";
import type { RenglonBitacora } from "./bitacora";
import { DAYS } from "./types";
import type { AppData, ConteoTextoArea, DayData, DayName } from "./types";

// Inicio (solo el dueño): lo que necesita su atención hoy, en 4 grupos.
// Cada alerta sale sola mientras exista el pendiente y se quita sola al
// resolverlo — no se descartan a mano.

// Desde aquí existe "Guardar corte": los cortes de antes no cuentan como
// pendientes.
export const DESDE_GUARDAR_CORTE = "2026-10-20";

export type Destino =
  | { tipo: "dia"; fecha: string }
  | { tipo: "semana"; fecha: string } // abre el Resumen semanal de esa semana
  | { tipo: "gastos" }
  | { tipo: "conteo"; area: ConteoTextoArea }
  | { tipo: "inventario"; fecha: string; modo: "completo" | "jueves" }
  | { tipo: "horarios"; fecha: string } // lunes de la semana
  | { tipo: "nomina"; fecha: string }
  | { tipo: "tendencias"; tarjeta?: TarjetaId }
  | { tipo: "actividad" };

export interface AlertaInicio {
  id: string;
  titulo: string;
  detalle: string;
  ir: Destino;
}

export interface Inicio {
  urgente: AlertaInicio[];
  operacion: AlertaInicio[];
  negocio: AlertaInicio[];
  app: AlertaInicio[];
  venta: { hastaHoy: number; semanaPasada: number; diasContados: number; meta?: number };
}

interface Ubicacion {
  mk: string;
  wi: number;
  dia: DayName;
  day: DayData;
}

const tieneDatos = (d: DayData) => d.meseros.length > 0 || d.gastos.length > 0 || d.transferencias.length > 0 || (d.ventaApps || 0) > 0;

const NOMBRE_DIA: Record<DayName, string> = {
  Lunes: "Lun", Martes: "Mar", Miércoles: "Mié", Jueves: "Jue", Viernes: "Vie", Sábado: "Sáb", Domingo: "Dom",
};
// "Lun 19"
export function diaCorto(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  return `${NOMBRE_DIA[DAYS[(d.getDay() + 6) % 7]]} ${d.getDate()}`;
}
const lista = (fechas: string[]) => {
  const t = fechas.slice(0, 4).map(diaCorto);
  return fechas.length > 4 ? `${t.join(", ")} y ${fechas.length - 4} más` : t.length > 1 ? `${t.slice(0, -1).join(", ")} y ${t[t.length - 1]}` : t[0];
};

// fecha real -> dónde vive en el corte. Si una fecha cae en dos meses (una
// semana que se asoma al mes vecino), gana la que tiene datos.
export function ubicarFechas(data: AppData): Map<string, Ubicacion> {
  const mapa = new Map<string, Ubicacion>();
  Object.keys(data.months)
    .sort()
    .forEach((mk) => {
      const month = data.months[mk];
      month.weeks.forEach((w, wi) =>
        DAYS.forEach((dia) => {
          const day = w?.days?.[dia];
          if (!day) return;
          const fecha = dateForDay(mk, wi, month, dia);
          const previa = mapa.get(fecha);
          if (!previa || (!tieneDatos(previa.day) && tieneDatos(day))) mapa.set(fecha, { mk, wi, dia, day });
        })
      );
    });
  return mapa;
}

export function calcularInicio(data: AppData, hoy: string, bitacora: RenglonBitacora[] | null, ownerId: string): Inicio {
  const dias = ubicarFechas(data);
  const lunes = lunesDe(hoy);
  const diaSemana = DAYS[(new Date(`${hoy}T00:00:00`).getDay() + 6) % 7];
  const urgente: AlertaInicio[] = [];
  const operacion: AlertaInicio[] = [];
  const negocio: AlertaInicio[] = [];
  const app: AlertaInicio[] = [];

  // ---- Urgente ---------------------------------------------------------
  // Cortes de días pasados sin "Guardar corte", y días que normalmente se
  // venden (la semana anterior ese día tuvo corte) sin nada capturado.
  const sinGuardar: string[] = [];
  const sinCorte: string[] = [];
  for (let f = addDaysIso(hoy, -14); f < hoy; f = addDaysIso(f, 1)) {
    if (f < DESDE_GUARDAR_CORTE) continue;
    const u = dias.get(f);
    if (!u) continue;
    if (tieneDatos(u.day)) {
      if (!u.day.corteGuardado) sinGuardar.push(f);
    } else {
      const antes = dias.get(addDaysIso(f, -7));
      if (antes && antes.day.meseros.length > 0) sinCorte.push(f);
    }
  }
  if (sinGuardar.length > 0) {
    urgente.push({
      id: "sin-guardar",
      titulo: `${sinGuardar.length} ${sinGuardar.length === 1 ? "corte sin guardar" : "cortes sin guardar"}`,
      detalle: `${lista(sinGuardar)} · el personal todavía puede cambiar${sinGuardar.length === 1 ? "lo" : "los"}.`,
      ir: { tipo: "dia", fecha: sinGuardar[0] },
    });
  }
  if (sinCorte.length > 0) {
    urgente.push({
      id: "sin-corte",
      titulo: `${sinCorte.length} ${sinCorte.length === 1 ? "día sin corte" : "días sin corte"}`,
      detalle: `${lista(sinCorte)} · no tiene${sinCorte.length === 1 ? "" : "n"} nada capturado.`,
      ir: { tipo: "dia", fecha: sinCorte[0] },
    });
  }

  // Gastos en Pendiente de esta semana y la anterior (hasta hoy).
  let nPend = 0;
  let montoPend = 0;
  for (let f = addDaysIso(lunes, -7); f <= hoy; f = addDaysIso(f, 1)) {
    dias.get(f)?.day.gastos.forEach((g) => {
      if (g.estado !== "pendiente") return;
      nPend++;
      montoPend += g.total;
    });
  }
  if (nPend > 0) {
    urgente.push({
      id: "gastos-pendientes",
      titulo: `${nPend} ${nPend === 1 ? "gasto" : "gastos"} en Pendiente · ${money(round2(montoPend))}`,
      detalle: "Falta subir su comprobante al bot (esta semana y la pasada).",
      ir: { tipo: "gastos" },
    });
  }

  // Efectivo real de las 2 últimas semanas cerradas: sin capturar o que no
  // cuadra con lo calculado.
  const semanas = new Map<string, { mk: string; wi: number }>();
  Object.keys(data.months).forEach((mk) =>
    data.months[mk].weeks.forEach((_, wi) => {
      const l = resolveWeekStartDate(mk, wi, data.months[mk]);
      if (!semanas.has(l)) semanas.set(l, { mk, wi });
    })
  );
  [addDaysIso(lunes, -7), addDaysIso(lunes, -14)].forEach((l) => {
    const s = semanas.get(l);
    if (!s) return;
    const resumen = computeWeekSummary(data.months[s.mk].weeks[s.wi]);
    if (resumen.ventaTotal === 0) return;
    const rango = `Semana del ${diaCorto(l)} al ${diaCorto(addDaysIso(l, 6))}`;
    if (resumen.efectivoReal === null) {
      urgente.push({
        id: `efectivo-${l}`,
        titulo: "Efectivo real sin capturar",
        detalle: `${rango} · no se puede saber si cuadra.`,
        ir: { tipo: "semana", fecha: l },
      });
    } else {
      const dif = round2(resumen.efectivoReal - resumen.efectivoRecibido);
      if (Math.abs(dif) >= 1) {
        urgente.push({
          id: `efectivo-${l}`,
          titulo: `Efectivo descuadrado: ${dif < 0 ? "faltan" : "sobran"} ${money(Math.abs(dif))}`,
          detalle: `${rango} · lo contado no cuadra con lo calculado.`,
          ir: { tipo: "semana", fecha: l },
        });
      }
    }
  });

  // ---- Operación -------------------------------------------------------
  // Conteo diario de hoy (solo de las áreas que lo vienen usando).
  (["cocina", "bar"] as ConteoTextoArea[]).forEach((area) => {
    const textos = data.conteosDiariosTexto?.[area] || {};
    const loUsan = Object.keys(textos).some((f) => f >= addDaysIso(hoy, -14) && f < hoy);
    if (!loUsan) return;
    const nombre = area === "cocina" ? "Cocina" : "Bar";
    if (!textos[hoy]) {
      operacion.push({ id: `conteo-${area}`, titulo: `Conteo diario de ${nombre} de hoy`, detalle: "Todavía no se captura.", ir: { tipo: "conteo", area } });
    } else if (area === "cocina" && !data.pedidosDiarios?.cocina?.[hoy]) {
      operacion.push({
        id: `pedido-${area}`,
        titulo: `Pedido de ${nombre} de hoy sin guardar`,
        detalle: "El conteo ya está, falta guardar lo que se va a pedir.",
        ir: { tipo: "conteo", area },
      });
    }
  });

  // Inventario: el domingo más reciente y, de jueves a sábado, el jueves.
  const notas = data.inventariosNotas || {};
  if (Object.keys(notas).length > 0) {
    const domingo = diaSemana === "Domingo" ? hoy : addDaysIso(lunes, -1);
    const jueves = addDaysIso(lunes, 3);
    const revisar: { fecha: string; modo: "completo" | "jueves"; nombre: string }[] = [{ fecha: domingo, modo: "completo", nombre: "del domingo" }];
    if (jueves <= hoy && diaSemana !== "Domingo") revisar.push({ fecha: jueves, modo: "jueves", nombre: "del jueves" });
    revisar.forEach(({ fecha, modo, nombre }) => {
      if (!dias.has(fecha)) return;
      const texto = notas[fecha];
      if (texto === undefined) {
        operacion.push({
          id: `inventario-${fecha}`,
          titulo: `Inventario ${nombre} ${diaCorto(fecha).split(" ")[1]}`,
          detalle: "Todavía no se hace.",
          ir: { tipo: "inventario", fecha, modo },
        });
        return;
      }
      const noReconocidos = leerNotasInventario(texto, data.insumos).renglones.filter((r) => !r.insumoId).length;
      if (noReconocidos > 0) {
        operacion.push({
          id: `inventario-nr-${fecha}`,
          titulo: `Inventario ${nombre}: ${noReconocidos} no ${noReconocidos === 1 ? "reconocido" : "reconocidos"}`,
          detalle: "Elige qué producto es cada uno para que entre al pedido.",
          ir: { tipo: "inventario", fecha, modo },
        });
      }
    });
  }

  // Horario de la próxima semana, de jueves en adelante.
  if (["Jueves", "Viernes", "Sábado", "Domingo"].includes(diaSemana) && data.empleados.length > 0) {
    const proximo = addDaysIso(lunes, 7);
    const s = semanas.get(proximo);
    if (!s || !data.horarios[s.mk]?.weeks?.[s.wi]) {
      operacion.push({
        id: "horario-proximo",
        titulo: "Horario de la próxima semana sin guardar",
        detalle: `Semana del ${diaCorto(proximo)} al ${diaCorto(addDaysIso(proximo, 6))}.`,
        ir: { tipo: "horarios", fecha: proximo },
      });
    }
  }

  // Días de aquí a una semana sin nadie asignado (solo si se usa asignar).
  const usaAsignar = [...dias.entries()].some(([f, u]) => f >= addDaysIso(hoy, -21) && !!u.day.asignadoA);
  if (usaAsignar) {
    const sinAsignar: string[] = [];
    for (let f = hoy; f <= addDaysIso(hoy, 6); f = addDaysIso(f, 1)) {
      const u = dias.get(f);
      if (u && !u.day.asignadoA && !tieneDatos(u.day)) sinAsignar.push(f);
    }
    if (sinAsignar.length > 0) {
      operacion.push({
        id: "sin-asignar",
        titulo: `${lista(sinAsignar)} sin asignar`,
        detalle: `Nadie tiene asignado ${sinAsignar.length === 1 ? "ese corte" : "esos cortes"}.`,
        ir: { tipo: "dia", fecha: sinAsignar[0] },
      });
    }
  }

  // Nómina de la semana que cerró (o la de hoy si es domingo) sin pagar.
  const lunesNomina = diaSemana === "Domingo" ? lunes : addDaysIso(lunes, -7);
  const sn = semanas.get(lunesNomina);
  if (sn) {
    const filas = computeNominaSemana(
      data.horarios[sn.mk]?.weeks?.[sn.wi] ?? null,
      data.empleados,
      data.nominaDescuentos[sn.mk]?.weeks?.[sn.wi] ?? null,
      data.months[sn.mk].weeks[sn.wi]
    ).filter((e) => e.neto > 0);
    const sinPagar = filas.filter((e) => !e.confirmado);
    if (sinPagar.length > 0) {
      operacion.push({
        id: "nomina",
        titulo: `Nómina: ${sinPagar.length} de ${filas.length} sin marcar como pagados`,
        detalle: `Semana del ${diaCorto(lunesNomina)} al ${diaCorto(addDaysIso(lunesNomina, 6))}.`,
        ir: { tipo: "nomina", fecha: lunesNomina },
      });
    }
  }

  // ---- El negocio --------------------------------------------------------
  // Lo más importante de "Para revisar" de Tendencias (lo atípico y las
  // tendencias; lo incompleto y el efectivo ya salen arriba).
  const { t, a } = calcularTendencias(data.months, data.horarios, data.empleados, data.meseros, data.montosFijosSemanales, data.metaSemanal, hoy);
  const ORDEN = { atipico: 0, tendencia: 1, incompleto: 2 };
  a.alertas
    .filter((x) => !x.soloTarjeta && x.nivel !== "incompleto" && x.tarjeta !== "efectivo")
    .sort((x, y) => ORDEN[x.nivel] - ORDEN[y.nivel] || y.peso - x.peso)
    .slice(0, 3)
    .forEach((x, i) => negocio.push({ id: `tend-${i}`, titulo: x.titulo, detalle: x.detalle, ir: { tipo: "tendencias", tarjeta: x.tarjeta } }));

  // ---- La app y el equipo ----------------------------------------------
  if (bitacora) {
    const delEquipo = bitacora.filter((r) => r.actor_id !== ownerId);
    const cambios = delEquipo.filter((r) => r.tipo === "cambio");
    const quien = (rs: RenglonBitacora[]) => [...new Set(rs.map((r) => r.actor_nombre || "Equipo"))].join(", ");
    const eliminaciones = cambios.filter((r) => (r.detalle || []).some((c) => c.accion === "eliminó"));
    if (eliminaciones.length > 0) {
      app.push({
        id: "eliminaciones",
        titulo: `${eliminaciones.length} ${eliminaciones.length === 1 ? "cambio con algo eliminado" : "cambios con algo eliminado"}`,
        detalle: `${quien(eliminaciones)} · últimos 7 días.`,
        ir: { tipo: "actividad" },
      });
    }
    const hora = (r: RenglonBitacora) => new Date(r.creado_en).getHours();
    const madrugada = cambios.filter((r) => hora(r) >= 2 && hora(r) < 6);
    if (madrugada.length > 0) {
      app.push({
        id: "madrugada",
        titulo: `${madrugada.length} ${madrugada.length === 1 ? "cambio" : "cambios"} entre 2 y 6 a.m.`,
        detalle: `${quien(madrugada)} · últimos 7 días.`,
        ir: { tipo: "actividad" },
      });
    }
    const fechaLocal = (ts: string) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const tarde = cambios.filter((r) => r.seccion === "Corte" && !!r.ref_fecha && fechaLocal(r.creado_en) > addDaysIso(r.ref_fecha, 1));
    if (tarde.length > 0) {
      app.push({
        id: "tarde",
        titulo: `${tarde.length} ${tarde.length === 1 ? "cambio" : "cambios"} a cortes de días pasados`,
        detalle: `${quien(tarde)} · últimos 7 días.`,
        ir: { tipo: "actividad" },
      });
    }
    // Quien tiene asignado el corte de hoy o mañana y no ha entrado en 7 días.
    const entraron = new Set(bitacora.map((r) => r.actor_id));
    [hoy, addDaysIso(hoy, 1)].forEach((f) => {
      const asignado = dias.get(f)?.day.asignadoA;
      if (!asignado || entraron.has(asignado.staffId) || tieneDatos(dias.get(f)!.day)) return;
      app.push({
        id: `no-entra-${f}`,
        titulo: `${asignado.nombre} no ha entrado`,
        detalle: `Tiene asignado el corte de ${f === hoy ? "hoy" : "mañana"} y no ha abierto la app en 7 días.`,
        ir: { tipo: "dia", fecha: f },
      });
    });
  }

  return {
    urgente,
    operacion,
    negocio,
    app,
    venta: { hastaHoy: t.hastaHoy, semanaPasada: t.mismosDiasSemanaPasada, diasContados: t.diasContados, meta: data.metaSemanal },
  };
}
