import { addDaysIso, dateForDay, esCantidadValida, leerConteoTexto } from "./dataModel";
import { DAYS, type AppData, type ConfigNotificaciones, type ConteoTextoArea, type DayName } from "./types";

// Qué notificaciones le tocan al dueño (en su iPhone) en un momento dado.
// Lo usa la función de Supabase "notificaciones" (que corre cada 5 min) y
// la app para mostrar los horarios. Sin dependencias de la app (solo tipos
// y dataModel), para que se pueda empaquetar en la función.

export const CONFIG_NOTIFICACIONES: ConfigNotificaciones = {
  conteoCocina: true,
  conteoBar: true,
  alGuardar: true,
  gastos: true,
  horas: {
    cocina: { Lunes: "01:00", Martes: "01:00", Miércoles: "01:00", Jueves: "01:00", Viernes: "02:00", Sábado: "02:00", Domingo: "00:00" },
    bar: { Lunes: "01:00", Martes: "01:00", Miércoles: "01:00", Jueves: "01:00", Viernes: "02:00", Sábado: "02:00", Domingo: "00:00" },
  },
  repetirHoras: 9,
  horaGastos: "11:00",
};

export const configDe = (data: AppData): ConfigNotificaciones => {
  const c = data.notificaciones;
  if (!c) return CONFIG_NOTIFICACIONES;
  return {
    ...CONFIG_NOTIFICACIONES,
    ...c,
    horas: {
      cocina: { ...CONFIG_NOTIFICACIONES.horas.cocina, ...(c.horas?.cocina || {}) },
      bar: { ...CONFIG_NOTIFICACIONES.horas.bar, ...(c.horas?.bar || {}) },
    },
  };
};

