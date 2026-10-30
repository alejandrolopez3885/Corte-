import {
  addDaysIso, computeNominaSemana, computeWeekSummary, dateForDay, money, resolveGastosFijos, resolveMontoFijo, resolveWeekStartDate, round2,
  unidadConteo,
} from "./dataModel";
import { consumoSemana, insumosSinEquivalencia } from "./consumo";
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
  // Por pagar en transferencia esta semana (estimado a hoy).
  pagos: { nomina: number; fijos: number; operativos: number; total: number } | null;
  // Insumos sin "¿Cuánto trae 1 …?" — solo si ya se lleva inventario.
  sinEquivalencia: number;
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
  // Conteo diario de ayer (solo de las áreas que lo vienen usando): el de
  // hoy se hace en la noche, así que solo avisa si el de ayer no se hizo.
  const ayer = addDaysIso(hoy, -1);
  (["cocina", "bar"] as ConteoTextoArea[]).forEach((area) => {
    const textos = data.conteosDiariosTexto?.[area] || {};
    const loUsan = Object.keys(textos).some((f) => f >= addDaysIso(hoy, -14) && f < ayer);
    if (!loUsan) return;
    const nombre = area === "cocina" ? "Cocina" : "Bar";
    if (!textos[ayer]) {
      operacion.push({
        id: `conteo-${area}`,
        titulo: `Conteo diario de ${nombre} de ayer`,
        detalle: `${diaCorto(ayer)} · no se capturó.`,
        ir: { tipo: "conteo", area },
      });
    } else if (area === "cocina" && !data.pedidosDiarios?.cocina?.[ayer]) {
      operacion.push({
        id: `pedido-${area}`,
        titulo: `Pedido de ${nombre} de ayer sin guardar`,
        detalle: `${diaCorto(ayer)} · el conteo ya está, falta guardar lo que se va a pedir.`,
        ir: { tipo: "conteo", area },
      });
    }
  });

  // Inventario, en orden: primero el jueves y después el domingo de cada
  // semana (el domingo espera al jueves, salvo que el dueño lo salte).
  // Se revisa el domingo más reciente y, de jueves a sábado, el jueves.
  const notas = data.inventariosNotas || {};
  if (Object.keys(notas).length > 0) {
    const saltados = data.inventarioJuevesSaltado || {};
    const juevesListo = (f: string) => notas[f] !== undefined || !!saltados[f];
    const revisar: { fecha: string; modo: "completo" | "jueves"; nombre: string }[] = [];
    const agregar = (fecha: string, modo: "completo" | "jueves") => {
      if (!revisar.some((r) => r.fecha === fecha)) revisar.push({ fecha, modo, nombre: modo === "jueves" ? "del jueves" : "del domingo" });
    };
    const domingo = diaSemana === "Domingo" ? hoy : addDaysIso(lunes, -1);
    const juevesDeEseDomingo = addDaysIso(domingo, -3);
    if (notas[domingo] === undefined && !juevesListo(juevesDeEseDomingo)) agregar(juevesDeEseDomingo, "jueves");
    else agregar(domingo, "completo");
    const jueves = addDaysIso(lunes, 3);
    if (jueves <= hoy && diaSemana !== "Domingo") agregar(jueves, "jueves");
    revisar.forEach(({ fecha, modo, nombre }) => {
      if (!dias.has(fecha)) return;
      const texto = notas[fecha];
      if (texto === undefined) {
        if (modo === "jueves" && saltados[fecha]) return;
        operacion.push({
          id: `inventario-${fecha}`,
          titulo: `Inventario ${nombre} ${diaCorto(fecha).split(" ")[1]}`,
          detalle:
            modo === "jueves" && fecha === juevesDeEseDomingo
              ? "Todavía no se hace · el del domingo espera a este."
              : fecha === hoy
                ? "Se hace hoy en la noche."
                : "Todavía no se hace.",
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

  // Horario de la próxima semana, solo sábado y domingo.
  if (["Sábado", "Domingo"].includes(diaSemana) && data.empleados.length > 0) {
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

  // Hoy y mañana sin nadie asignado (solo si se usa asignar): un día antes
  // basta para asignarlo.
  const usaAsignar = [...dias.entries()].some(([f, u]) => f >= addDaysIso(hoy, -21) && !!u.day.asignadoA);
  if (usaAsignar) {
    const sinAsignar: string[] = [];
    for (let f = hoy; f <= addDaysIso(hoy, 1); f = addDaysIso(f, 1)) {
      const u = dias.get(f);
      if (u && !u.day.asignadoA && !tieneDatos(u.day)) sinAsignar.push(f);
    }
    if (sinAsignar.length > 0) {
      operacion.push({
        id: "sin-asignar",
        titulo: `${lista(sinAsignar)} sin asignar`,
        detalle:
          sinAsignar.length === 1
            ? `${sinAsignar[0] === hoy ? "Hoy" : "Mañana"} · nadie tiene asignado ese corte.`
            : "Hoy y mañana · nadie tiene asignado esos cortes.",
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
      data.months[sn.mk].weeks[sn.wi],
      lunesNomina
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

  // Consumo de insumos de domingo a domingo contra lo normal para esa venta
  // (proporción consumo/venta de hasta 4 semanas anteriores; hacen falta
  // al menos 2). También avisa si no cuadra (salió negativo).
  const domingoFin = diaSemana === "Domingo" ? hoy : addDaysIso(lunes, -1);
  const ventaSemana = (domingo: string) => {
    let v = 0;
    for (let f = addDaysIso(domingo, -6); f <= domingo; f = addDaysIso(f, 1)) {
      const d = dias.get(f)?.day;
      if (d) v += d.meseros.reduce((x, m) => x + m.venta, 0) + (d.ventaApps || 0);
    }
    return v;
  };
  const consumo = consumoSemana(data, domingoFin);
  if (consumo.size > 0) {
    const ventaActual = ventaSemana(domingoFin);
    const anteriores = [1, 2, 3, 4].map((k) => {
      const dom = addDaysIso(domingoFin, -7 * k);
      return { consumo: consumoSemana(data, dom), venta: ventaSemana(dom) };
    });
    const porId = new Map(data.insumos.map((i) => [i.id, i]));
    const altos: { insumo: (typeof data.insumos)[number]; usado: number; esperado: number; pct: number }[] = [];
    const noCuadran: { insumo: (typeof data.insumos)[number]; usado: number }[] = [];
    consumo.forEach((usado, id) => {
      const insumo = porId.get(id);
      if (!insumo) return;
      if (usado < -0.01) {
        noCuadran.push({ insumo, usado });
        return;
      }
      const ratios = anteriores
        .map((w) => ({ c: w.consumo.get(id), v: w.venta }))
        .filter((w): w is { c: number; v: number } => w.c !== undefined && w.c > 0 && w.v > 0)
        .map((w) => w.c / w.v);
      if (ratios.length < 2 || ventaActual <= 0) return;
      const esperado = (ratios.reduce((x, r) => x + r, 0) / ratios.length) * ventaActual;
      const pct = ((usado - esperado) / esperado) * 100;
      if (pct >= 25 && usado - esperado >= 1) altos.push({ insumo, usado, esperado, pct });
    });
    const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-MX");
    altos
      .sort((x, y) => y.pct - x.pct)
      .slice(0, 3)
      .forEach(({ insumo, usado, esperado, pct }) =>
        operacion.push({
          id: `consumo-${insumo.id}`,
          titulo: `${insumo.nombre}: se usaron ${fmt(usado)} ${unidadConteo(insumo)}`,
          detalle: `Lo normal con esta venta son ~${fmt(esperado)} ${unidadConteo(insumo)} (+${Math.round(pct)}%). Revisa mermas o porciones.`,
          ir: { tipo: "inventario", fecha: domingoFin, modo: "completo" },
        })
      );
    noCuadran
      .sort((x, y) => x.usado - y.usado)
      .slice(0, 2)
      .forEach(({ insumo, usado }) =>
        operacion.push({
          id: `no-cuadra-${insumo.id}`,
          titulo: `${insumo.nombre}: no cuadra`,
          detalle: `Al final había más de lo que había + lo pedido (${fmt(usado)} ${unidadConteo(insumo)}). ¿Faltó anotar un pedido o se contó mal?`,
          ir: { tipo: "inventario", fecha: domingoFin, modo: "completo" },
        })
      );
  }
  const usaInventario = Object.keys(data.inventariosNotas || {}).some((f) => f >= addDaysIso(hoy, -21));

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

  // Cancelaciones por mesero esta semana contra su promedio de las 4
  // semanas anteriores: avisa con 2 o más y al menos el doble de lo normal.
  const cancelaciones = (desde: string, hasta: string) => {
    const out = new Map<string, { n: number; monto: number }>();
    for (let f = desde; f <= hasta; f = addDaysIso(f, 1)) {
      dias.get(f)?.day.gastos.forEach((g) => {
        if (g.categoria !== "cancelaciones" || !g.meseroId) return;
        const c = out.get(g.meseroId) || { n: 0, monto: 0 };
        out.set(g.meseroId, { n: c.n + 1, monto: c.monto + g.total });
      });
    }
    return out;
  };
  const estaSemana = cancelaciones(lunes, hoy);
  const previas = cancelaciones(addDaysIso(lunes, -28), addDaysIso(lunes, -1));
  estaSemana.forEach(({ n, monto }, meseroId) => {
    const antes = previas.get(meseroId) || { n: 0, monto: 0 };
    const promN = antes.n / 4;
    if (n < 2 || n < 2 * promN) return;
    const nombre = data.meseros.find((m) => m.id === meseroId)?.nombre || "Mesero";
    negocio.push({
      id: `cancel-${meseroId}`,
      titulo: `${nombre}: ${n} cancelaciones esta semana · ${money(round2(monto))}`,
      detalle:
        antes.n === 0
          ? "No tuvo ninguna en las 4 semanas anteriores."
          : `Normalmente ${Math.round(promN * 10) / 10} por semana (${money(round2(antes.monto / 4))}).`,
      ir: { tipo: "tendencias", tarjeta: "extras" },
    });
  });

  // Por pagar en transferencia esta semana: la nómina que no alcanza el
  // efectivo (igual que "Cómo se paga" en Nómina), gastos fijos y los
  // operativos en transferencia ya capturados.
  let pagos: Inicio["pagos"] = null;
  const sa = semanas.get(lunes);
  if (sa) {
    const week = data.months[sa.mk].weeks[sa.wi];
    const neto = round2(
      computeNominaSemana(data.horarios[sa.mk]?.weeks?.[sa.wi] ?? null, data.empleados, data.nominaDescuentos[sa.mk]?.weeks?.[sa.wi] ?? null, week, lunes)
        .reduce((x, e) => x + e.neto, 0)
    );
    const efectivo = computeWeekSummary(week).efectivoRecibido;
    const nomina = round2(neto - Math.max(0, Math.min(efectivo, neto)));
    const fijos = resolveGastosFijos(week, resolveMontoFijo(data.montosFijosSemanales, lunes)).transferencia;
    const operativos = round2(week.creditoProveedores?.operativos || 0);
    pagos = { nomina, fijos, operativos, total: round2(nomina + fijos + operativos) };
  }

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
    pagos,
    sinEquivalencia: usaInventario ? insumosSinEquivalencia(data.insumos) : 0,
  };
}
