// Generado desde src/lib/notificacionesLogica.ts con: npx esbuild src/lib/notificacionesLogica.ts --bundle --format=esm --target=es2022 --outfile=supabase/functions/notificaciones/logica.js — no editar a mano.

// src/lib/types.ts
var DAYS = ["Lunes", "Martes", "Mi\xE9rcoles", "Jueves", "Viernes", "S\xE1bado", "Domingo"];
var PLANTILLA_CONTEO_COCINA = [
  "Papas a la francesa (kg): ",
  "Papas crisscut (kg): ",
  "Alitas (kg): ",
  "Pollo (kg): ",
  "Carne de hamburguesa (kg): ",
  "Carne de taco (kg): ",
  "Dedos de queso (pz): ",
  "Elotes (pz, enteros): ",
  "Pan de hamburguesa (pz): ",
  "Pan de hot dog (pz): ",
  "Tocino (kg): ",
  "Salchicha (pz): ",
  "Guacamole (bolsa): "
].join("\n");
var PLANTILLA_CONTEO_BAR = [
  "Agua natural Johnster (pz): ",
  "Coca Cola Retornable Regular 355ml (pz): ",
  "XX Lager (pz): ",
  "Coca de sabor para llevar (pz): ",
  "Agua natural (pz): ",
  "Tecate Light (pz): ",
  "Indio (pz): ",
  "XX Caguama (pz): ",
  "Tecate rojo (pz): ",
  "XX \xE1mbar (pz): ",
  "XX ultra (pz): ",
  "Amstel (pz): ",
  "Carta blanca (pz): ",
  "Coca zero (pz): ",
  "Coca light (pz): ",
  "Caguama Indio (pz): ",
  "Caguama Tecate light (pz): ",
  "Pepsi regular (pz): ",
  "Pepsi black (pz): "
].join("\n");

