import { supabase } from "./supabaseClient";
import { MOTIVOS, esValida } from "./encuestas";

// Seguimiento de encuestas (solo dueño; ver supabase/migration_012):
// cada paso de cada encuesta, desde que el mesero intenta generarla hasta
// que se envía o dónde se quedó, más el embudo y el resumen por mesero.

export type TipoEvento =
  | "fallida"
  | "generada"
  | "abierta"
  | "reabierta"
  | "empezada"
  | "enviada"
  | "tarde"
  | "cancelada"
  | "aprobada"
  | "descartada"
  | "marcada";

export interface EventoEncuesta {
  id: number;
  encuesta_id: string | null;
  mesero_id: string | null;
  mesero_nombre: string | null;
  tipo: TipoEvento;
  detalle: string | null;
  creado_en: string;
}

export interface EncuestaSeguida {
  id: string;
  mesero_id: string;
  mesero_nombre: string;
  total: number;
  mesa: string | null;
  creado_en: string;
  vence_en: string;
  cancelada: boolean;
  respondida_en: string | null;
  encuesta_respuestas: { motivos: string[]; revision: "aprobada" | "descartada" | null } | null;
}

const POR_PAGINA = 1000;

// Supabase regresa máximo 1000 filas por consulta: se piden por páginas.
async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[] | null> {
  const filas: T[] = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await consulta(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);
    if (error) {
      console.error("No se pudo leer el seguimiento de encuestas", error);
      return null;
    }
    filas.push(...((data || []) as T[]));
    if (!data || data.length < POR_PAGINA) return filas;
  }
}

// Las encuestas generadas entre dos fechas (locales), sus eventos y los
// intentos fallidos de esas fechas.
export async function cargarSeguimiento(desde: string, hasta: string): Promise<{ encuestas: EncuestaSeguida[]; eventos: EventoEncuesta[] } | null> {
  const inicio = new Date(`${desde}T00:00:00`).toISOString();
  const finFecha = new Date(`${hasta}T00:00:00`);
  finFecha.setDate(finFecha.getDate() + 1);
  const fin = finFecha.toISOString();
  const encuestas = await todas<EncuestaSeguida>((a, b) =>
    supabase
      .from("encuestas")
      .select("id, mesero_id, mesero_nombre, total, mesa, creado_en, vence_en, cancelada, respondida_en, encuesta_respuestas(motivos, revision)")
      .gte("creado_en", inicio)
      .lt("creado_en", fin)
      .order("creado_en", { ascending: false })
      .range(a, b)
  );
  if (!encuestas) return null;
  // La respuesta viene como objeto (una por encuesta), o como lista según la versión.
  encuestas.forEach((e) => {
    const r = e.encuesta_respuestas as unknown;
    if (Array.isArray(r)) e.encuesta_respuestas = r[0] || null;
  });
  const fallidas = await todas<EventoEncuesta>((a, b) =>
    supabase.from("encuesta_eventos").select("*").eq("tipo", "fallida").gte("creado_en", inicio).lt("creado_en", fin).order("id").range(a, b)
  );
  if (!fallidas) return null;
  const eventos: EventoEncuesta[] = [...fallidas];
  const ids = encuestas.map((e) => e.id);
  for (let i = 0; i < ids.length; i += 150) {
    const trozo = ids.slice(i, i + 150);
    const lista = await todas<EventoEncuesta>((a, b) => supabase.from("encuesta_eventos").select("*").in("encuesta_id", trozo).order("id").range(a, b));
    if (!lista) return null;
    eventos.push(...lista);
  }
  return { encuestas, eventos };
}

// --- Resumen --------------------------------------------------------------
export type Final = "enviada" | "sospechosa" | "descartada" | "medias" | "sin-abrir" | "cancelada" | "abierta" | "fallida";

export const ETIQUETA_FINAL: Record<Final, string> = {
  enviada: "Enviada",
  sospechosa: "Sospechosa",
  descartada: "Descartada",
  medias: "Se quedó a medias",
  "sin-abrir": "Nadie la abrió",
  cancelada: "Cancelada",
  abierta: "Abierta ahora",
  fallida: "No se generó",
};

export const MOTIVOS_INTENTO: Record<string, string> = {
  limite: "ya tenía las 15 de hoy",
  "sin-total": "no escribió el total",
  "sin-ligar": "no está ligado a su usuario en Personal",
  conexion: "sin conexión",
  otro: "no se pudo",
};