export const AREA_NOMBRE: Record<ConteoTextoArea, string> = { cocina: "Cocina", bar: "Bar" };
const NOMBRE_DIA: Record<DayName, string> = {
  Lunes: "lunes", Martes: "martes", Miércoles: "miércoles", Jueves: "jueves", Viernes: "viernes", Sábado: "sábado", Domingo: "domingo",
};
export const diaDe = (fecha: string): DayName => DAYS[(new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7];
export const fechaTexto = (fecha: string) => `${NOMBRE_DIA[diaDe(fecha)]} ${Number(fecha.slice(8))}`;

// "Local" = hora de Monterrey, como "AAAA-MM-DDTHH:MM" (se compara como texto).
export function ahoraLocal(ahora: Date, zona = "America/Monterrey"): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
const minutos = (local: string) => Date.UTC(+local.slice(0, 4), +local.slice(5, 7) - 1, +local.slice(8, 10), +local.slice(11, 13), +local.slice(14, 16)) / 60000;
const deMinutos = (m: number) => new Date(m * 60000).toISOString().slice(0, 16);
export const horaTexto = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

// Hora límite del conteo de una fecha: antes de mediodía es ya de la
// madrugada siguiente ("01:00" del viernes = sábado 1:00 am); de mediodía
// en adelante, del mismo día.
export function horaLimite(config: ConfigNotificaciones, area: ConteoTextoArea, fecha: string): string {
  const hhmm = config.horas[area][diaDe(fecha)] || "01:00";
  return `${Number(hhmm.slice(0, 2)) < 12 ? addDaysIso(fecha, 1) : fecha}T${hhmm}`;
}

export interface RevisionConteo {
  enCero: string[];
  sinContar: string[];
  contados: number;
}

// Productos en 0 y sin contar de un conteo en texto.
export function revisarConteo(texto: string): RevisionConteo {
  const r: RevisionConteo = { enCero: [], sinContar: [], contados: 0 };
  leerConteoTexto(texto).forEach((l) => {
    if (!l.valor) r.sinContar.push(l.nombre);
    else if (esCantidadValida(l.valor) && Number(l.valor.replace(",", ".")) === 0) r.enCero.push(l.nombre);
    else r.contados++;
  });
  return r;
}
const conteoHecho = (texto: string | undefined) => !!texto && leerConteoTexto(texto).some((l) => !!l.valor);

const lista = (xs: string[], max = 4) => (xs.length > max ? `${xs.slice(0, max).join(", ")} y ${xs.length - max} más` : xs.join(", "));

export interface Aviso {
  clave: string; // para no mandarlo dos veces
  titulo: string;
  cuerpo: string;
  url: string;
}

// Todos los gastos en Pendiente hasta hoy.
export function gastosPendientes(data: AppData, hoy: string) {
  const items: { concepto: string; total: number }[] = [];
  Object.keys(data.months).forEach((mk) => {
    const month = data.months[mk];
    month.weeks.forEach((w, wi) =>
      DAYS.forEach((d) => {
        const day = w?.days?.[d];
        if (!day || dateForDay(mk, wi, month, d) > hoy) return;
        day.gastos.forEach((g) => g.estado === "pendiente" && items.push({ concepto: g.concepto, total: g.total }));
      })
    );
  });
  return items;
}

const dinero = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function avisosPendientes(data: AppData, ahora: Date): Aviso[] {
  const config = configDe(data);
  const local = ahoraLocal(ahora);
  const hoy = local.slice(0, 10);
  const avisos: Aviso[] = [];

  (["cocina", "bar"] as ConteoTextoArea[]).forEach((area) => {
    const textos = data.conteosDiariosTexto?.[area] || {};
    const loUsan = Object.keys(textos).some((f) => f >= addDaysIso(hoy, -21));
    if (!loUsan) return;

    // 1. Conteo que no se ha hecho a su hora límite; se repite cada N horas.
    if (area === "cocina" ? config.conteoCocina : config.conteoBar) {
      for (let i = 0; i <= 2; i++) {
        const fecha = addDaysIso(hoy, -i);
        if (conteoHecho(textos[fecha])) continue;
        const limite = horaLimite(config, area, fecha);
        const pasados = minutos(local) - minutos(limite);
        if (pasados < 0) continue;
        const cada = Math.max(1, config.repetirHoras) * 60;
        const vez = Math.floor(pasados / cada);
        const siguiente = deMinutos(minutos(limite) + (vez + 1) * cada);
        avisos.push({
          clave: `faltante:${area}:${fecha}:${vez}`,
          titulo: `⏰ Falta el conteo de ${AREA_NOMBRE[area]}`,
          cuerpo: `El del ${fechaTexto(fecha)} todavía no se hace. Te vuelvo a avisar ${siguiente.slice(0, 10) === hoy ? "a las" : "mañana a las"} ${horaTexto(siguiente.slice(11, 16))}.`,
          url: "/",
        });
      }
    }

    // 2. Al guardar un conteo (10 min sin cambios): en 0 y sin contar.
    if (config.alGuardar) {
      Object.entries(data.conteosEditados?.[area] || {}).forEach(([fecha, ed]) => {
        if (fecha < addDaysIso(hoy, -2) || !textos[fecha]) return;
        const quieto = (ahora.getTime() - new Date(ed.en).getTime()) / 60000;
        if (quieto < 10) return;
        const r = revisarConteo(textos[fecha]);
        const partes = [r.enCero.length ? `En 0: ${lista(r.enCero)}` : "", r.sinContar.length ? `Sin contar: ${lista(r.sinContar)}` : ""].filter(Boolean);
        avisos.push({
          clave: `guardado:${area}:${fecha}`,
          titulo: `📋 Conteo de ${AREA_NOMBRE[area]} guardado${ed.por ? ` · ${ed.por}` : ""}`,
          cuerpo: partes.length ? `${partes.join(" · ")}.` : `✅ Completo: ${r.contados} productos contados, ninguno en 0.`,
          url: "/",
        });
      });
    }
  });

  // 3. Gastos pendientes, una vez al día desde la hora elegida.
  if (config.gastos && local.slice(11, 16) >= config.horaGastos) {
    const items = gastosPendientes(data, hoy);
    if (items.length > 0) {
      const total = items.reduce((s, g) => s + g.total, 0);
      avisos.push({
        clave: `gastos:${hoy}`,
        titulo: `💸 ${items.length} ${items.length === 1 ? "gasto pendiente" : "gastos pendientes"} · ${dinero(total)}`,
        cuerpo: `${lista(items.map((g) => `${g.concepto} ${dinero(g.total)}`), 3)}. Toca para verlos.`,
        url: "/",
      });
    }
  }
  return avisos;
}