// src/lib/dataModel.ts
function addDaysIso(dateStr, days) {
  const date = /* @__PURE__ */ new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function mondayOnOrBefore(dateStr) {
  const date = /* @__PURE__ */ new Date(`${dateStr}T00:00:00`);
  const jsDay = date.getDay();
  const offset = (jsDay + 6) % 7;
  return addDaysIso(dateStr, -offset);
}
function defaultWeekStartDate(monthKey, weekIndex) {
  const [y, m] = monthKey.split("-").map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const week1Start = mondayOnOrBefore(firstOfMonth);
  return addDaysIso(week1Start, weekIndex * 7);
}
function resolveWeekStartDate(monthKey, weekIndex, month) {
  const week1Start = month.week1StartDate || defaultWeekStartDate(monthKey, 0);
  return addDaysIso(week1Start, weekIndex * 7);
}
function dateForDay(monthKey, weekIndex, month, dayName) {
  return addDaysIso(resolveWeekStartDate(monthKey, weekIndex, month), DAYS.indexOf(dayName));
}
function leerConteoTexto(texto) {
  return texto.split("\n").flatMap((raw) => {
    const i = raw.indexOf(":");
    if (i < 0) return [];
    const etiqueta = raw.slice(0, i).trim();
    if (!etiqueta) return [];
    const m = etiqueta.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    return [{ nombre: m ? m[1].trim() : etiqueta, presentacion: m ? m[2].trim() : void 0, etiqueta, valor: raw.slice(i + 1).trim() }];
  });
}
function esCantidadValida(valor) {
  return /^\d+(?:[.,]\d+)?$/.test(valor);
}

// src/lib/notificacionesLogica.ts
var CONFIG_NOTIFICACIONES = {
  conteoCocina: true,
  conteoBar: true,
  alGuardar: true,
  gastos: true,
  horas: {
    cocina: { Lunes: "01:00", Martes: "01:00", Mi\u00E9rcoles: "01:00", Jueves: "01:00", Viernes: "02:00", S\u00E1bado: "02:00", Domingo: "00:00" },
    bar: { Lunes: "01:00", Martes: "01:00", Mi\u00E9rcoles: "01:00", Jueves: "01:00", Viernes: "02:00", S\u00E1bado: "02:00", Domingo: "00:00" }
  },
  repetirHoras: 9,
  horaGastos: "11:00"
};
var configDe = (data) => {
  const c = data.notificaciones;
  if (!c) return CONFIG_NOTIFICACIONES;
  return {
    ...CONFIG_NOTIFICACIONES,
    ...c,
    horas: {
      cocina: { ...CONFIG_NOTIFICACIONES.horas.cocina, ...c.horas?.cocina || {} },
      bar: { ...CONFIG_NOTIFICACIONES.horas.bar, ...c.horas?.bar || {} }
    }
  };
};
var AREA_NOMBRE = { cocina: "Cocina", bar: "Bar" };
var NOMBRE_DIA = {
  Lunes: "lunes",
  Martes: "martes",
  Mi\u00E9rcoles: "mi\xE9rcoles",
  Jueves: "jueves",
  Viernes: "viernes",
  S\u00E1bado: "s\xE1bado",
  Domingo: "domingo"
};
var diaDe = (fecha) => DAYS[((/* @__PURE__ */ new Date(`${fecha}T00:00:00Z`)).getUTCDay() + 6) % 7];
var fechaTexto = (fecha) => `${NOMBRE_DIA[diaDe(fecha)]} ${Number(fecha.slice(8))}`;
function ahoraLocal(ahora, zona = "America/Monterrey") {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ahora).map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
var minutos = (local) => Date.UTC(+local.slice(0, 4), +local.slice(5, 7) - 1, +local.slice(8, 10), +local.slice(11, 13), +local.slice(14, 16)) / 6e4;
var deMinutos = (m) => new Date(m * 6e4).toISOString().slice(0, 16);
var horaTexto = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
function horaLimite(config, area, fecha) {
  const hhmm = config.horas[area][diaDe(fecha)] || "01:00";
  return `${Number(hhmm.slice(0, 2)) < 12 ? addDaysIso(fecha, 1) : fecha}T${hhmm}`;
}
function revisarConteo(texto) {
  const r = { enCero: [], sinContar: [], contados: 0 };
  leerConteoTexto(texto).forEach((l) => {
    if (!l.valor) r.sinContar.push(l.nombre);
    else if (esCantidadValida(l.valor) && Number(l.valor.replace(",", ".")) === 0) r.enCero.push(l.nombre);
    else r.contados++;
  });
  return r;
}
var conteoHecho = (texto) => !!texto && leerConteoTexto(texto).some((l) => !!l.valor);
var lista = (xs, max = 4) => xs.length > max ? `${xs.slice(0, max).join(", ")} y ${xs.length - max} m\xE1s` : xs.join(", ");
function gastosPendientes(data, hoy) {
  const items = [];
  Object.keys(data.months).forEach((mk) => {
    const month = data.months[mk];
    month.weeks.forEach(
      (w, wi) => DAYS.forEach((d) => {
        const day = w?.days?.[d];
        if (!day || dateForDay(mk, wi, month, d) > hoy) return;
        day.gastos.forEach((g) => g.estado === "pendiente" && items.push({ concepto: g.concepto, total: g.total }));
      })
    );
  });
  return items;
}
var dinero = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
function avisosPendientes(data, ahora) {
  const config = configDe(data);
  const local = ahoraLocal(ahora);
  const hoy = local.slice(0, 10);
  const avisos = [];
  ["cocina", "bar"].forEach((area) => {
    const textos = data.conteosDiariosTexto?.[area] || {};
    const loUsan = Object.keys(textos).some((f) => f >= addDaysIso(hoy, -21));
    if (!loUsan) return;
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
          titulo: `\u23F0 Falta el conteo de ${AREA_NOMBRE[area]}`,
          cuerpo: `El del ${fechaTexto(fecha)} todav\xEDa no se hace. Te vuelvo a avisar ${siguiente.slice(0, 10) === hoy ? "a las" : "ma\xF1ana a las"} ${horaTexto(siguiente.slice(11, 16))}.`,
          url: "/"
        });
      }
    }
    if (config.alGuardar) {
      Object.entries(data.conteosEditados?.[area] || {}).forEach(([fecha, ed]) => {
        if (fecha < addDaysIso(hoy, -2) || !textos[fecha]) return;
        const quieto = (ahora.getTime() - new Date(ed.en).getTime()) / 6e4;
        if (quieto < 10) return;
        const r = revisarConteo(textos[fecha]);
        const partes = [r.enCero.length ? `En 0: ${lista(r.enCero)}` : "", r.sinContar.length ? `Sin contar: ${lista(r.sinContar)}` : ""].filter(Boolean);
        avisos.push({
          clave: `guardado:${area}:${fecha}`,
          titulo: `\u{1F4CB} Conteo de ${AREA_NOMBRE[area]} guardado${ed.por ? ` \xB7 ${ed.por}` : ""}`,
          cuerpo: partes.length ? `${partes.join(" \xB7 ")}.` : `\u2705 Completo: ${r.contados} productos contados, ninguno en 0.`,
          url: "/"
        });
      });
    }
  });
  if (config.gastos && local.slice(11, 16) >= config.horaGastos) {
    const items = gastosPendientes(data, hoy);
    if (items.length > 0) {
      const total = items.reduce((s, g) => s + g.total, 0);
      avisos.push({
        clave: `gastos:${hoy}`,
        titulo: `\u{1F4B8} ${items.length} ${items.length === 1 ? "gasto pendiente" : "gastos pendientes"} \xB7 ${dinero(total)}`,
        cuerpo: `${lista(items.map((g) => `${g.concepto} ${dinero(g.total)}`), 3)}. Toca para verlos.`,
        url: "/"
      });
    }
  }
  return avisos;
}
export {
  AREA_NOMBRE,
  CONFIG_NOTIFICACIONES,
  ahoraLocal,
  avisosPendientes,
  configDe,
  diaDe,
  fechaTexto,
  gastosPendientes,
  horaLimite,
  horaTexto,
  revisarConteo
};
