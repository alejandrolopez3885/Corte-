import { addDaysIso, diaPorFecha, mondayOnOrBefore } from "./dataModel";
import { historiaDeVenta, pronosticar } from "./pronostico";
import { normalizarValor, reglasDelArea, ultimasSemanas } from "./reglasHorario";
import { DAYS, HORARIO_AREAS_FIJAS } from "./types";
import type { DayName, HorarioMonthData, MonthData, ReglaPersona, ReglasArea } from "./types";

// Aprender (paso 6 del horario automático): compara lo que de verdad se
// guardó en los últimos horarios contra las Reglas del personal y propone
// cambios; también mide qué tanto se respetó el horario sugerido y qué tan
// bien atinó la venta esperada. Nada se cambia solo: el dueño aplica o
// ignora cada sugerencia.

export const SEMANAS_APRENDER = 4;

export interface SugerenciaRegla {
  id: string; // estable: si se ignora, no vuelve a salir
  areaId: string;
  titulo: string;
  detalle: string;
  aplicar: (r: ReglasArea) => ReglasArea;
}

export interface Aprendizaje {
  sugerencias: SugerenciaRegla[];
  semanas: number;
  // Venta real por persona trabajando en piso, por día (mediana).
  ventaPorPersona: Partial<Record<DayName, number>>;
  // Celdas que quedaron igual al horario sugerido (semanas que lo usaron).
  respetoSugerido: { semanas: number; iguales: number; total: number } | null;
  // Error promedio de la venta esperada (días con venta real).
  errorPronostico: { dias: number; pct: number; arriba: number; abajo: number } | null;
}

const CORTO: Record<DayName, string> = {
  Lunes: "lunes", Martes: "martes", Miércoles: "miércoles", Jueves: "jueves", Viernes: "viernes", Sábado: "sábados", Domingo: "domingos",
};
const UNO: Record<DayName, string> = {
  Lunes: "lunes", Martes: "martes", Miércoles: "miércoles", Jueves: "jueves", Viernes: "viernes", Sábado: "sábado", Domingo: "domingo",
};