export interface Paso {
  cuando: string;
  texto: string;
  tono?: "no" | "gris";
}

export interface FilaBitacora {
  clave: string;
  meseroClave: string;
  meseroNombre: string;
  total?: number;
  mesa?: string | null;
  cuando: string;
  final: Final;
  pasos: Paso[];
}

export interface ResumenMesero {
  clave: string;
  nombre: string;
  genero: number;
  enviadas: number;
  sinAbrir: number;
  medias: number;
  canceladas: number;
  sospechosas: number;
  fallidas: number;
  porMotivo: Record<string, number>;
}

export interface Seguimiento {
  generadas: number;
  abiertas: number;
  empezadas: number;
  enviadas: number;
  validas: number;
  sinAbrir: number;
  medias: number;
  canceladas: number;
  abiertasAhora: number;
  sospechosas: number;
  fallidas: number;
  // Medianas en segundos: de generada a abierta y de abierta a enviada.
  tardaAbrir: number | null;
  tardaContestar: number | null;
  meseros: ResumenMesero[];
  bitacora: FilaBitacora[];
}

export function duracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const seg = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 1000;
const motivosTexto = (detalle: string | null) =>
  (detalle || "")
    .split(",")
    .filter(Boolean)
    .map((m) => MOTIVOS[m] || m);
const claveMesero = (id: string | null, nombre: string | null) => id || `nombre:${(nombre || "Sin nombre").trim().toLowerCase()}`;

