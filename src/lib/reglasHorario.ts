import { resolveWeekStartDate } from "./dataModel";
import { DAYS } from "./types";
import type { DayName, HorarioMonthData, MonthData, ReglaPersona, ReglasArea } from "./types";

// Reglas del personal (paso 4 del horario automático). Lo que el dueño no
// ha guardado se llena con lo que se hizo en los últimos 6 horarios.

const MINIMOS: Record<string, number[]> = {
  piso: [3, 3, 3, 4, 6, 6, 6],
  cocina: [2, 2, 2, 2, 3, 3, 3],
};

export const SEMANAS_DE_HISTORIA = 6;

// "6:30 PM" → "6:30", "7:00 PM" → "7", "o" → "O".
export function normalizarValor(v: string | undefined): string {
  const t = (v || "").trim().toUpperCase().replace(/\s*(PM|P\.M\.)$/, "").replace(/:00$/, "");
  return t;
}

export interface FilaReglas {
  empleadoId: string;
  nombre: string;
  regla: ReglaPersona;
}

// Últimos horarios guardados (de la más reciente a la más vieja).
export function ultimasSemanas(
  horarios: Record<string, HorarioMonthData>,
  months: Record<string, MonthData>,
  n = SEMANAS_DE_HISTORIA,
  hastaInicio?: string
) {
  const semanas = Object.entries(horarios).flatMap(([mk, m]) =>
    months[mk] ? m.weeks.flatMap((s, wi) => (s ? [{ inicio: resolveWeekStartDate(mk, wi, months[mk]), semana: s }] : [])) : []
  );
  return semanas
    .filter((s) => !hastaInicio || s.inicio <= hastaInicio)
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
    .slice(0, n);
}

function moda(valores: string[]): { valor: string; veces: number } | null {
  const cuenta = new Map<string, number>();
  valores.forEach((v) => cuenta.set(v, (cuenta.get(v) || 0) + 1));
  let mejor: { valor: string; veces: number } | null = null;
  cuenta.forEach((veces, valor) => {
    if (!mejor || veces > mejor.veces) mejor = { valor, veces };
  });
  return mejor;
}

// Lo que se deduce de cómo ha trabajado alguien.
export function reglaDeHistoria(valoresPorSemana: Partial<Record<DayName, string>>[]): ReglaPersona {
  const todos = valoresPorSemana.flatMap((s) => DAYS.map((d) => normalizarValor(s[d])));
  const cuenta = (v: string) => todos.filter((x) => x === v).length;
  const offs = cuenta("OFF");
  const diasVacios = DAYS.filter((d) => valoresPorSemana.every((s) => !normalizarValor(s[d])));
  if (valoresPorSemana.length > 0 && offs === 0 && diasVacios.length > 0) {
    const fijos: Partial<Record<DayName, string>> = {};
    DAYS.forEach((d) => {
      const m = moda(valoresPorSemana.map((s) => normalizarValor(s[d])).filter(Boolean));
      if (m && m.veces * 2 >= valoresPorSemana.length) fijos[d] = m.valor;
    });
    const vals = Object.values(fijos);
    return { modo: "fijos", fijos, puedeAbrir: vals.includes("X"), puedeCerrar: vals.includes("O"), puedeDoblar: vals.includes("Z") };
  }
  const diasOff = DAYS.filter((d) => valoresPorSemana.some((s) => normalizarValor(s[d]) === "OFF"));
  const conHistoria = valoresPorSemana.length > 0;
  return {
    modo: "completo",
    // Z = abre y dobla, también cuenta como abrir.
    puedeAbrir: !conHistoria || cuenta("X") + cuenta("Z") >= 2,
    puedeCerrar: !conHistoria || cuenta("O") >= 1,
    puedeDoblar: !conHistoria || cuenta("Z") >= 1,
    descanso: diasOff.length > 0 && diasOff.length <= 3 ? diasOff : [],
  };
}

// Reglas de un área: lo guardado encima de lo deducido del historial. Las
// personas son quienes salieron en esa área en los últimos horarios (sin
// los marcados como inactivos en Personal).
export function reglasDelArea(
  areaId: string,
  guardadas: ReglasArea | undefined,
  horarios: Record<string, HorarioMonthData>,
  months: Record<string, MonthData>,
  inactivos?: Set<string>
): { reglas: ReglasArea; filas: FilaReglas[] } {
  const semanas = ultimasSemanas(horarios, months);
  const personas = new Map<string, { nombre: string; valores: Partial<Record<DayName, string>>[] }>();
  semanas.forEach(({ semana }) =>
    semana.areas
      .find((a) => a.id === areaId)
      ?.filas.forEach((f) => {
        if (inactivos?.has(f.empleadoId)) return;
        const p = personas.get(f.empleadoId) || { nombre: f.nombre, valores: [] };
        p.valores.push(f.valores);
        personas.set(f.empleadoId, p);
      })
  );
  const minimos = MINIMOS[areaId] || MINIMOS.cocina;
  const reglas: ReglasArea = {
    minimo: Object.fromEntries(DAYS.map((d, i) => [d, minimos[i]])) as Record<DayName, number>,
    subirConVenta: areaId === "piso",
    ventaPorPersona: areaId === "piso" ? 6000 : 10000,
    alguienAbre: true,
    maxDobles: 2,
    descansoSemanal: true,
    noDoblarSeguido: true,
    alguienCorte: true,
    ...guardadas,
    personas: { ...guardadas?.personas },
  };
  const filas: FilaReglas[] = [];
  personas.forEach((p, empleadoId) => {
    // Agregado al horario pero sin un solo día capturado: aún no cuenta.
    if (!reglas.personas[empleadoId] && p.valores.every((v) => DAYS.every((d) => !normalizarValor(v[d])))) return;
    const regla = reglas.personas[empleadoId] || reglaDeHistoria(p.valores);
    reglas.personas[empleadoId] = regla;
    filas.push({ empleadoId, nombre: p.nombre, regla });
  });
  // Tiempo completo primero; luego los de días fijos.
  filas.sort((a, b) => (a.regla.modo === b.regla.modo ? 0 : a.regla.modo === "completo" ? -1 : 1));
  return { reglas, filas };
}

const CORTO: Record<DayName, string> = {
  Lunes: "lun", Martes: "mar", Miércoles: "mié", Jueves: "jue", Viernes: "vie", Sábado: "sáb", Domingo: "dom",
};

// "Descanso mié o jue", "Descanso lun–mié", "Descanso flexible".
export function textoDescanso(dias: DayName[] | undefined): string {
  const d = DAYS.filter((x) => dias?.includes(x));
  if (d.length === 0) return "Descanso flexible";
  const idx = d.map((x) => DAYS.indexOf(x));
  const seguidos = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (d.length >= 3 && seguidos) return `Descanso ${CORTO[d[0]]}–${CORTO[d[d.length - 1]]}`;
  return `Descanso ${d.map((x) => CORTO[x]).join(d.length === 2 ? " o " : ", ")}`;
}

export function textoFijos(fijos: Partial<Record<DayName, string>> | undefined): string {
  const d = DAYS.filter((x) => fijos?.[x]);
  if (d.length === 0) return "Días fijos: sin días";
  return `Días fijos: ${d.map((x) => `${CORTO[x][0].toUpperCase()}${CORTO[x].slice(1)} ${fijos![x]}`).join(" · ")}`;
}