function mediana(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const trabaja = (v: string | undefined) => {
  const n = normalizarValor(v);
  return !!n && n !== "OFF";
};

export function aprender({
  horarios,
  months,
  reglas,
  inactivos,
  ignoradas = [],
  hoy,
}: {
  horarios: Record<string, HorarioMonthData>;
  months: Record<string, MonthData>;
  reglas?: Record<string, ReglasArea>;
  inactivos?: Set<string>;
  ignoradas?: string[];
  hoy: string;
}): Aprendizaje {
  const semanas = ultimasSemanas(horarios, months, SEMANAS_APRENDER, mondayOnOrBefore(hoy));
  const n = semanas.length;
  const bastantes = Math.max(2, Math.ceil(n * 0.75));
  const sugerencias: SugerenciaRegla[] = [];

  if (n >= 2) {
    HORARIO_AREAS_FIJAS.forEach((fija) => {
      const { reglas: r, filas } = reglasDelArea(fija.id, reglas?.[fija.id], horarios, months, inactivos);
      const area = fija.nombre.toLowerCase();
      const filasDe = (s: (typeof semanas)[number]) => s.semana.areas.find((a) => a.id === fija.id)?.filas || [];

      // Cuántos trabajan cada día contra el mínimo.
      DAYS.forEach((d) => {
        const cuantos = semanas.map((s) => filasDe(s).filter((f) => trabaja(f.valores[d])).length);
        const m = Math.round(mediana(cuantos));
        const arriba = cuantos.filter((c) => c > r.minimo[d]).length;
        const abajo = cuantos.filter((c) => c < r.minimo[d]).length;
        if ((arriba >= bastantes && m > r.minimo[d]) || (abajo >= bastantes && m < r.minimo[d])) {
          sugerencias.push({
            id: `minimo:${fija.id}:${d}:${m}`,
            areaId: fija.id,
            titulo: `${m > r.minimo[d] ? "Subir" : "Bajar"} el mínimo de los ${CORTO[d]} en ${area} a ${m}`,
            detalle: `En ${m > r.minimo[d] ? arriba : abajo} de las últimas ${n} semanas pusiste ${cuantos.join(", ")} (el mínimo es ${r.minimo[d]}).`,
            aplicar: (x) => ({ ...x, minimo: { ...x.minimo, [d]: m } }),
          });
        }
      });

      // Máximo de dobles.
      const maxZ = semanas.map((s) => Math.max(0, ...filasDe(s).map((f) => DAYS.filter((d) => normalizarValor(f.valores[d]) === "Z").length)));
      const pasadas = maxZ.filter((z) => z > r.maxDobles).length;
      if (pasadas >= bastantes) {
        const nuevo = Math.round(mediana(maxZ.filter((z) => z > r.maxDobles)));
        sugerencias.push({
          id: `dobles:${fija.id}:${nuevo}`,
          areaId: fija.id,
          titulo: `Subir el máximo de dobles en ${area} a ${nuevo}`,
          detalle: `En ${pasadas} de las últimas ${n} semanas alguien dobló más de ${r.maxDobles} veces.`,
          aplicar: (x) => ({ ...x, maxDobles: nuevo }),
        });
      }

      // Cada persona de tiempo completo.
      filas
        .filter((f) => f.regla.modo === "completo")
        .forEach((f) => {
          const valores = semanas.map((s) => filasDe(s).find((x) => x.empleadoId === f.empleadoId)?.valores).filter(Boolean) as Partial<
            Record<DayName, string>
          >[];
          if (valores.length < 2) return;
          const persona = (cambio: Partial<ReglaPersona>) => (x: ReglasArea) => ({
            ...x,
            personas: { ...x.personas, [f.empleadoId]: { ...x.personas[f.empleadoId], ...cambio } },
          });
          // Descanso que se repite y no está como preferido.
          DAYS.forEach((d) => {
            const veces = valores.filter((v) => normalizarValor(v[d]) === "OFF").length;
            const pref = f.regla.descanso || [];
            if (veces >= Math.max(2, Math.ceil(valores.length * 0.75)) && !(pref.length === 1 && pref[0] === d))
              sugerencias.push({
                id: `descanso:${f.empleadoId}:${d}`,
                areaId: fija.id,
                titulo: `${f.nombre}: descanso preferido el ${UNO[d]}`,
                detalle: `Descansó en ${UNO[d]} ${veces} de las últimas ${valores.length} semanas${pref.length ? "" : " (hoy está como flexible)"}.`,
                aplicar: persona({ descanso: [d] }),
              });
          });
          const cuenta = (v: string) => valores.reduce((t, s) => t + DAYS.filter((d) => normalizarValor(s[d]) === v).length, 0);
          if (!f.regla.puedeAbrir && cuenta("X") + cuenta("Z") >= 2)
            sugerencias.push({
              id: `abre:${f.empleadoId}`,
              areaId: fija.id,
              titulo: `${f.nombre} sí puede abrir`,
              detalle: `Abrió ${cuenta("X") + cuenta("Z")} veces en las últimas ${valores.length} semanas, pero su regla dice que no abre.`,
              aplicar: persona({ puedeAbrir: true }),
            });
          if (!f.regla.puedeDoblar && cuenta("Z") >= 2)
            sugerencias.push({
              id: `dobla:${f.empleadoId}`,
              areaId: fija.id,
              titulo: `${f.nombre} sí puede doblar`,
              detalle: `Dobló ${cuenta("Z")} veces en las últimas ${valores.length} semanas, pero su regla dice que no dobla.`,
              aplicar: persona({ puedeDoblar: true }),
            });
        });
    });
  }

  // Venta real por persona en piso.
  const historia = historiaDeVenta(months);
  const ventaFecha = new Map(historia.map((h) => [h.fecha, h.venta]));
  const porDia: Partial<Record<DayName, number[]>> = {};
  semanas.forEach((s) => {
    const piso = s.semana.areas.find((a) => a.id === "piso")?.filas || [];
    DAYS.forEach((d, i) => {
      const venta = ventaFecha.get(addDaysIso(s.inicio, i));
      const gente = piso.filter((f) => trabaja(f.valores[d])).length;
      if (venta && gente) (porDia[d] = porDia[d] || []).push(venta / gente);
    });
  });
  const ventaPorPersona = Object.fromEntries(Object.entries(porDia).map(([d, xs]) => [d, Math.round(mediana(xs!))]));

  // Horario sugerido contra lo que se guardó.
  let respetoSugerido: Aprendizaje["respetoSugerido"] = null;
  semanas.forEach((s) => {
    if (!s.semana.sugerido) return;
    let iguales = 0;
    let total = 0;
    Object.entries(s.semana.sugerido).forEach(([areaId, personas]) =>
      Object.entries(personas).forEach(([emp, vals]) => {
        const real = s.semana.areas.find((a) => a.id === areaId)?.filas.find((f) => f.empleadoId === emp)?.valores || {};
        DAYS.forEach((d) => {
          total++;
          if (normalizarValor(vals[d]) === normalizarValor(real[d])) iguales++;
        });
      })
    );
    respetoSugerido = { semanas: (respetoSugerido?.semanas || 0) + 1, iguales: (respetoSugerido?.iguales || 0) + iguales, total: (respetoSugerido?.total || 0) + total };
  });

  // Venta esperada contra la real, últimos 28 días.
  const errores: number[] = [];
  for (let i = 1; i <= 28; i++) {
    const fecha = addDaysIso(hoy, -i);
    const real = ventaFecha.get(fecha);
    if (!real) continue;
    // Lo que se esperaba ese día con lo que se sabía antes de él.
    const h = historia.find((x) => x.fecha === fecha)!;
    const p = pronosticar(historia, diaPorFecha(months, fecha) || undefined, fecha, h.dia, fecha);
    if (p) errores.push((real - p.esperado) / real);
  }
  const errorPronostico = errores.length
    ? {
        dias: errores.length,
        pct: Math.round((errores.reduce((t, e) => t + Math.abs(e), 0) / errores.length) * 100),
        arriba: errores.filter((e) => e > 0.1).length,
        abajo: errores.filter((e) => e < -0.1).length,
      }
    : null;

  return { sugerencias: sugerencias.filter((s) => !ignoradas.includes(s.id)), semanas: n, ventaPorPersona, respetoSugerido, errorPronostico };
}