export function resumirSeguimiento(encuestas: EncuestaSeguida[], eventos: EventoEncuesta[], ahora: number): Seguimiento {
  const porEncuesta = new Map<string, EventoEncuesta[]>();
  eventos.forEach((ev) => {
    if (ev.encuesta_id) porEncuesta.set(ev.encuesta_id, [...(porEncuesta.get(ev.encuesta_id) || []), ev]);
  });
  const meseros = new Map<string, ResumenMesero>();
  const mesero = (clave: string, nombre: string) => {
    let m = meseros.get(clave);
    if (!m) {
      m = { clave, nombre, genero: 0, enviadas: 0, sinAbrir: 0, medias: 0, canceladas: 0, sospechosas: 0, fallidas: 0, porMotivo: {} };
      meseros.set(clave, m);
    }
    return m;
  };
  const r: Seguimiento = {
    generadas: 0,
    abiertas: 0,
    empezadas: 0,
    enviadas: 0,
    validas: 0,
    sinAbrir: 0,
    medias: 0,
    canceladas: 0,
    abiertasAhora: 0,
    sospechosas: 0,
    fallidas: 0,
    tardaAbrir: null,
    tardaContestar: null,
    meseros: [],
    bitacora: [],
  };
  const tAbrir: number[] = [];
  const tContestar: number[] = [];

  for (const e of encuestas) {
    const evs = (porEncuesta.get(e.id) || []).sort((a, b) => a.creado_en.localeCompare(b.creado_en) || a.id - b.id);
    const tiene = (t: TipoEvento) => evs.find((x) => x.tipo === t);
    const abierta = tiene("abierta");
    const enviada = tiene("enviada");
    const respondida = !!e.respondida_en;
    const vencida = !respondida && !e.cancelada && new Date(e.vence_en).getTime() < ahora;
    const resp = e.encuesta_respuestas;
    const m = mesero(claveMesero(e.mesero_id, e.mesero_nombre), e.mesero_nombre);
    m.genero++;
    r.generadas++;
    if (abierta || respondida) r.abiertas++;
    if (tiene("empezada") || respondida) r.empezadas++;

    let final: Final;
    if (respondida) {
      r.enviadas++;
      m.enviadas++;
      if (resp && esValida(resp)) {
        r.validas++;
        final = "enviada";
      } else if (resp?.revision === "descartada") {
        final = "descartada";
      } else {
        r.sospechosas++;
        m.sospechosas++;
        final = "sospechosa";
      }
    } else if (e.cancelada) {
      r.canceladas++;
      m.canceladas++;
      final = "cancelada";
    } else if (vencida) {
      if (abierta || tiene("empezada")) {
        r.medias++;
        m.medias++;
        final = "medias";
      } else {
        r.sinAbrir++;
        m.sinAbrir++;
        final = "sin-abrir";
      }
    } else {
      r.abiertasAhora++;
      final = "abierta";
    }
    if (abierta) tAbrir.push(seg(e.creado_en, abierta.creado_en));
    if (abierta && enviada) tContestar.push(seg(abierta.creado_en, enviada.creado_en));

    const pasos: Paso[] = [];
    let motivosVistos = new Set<string>();
    for (const ev of evs) {
      switch (ev.tipo) {
        case "generada":
          pasos.push({ cuando: ev.creado_en, texto: "Generada" });
          break;
        case "abierta":
          pasos.push({ cuando: ev.creado_en, texto: "El cliente la abrió" });
          break;
        case "reabierta":
          pasos.push({
            cuando: ev.creado_en,
            tono: "gris",
            texto:
              ev.detalle === "respondida"
                ? "La volvieron a abrir (ya contestada)"
                : ev.detalle === "vencida"
                  ? "La abrieron ya vencida"
                  : ev.detalle === "cancelada"
                    ? "La abrieron ya cancelada"
                    : "La volvieron a abrir",
          });
          break;
        case "empezada":
          pasos.push({ cuando: ev.creado_en, texto: "Empezó a contestar" });
          break;
        case "enviada": {
          const motivos = motivosTexto(ev.detalle);
          motivosVistos = new Set((ev.detalle || "").split(",").filter(Boolean));
          const tiempo = abierta ? ` (${duracion(seg(abierta.creado_en, ev.creado_en))})` : "";
          pasos.push({ cuando: ev.creado_en, texto: motivos.length ? `Enviada · ${motivos.join(" · ")}` : `Enviada · válida${tiempo}` });
          break;
        }
        case "tarde":
          pasos.push({
            cuando: ev.creado_en,
            tono: "no",
            texto: `Intentó enviarla ${ev.detalle === "respondida" ? "otra vez (ya contestada)" : ev.detalle === "cancelada" ? "ya cancelada" : "ya vencida"}`,
          });
          break;
        case "cancelada":
          pasos.push({ cuando: ev.creado_en, tono: "no", texto: "La canceló el mesero" });
          break;
        case "aprobada":
          pasos.push({ cuando: ev.creado_en, texto: "La aprobaste" });
          break;
        case "descartada":
          pasos.push({ cuando: ev.creado_en, tono: "no", texto: "La descartaste" });
          break;
        case "marcada": {
          const nuevos = (ev.detalle || "").split(",").filter((x) => x && !motivosVistos.has(x));
          nuevos.forEach((x) => motivosVistos.add(x));
          if (nuevos.length) pasos.push({ cuando: ev.creado_en, tono: "no", texto: `Marcada: ${nuevos.map((x) => MOTIVOS[x] || x).join(" · ")}` });
          break;
        }
      }
    }
    if (!tiene("generada")) pasos.unshift({ cuando: e.creado_en, texto: "Generada" });
    if (vencida) {
      const paso = { cuando: e.vence_en, tono: "no" as const, texto: final === "medias" ? "Venció sin enviarse" : "Venció sin abrirse" };
      const i = pasos.findIndex((p) => p.cuando > e.vence_en);
      if (i < 0) pasos.push(paso);
      else pasos.splice(i, 0, paso);
    }
    r.bitacora.push({
      clave: e.id,
      meseroClave: m.clave,
      meseroNombre: e.mesero_nombre,
      total: e.total,
      mesa: e.mesa,
      cuando: e.creado_en,
      final,
      pasos,
    });
  }

  for (const ev of eventos) {
    if (ev.tipo !== "fallida") continue;
    const m = mesero(claveMesero(ev.mesero_id, ev.mesero_nombre), ev.mesero_nombre || "Sin nombre");
    const motivo = ev.detalle || "otro";
    m.fallidas++;
    m.porMotivo[motivo] = (m.porMotivo[motivo] || 0) + 1;
    r.fallidas++;
    r.bitacora.push({
      clave: `f${ev.id}`,
      meseroClave: m.clave,
      meseroNombre: m.nombre,
      cuando: ev.creado_en,
      final: "fallida",
      pasos: [{ cuando: ev.creado_en, tono: "no", texto: `Intentó generar: ${MOTIVOS_INTENTO[motivo] || motivo}` }],
    });
  }

  r.tardaAbrir = mediana(tAbrir);
  r.tardaContestar = mediana(tContestar);
  r.meseros = [...meseros.values()].sort((a, b) => b.genero - a.genero || b.fallidas - a.fallidas || a.nombre.localeCompare(b.nombre));
  r.bitacora.sort((a, b) => b.cuando.localeCompare(a.cuando));
  return r;
}
