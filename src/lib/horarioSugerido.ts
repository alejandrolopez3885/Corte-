import { reglasDelArea } from "./reglasHorario";
import type { Pronostico } from "./pronostico";
import { DAYS, HORARIO_AREAS_FIJAS } from "./types";
import type { DayName, HorarioArea, HorarioMonthData, HorarioSemana, MonthData, ReglasArea } from "./types";

// Horario sugerido (paso 5 del horario automático): arma la semana con las
// Reglas del personal y la venta esperada de cada día. Es solo una
// propuesta: se carga en el formulario y se corrige antes de guardar.

export interface DiaSugerido {
  // Cuántos se necesitan: el mínimo de las reglas + los que suma la venta.
  necesarios: number;
  minimo: number;
  porVenta: number;
  esperado?: number;
  trabajan: number;
  abre?: string;
  dobla?: string;
}

export interface AreaSugerida {
  area: HorarioArea;
  dias: Record<DayName, DiaSugerido>;
  avisos: string[];
}

export function sugerirHorario({
  horarios,
  months,
  reglas,
  pronosticos,
  semanaAnterior,
  inactivos,
  areaIds = HORARIO_AREAS_FIJAS.map((a) => a.id),
}: {
  horarios: Record<string, HorarioMonthData>;
  months: Record<string, MonthData>;
  reglas?: Record<string, ReglasArea>;
  pronosticos: { dia: DayName; pronostico: Pronostico | null }[];
  semanaAnterior?: HorarioSemana | null;
  inactivos?: Set<string>;
  areaIds?: string[];
}): AreaSugerida[] {
  const esperado = (d: DayName) => pronosticos.find((p) => p.dia === d)?.pronostico;
  return HORARIO_AREAS_FIJAS.filter((a) => areaIds.includes(a.id)).map((fija) => {
    const { reglas: r, filas: personas } = reglasDelArea(fija.id, reglas?.[fija.id], horarios, months, inactivos);
    const anterior = semanaAnterior?.areas.find((a) => a.id === fija.id);
    const antes = (id: string, d: DayName) => (anterior?.filas.find((f) => f.empleadoId === id)?.valores[d] || "").toUpperCase();
    const avisos: string[] = [];

    // 1. Cuántos se necesitan cada día.
    const dias = Object.fromEntries(
      DAYS.map((d) => {
        const p = esperado(d);
        const porVenta = r.subirConVenta && p ? Math.max(0, Math.floor((p.esperado - p.tipico) / r.ventaPorPersona)) : 0;
        return [d, { necesarios: r.minimo[d] + porVenta, minimo: r.minimo[d], porVenta, esperado: p?.esperado, trabajan: 0 }];
      })
    ) as Record<DayName, DiaSugerido>;

    const valores = new Map<string, Partial<Record<DayName, string>>>();
    personas.forEach((p) => valores.set(p.empleadoId, {}));

    // 2. Los de días fijos, tal cual.
    personas
      .filter((p) => p.regla.modo === "fijos")
      .forEach((p) => DAYS.forEach((d) => p.regla.fijos?.[d] && (valores.get(p.empleadoId)![d] = p.regla.fijos[d])));

    // 3. Tiempo completo: un descanso donde más sobre gente (de preferencia
    // en su día de descanso preferido y, si se puede, el mismo de la semana
    // pasada).
    const completos = personas.filter((p) => p.regla.modo === "completo");
    const fijosEn = (d: DayName) => personas.filter((p) => p.regla.modo === "fijos" && p.regla.fijos?.[d]).length;
    const sobra = Object.fromEntries(DAYS.map((d) => [d, fijosEn(d) + completos.length - dias[d].necesarios])) as Record<DayName, number>;
    if (r.descansoSemanal) {
      [...completos]
        .sort((a, b) => (a.regla.descanso?.length || 7) - (b.regla.descanso?.length || 7))
        .forEach((p) => {
          const opciones = p.regla.descanso?.length ? p.regla.descanso : DAYS;
          const puntos = (d: DayName) => sobra[d] * 100 + (antes(p.empleadoId, d) === "OFF" ? 10 : 0) - (esperado(d)?.esperado || 0) / 10000;
          const off = [...opciones].sort((a, b) => puntos(b) - puntos(a))[0];
          valores.get(p.empleadoId)![off] = "OFF";
          sobra[off]--;
        });
    }
    completos.forEach((p) => DAYS.forEach((d) => !valores.get(p.empleadoId)![d] && (valores.get(p.empleadoId)![d] = "O")));

    // 4. Quién abre: el que menos ha abierto en la semana (y si empata, el
    // que abrió ese día la semana pasada). En días con mucha gente o donde
    // faltan, el que abre dobla (Z) si puede.
    if (r.alguienAbre) {
      const aperturas = new Map<string, number>();
      const dobles = new Map<string, number>();
      const minNecesarios = Math.min(...DAYS.map((d) => dias[d].necesarios));
      const candidatos = (d: DayName) => completos.filter((p) => p.regla.puedeAbrir && valores.get(p.empleadoId)![d] === "O");
      const yaAbre = (d: DayName) => personas.find((p) => ["X", "Z"].includes(valores.get(p.empleadoId)![d] || ""));
      [...DAYS]
        .sort((a, b) => candidatos(a).length - candidatos(b).length)
        .forEach((d) => {
          const ya = yaAbre(d);
          if (ya) return void (dias[d].abre = ya.nombre);
          const c = candidatos(d).sort(
            (a, b) =>
              (aperturas.get(a.empleadoId) || 0) - (aperturas.get(b.empleadoId) || 0) ||
              (["X", "Z"].includes(antes(b.empleadoId, d)) ? 1 : 0) - (["X", "Z"].includes(antes(a.empleadoId, d)) ? 1 : 0)
          );
          if (!c.length) return void avisos.push(`${d}: nadie que pueda abrir está ese día.`);
          const cargado = dias[d].necesarios > minNecesarios || sobra[d] < 0;
          const quien = cargado ? c.find((p) => p.regla.puedeDoblar && (dobles.get(p.empleadoId) || 0) < r.maxDobles) || c[0] : c[0];
          const z = cargado && quien.regla.puedeDoblar && (dobles.get(quien.empleadoId) || 0) < r.maxDobles;
          valores.get(quien.empleadoId)![d] = z ? "Z" : "X";
          aperturas.set(quien.empleadoId, (aperturas.get(quien.empleadoId) || 0) + 1);
          if (z) dobles.set(quien.empleadoId, (dobles.get(quien.empleadoId) || 0) + 1);
          dias[d].abre = quien.nombre;
          if (z) dias[d].dobla = quien.nombre;
        });
    }

    // 5. Cuántos quedaron y qué falta.
    DAYS.forEach((d) => {
      dias[d].trabajan = personas.filter((p) => {
        const v = valores.get(p.empleadoId)![d];
        return v && v !== "OFF";
      }).length;
      const faltan = dias[d].necesarios - dias[d].trabajan;
      if (faltan > 0)
        avisos.push(
          `${d}: faltan ${faltan} en ${fija.nombre.toLowerCase()} (se necesitan ${dias[d].necesarios}${dias[d].porVenta ? `, ${dias[d].porVenta} más por la venta esperada` : ""}).`
        );
    });

    // Mismo orden que la semana pasada; los nuevos al final.
    const orden = (id: string) => {
      const i = anterior?.filas.findIndex((f) => f.empleadoId === id) ?? -1;
      return i === -1 ? 999 : i;
    };
    const filas = [...personas]
      .sort((a, b) => orden(a.empleadoId) - orden(b.empleadoId))
      .map((p) => ({ empleadoId: p.empleadoId, nombre: p.nombre, valores: valores.get(p.empleadoId)! }));
    return { area: { id: fija.id, nombre: fija.nombre, filas }, dias, avisos };
  });
}
