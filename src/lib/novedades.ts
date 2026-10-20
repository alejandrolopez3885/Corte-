import { supabase } from "./supabaseClient";
import { DAYS } from "./types";
import type { AppData, PermisoStaff, Profile } from "./types";

// Novedades: lo que cambió en la app, explicado en corto al personal (y al
// dueño) la primera vez que entra después del cambio (ver NovedadesAlEntrar). Cada
// cambio que vea el personal agrega aquí su novedad, con la fecha y hora
// en que se publicó y la sección a la que pertenece.
//
// A quién se le muestra: a quien hoy tiene acceso a esa sección y ya
// entraba a ella antes del cambio (si nunca la ha usado, para esa persona
// todo es nuevo). Cada quien guarda en su propia cuenta solo qué
// novedades ya vio y la última vez que entró con acceso a cada sección —
// el personal nunca consulta el historial de cambios. El dueño ve todas,
// de todas las secciones, hasta que las cierra.

export type SeccionNovedad = "corte" | PermisoStaff;

export type VisualNovedad = "sumar" | "autocompletar" | "categoria" | "faltan";

export interface Novedad {
  id: string;
  fecha: string; // ISO con hora: cuándo se publicó el cambio
  seccion: SeccionNovedad;
  titulo: string;
  texto: string; // una o dos frases; **texto** se pinta en negritas
  visual: VisualNovedad;
}

export const NOVEDADES: Novedad[] = [
  {
    id: "autocompletar-gasto",
    fecha: "2026-10-20T05:20:00Z",
    seccion: "corte",
    titulo: "El nombre del gasto se completa solo",
    texto: "Escribe las primeras letras y elige el nombre de la lista.",
    visual: "autocompletar",
  },
  {
    id: "sumar-montos",
    fecha: "2026-10-20T05:58:00Z",
    seccion: "corte",
    titulo: "Suma montos en el celular",
    texto: "En tarjetas y transferencias escribe cada monto y toca **+**. La app hace la suma.",
    visual: "sumar",
  },
  {
    id: "categoria-gasto",
    fecha: "2026-10-20T05:58:00Z",
    seccion: "corte",
    titulo: "Cada gasto lleva categoría",
    texto: "Al guardar un gasto hay que elegir su categoría. Nueva: **Servicio** (luz, gas, teléfono).",
    visual: "categoria",
  },
  {
    id: "faltan-por-contar",
    fecha: "2026-10-20T07:10:00Z",
    seccion: "inventario",
    titulo: "Lo que no hay también se pide",
    texto: "Si no anotas un producto, al guardar la app te pregunta. Marca **No hay** y sale en 0 para pedirlo.",
    visual: "faltan",
  },
];

interface EstadoNovedades {
  vistas: string[];
  // Última vez que entró teniendo acceso a cada sección (ISO).
  ultimoAcceso: Partial<Record<SeccionNovedad, string>>;
}

async function leerEstado(): Promise<EstadoNovedades> {
  const { data } = await supabase.auth.getUser();
  const guardado = (data.user?.user_metadata?.novedades || {}) as Partial<EstadoNovedades>;
  return { vistas: guardado.vistas || [], ultimoAcceso: guardado.ultimoAcceso || {} };
}

function seccionesConAcceso(profile: Profile, tieneCorte: boolean): SeccionNovedad[] {
  return [...(tieneCorte ? (["corte"] as const) : []), ...(profile.permisos || [])];
}

// Último corte que capturó esta persona según el "Corte hecho por" de cada
// día — sirve aunque todavía no tenga nada guardado en su cuenta.
function ultimoCorteHecho(data: AppData, profile: Profile): string | null {
  let ultimo: string | null = null;
  Object.values(data.months || {}).forEach((m) => {
    const inicio = m.week1StartDate;
    if (!inicio) return;
    (m.weeks || []).forEach((w, wi) =>
      DAYS.forEach((d, di) => {
        const hecho = w?.days?.[d]?.hechoPor;
        if (!hecho) return;
        const esSuyo =
          (!!profile.empleado_id && hecho.empleadoId === profile.empleado_id) ||
          (!!profile.display_name && hecho.nombre === profile.display_name);
        if (!esSuyo) return;
        const fecha = new Date(`${inicio}T12:00:00`);
        fecha.setDate(fecha.getDate() + wi * 7 + di);
        const iso = fecha.toISOString().slice(0, 10);
        if (!ultimo || iso > ultimo) ultimo = iso;
      }),
    );
  });
  return ultimo ? `${ultimo}T00:00:00` : null;
}

// Novedades que le tocan a esta persona ahora mismo, de la más vieja a la
// más nueva.
export async function novedadesPendientes(profile: Profile, data: AppData, tieneCorte: boolean): Promise<Novedad[]> {
  const estado = await leerEstado();
  // El dueño ve todas las novedades de todas las secciones (aunque él haya
  // pedido el cambio), una sola vez cada una.
  if (profile.role === "owner") {
    return NOVEDADES.filter((n) => !estado.vistas.includes(n.id)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  const secciones = seccionesConAcceso(profile, tieneCorte);
  const corteHecho = tieneCorte ? ultimoCorteHecho(data, profile) : null;
  return NOVEDADES.filter((n) => {
    if (!secciones.includes(n.seccion) || estado.vistas.includes(n.id)) return false;
    const tiempos: number[] = [];
    const acceso = estado.ultimoAcceso[n.seccion];
    if (acceso) tiempos.push(new Date(acceso).getTime());
    // El "Corte hecho por" solo dice el día del corte, no la hora en que se
    // capturó: se toma como del día anterior, para no perder novedades
    // publicadas ese mismo día.
    if (n.seccion === "corte" && corteHecho) tiempos.push(new Date(corteHecho).getTime() - 24 * 60 * 60 * 1000);
    if (tiempos.length === 0) return false;
    const ultimo = Math.max(...tiempos);
    return ultimo < new Date(n.fecha).getTime();
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Guarda qué vio y, para cada sección a la que hoy tiene acceso, que entró
// ahora. Se llama al entrar (haya o no novedades) y al cerrar el slider.
export async function registrarEntrada(profile: Profile, tieneCorte: boolean, vistas: Novedad[] = []) {
  const esDueno = profile.role === "owner";
  // El dueño solo guarda cuáles ya vio (sin entradas ni historial).
  if (esDueno && vistas.length === 0) return;
  const estado = await leerEstado();
  const ahora = new Date().toISOString();
  const ultimoAcceso = { ...estado.ultimoAcceso };
  if (!esDueno) seccionesConAcceso(profile, tieneCorte).forEach((s) => (ultimoAcceso[s] = ahora));
  const ids = [...new Set([...estado.vistas, ...vistas.map((n) => n.id)])];
  const { error } = await supabase.auth.updateUser({ data: { novedades: { vistas: ids, ultimoAcceso } } });
  if (error) console.error("No se pudo guardar el estado de las novedades", error);
  if (esDueno) return;
  // Queda también en el historial (solo agregar; el personal no lo lee).
  if (vistas.length > 0) {
    await supabase
      .from("bitacora")
      .insert({
        owner_id: profile.owner_id,
        actor_id: profile.id,
        actor_nombre: profile.display_name || "Equipo",
        tipo: "vista",
        seccion: "Novedades",
        donde: vistas.map((n) => n.titulo).join(" · "),
      })
      .then(({ error: e }) => {
        if (e && e.code !== "23514") console.error("No se pudo registrar las novedades vistas", e);
      });
  }
}
