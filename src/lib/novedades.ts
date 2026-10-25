import { supabase } from "./supabaseClient";
import { insumoAreaForPuesto } from "./dataModel";
import { esDePiso } from "./ranking";
import { DAYS } from "./types";
import type { AppData, ConteoTextoArea, PermisoStaff, Profile } from "./types";

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

// "general" = de toda la app: le sale a cualquiera que ya entraba antes.
export type SeccionNovedad = "corte" | PermisoStaff | "general";

export type VisualNovedad = "sumar" | "autocompletar" | "categoria" | "faltan" | "guardarCorte" | "inventarioPasos" | "recetarioArea" | "apertura" | "cierreTotal" | "efectivoEntregar" | "conteoBar" | "pedidosPegar" | "preguntas" | "perfil" | "datosPago" | "logo" | "barraTitulo" | "ranking" | "encuesta" | "puntos";

export interface Novedad {
  id: string;
  fecha: string; // ISO con hora: cuándo se publicó el cambio
  seccion: SeccionNovedad;
  titulo: string;
  texto: string; // una o dos frases; **texto** se pinta en negritas
  visual: VisualNovedad;
  // Solo para quien cuenta en esa área (Conteo diario de Bar o de Cocina).
  soloArea?: ConteoTextoArea;
  // Solo para las cuentas del área Piso (ranking de meseros).
  soloPiso?: boolean;
  // Solo cuando ya se hizo la carga inicial de Monedas Anubis.
  trasCargaMonedas?: boolean;
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
  {
    id: "guardar-corte",
    fecha: "2026-10-20T07:30:00Z",
    seccion: "corte",
    titulo: "Termina tu corte con \"Guardar corte\"",
    texto: "Al final revisas y palomeas cada total. Ya guardado **no se puede editar**, y no deja guardar si un gasto sigue en Pendiente.",
    visual: "guardarCorte",
  },
  {
    id: "inventario-pasos",
    fecha: "2026-10-20T09:05:00Z",
    seccion: "inventario",
    titulo: "El inventario va en orden",
    texto: "Primero el **jueves** y, ya guardado, el **domingo**. Cada uno se captura desde su día.",
    visual: "inventarioPasos",
  },
  {
    id: "recetario-por-area",
    fecha: "2026-10-21T00:50:00Z",
    seccion: "recetario",
    titulo: "Tu recetario, solo de tu área",
    texto: "Cocina ve solo las recetas de **Cocina** y Barra solo las de **Bar**.",
    visual: "recetarioArea",
  },
  {
    id: "corte-apertura",
    // Cortes desde el miércoles 21 de octubre (medianoche en Monterrey).
    fecha: "2026-10-21T06:00:00Z",
    seccion: "corte",
    titulo: "Corte de apertura",
    texto: "Al cambio de turno toca **Corte de apertura**: apps, Johnster y quien abrió hasta ese momento, sin propina.",
    visual: "apertura",
  },
  {
    id: "cierre-total-del-dia",
    fecha: "2026-10-21T06:00:00Z",
    seccion: "corte",
    titulo: "Al cierre, el total del día",
    texto: "Para Johnster, quien abrió y las apps escribe el **total del día** del sistema. La app resta sola la apertura.",
    visual: "cierreTotal",
  },
  {
    id: "efectivo-a-entregar",
    fecha: "2026-10-21T06:00:00Z",
    seccion: "corte",
    titulo: "Cuánto efectivo entregar",
    texto: "En **Efectivo del día** ves lo que va en el sobre: sin lo de la apertura y con lo que se dejó el día anterior.",
    visual: "efectivoEntregar",
  },
  {
    id: "conteo-bar-lista",
    fecha: "2026-10-21T16:37:00Z",
    seccion: "conteo_diario",
    soloArea: "bar",
    titulo: "Lista nueva del conteo de Bar",
    texto: "El conteo diario de Bar ya trae la lista **fija** de refrescos y cervezas, en el orden en que se cuentan. Solo escribe la cantidad.",
    visual: "conteoBar",
  },
  {
    id: "pedidos-pegar",
    fecha: "2026-10-21T16:45:00Z",
    seccion: "pedidos",
    titulo: "Pega tus pedidos y la app los suma",
    texto: "Copia de WhatsApp los mensajes de pedidos de la semana y pégalos en **Pedidos**. La app suma cada producto por proveedor.",
    visual: "pedidosPegar",
  },
  {
    id: "preguntale-a-cortes",
    fecha: "2026-10-21T16:50:00Z",
    seccion: "general",
    titulo: "Pregúntale a Cortes",
    texto: "Toca el botón verde 💬 y pregunta de tus secciones: escribe y elige una de las sugerencias, o toca una pregunta.",
    visual: "preguntas",
  },
  {
    id: "mi-perfil",
    fecha: "2026-10-22T05:29:00Z",
    seccion: "general",
    titulo: "Tu perfil",
    texto: "Toca tu círculo de arriba (o **Mi perfil** en tu inicio) para poner tu foto y una descripción. Ahí también ves tu puesto.",
    visual: "perfil",
  },
  {
    id: "datos-pago",
    fecha: "2026-10-22T06:15:00Z",
    seccion: "general",
    titulo: "Datos para tu pago",
    texto: "En **Mi perfil** pon tu banco y tu número de tarjeta o CLABE para que te depositen tu nómina. Solo los ve el dueño.",
    visual: "datosPago",
  },
  {
    id: "logo-anubis",
    fecha: "2026-10-22T06:45:00Z",
    seccion: "general",
    titulo: "El logo de la app",
    texto: "Arriba a la izquierda ahora está el ícono de la app en lugar de la palabra Cortes. Todo lo demás sigue igual.",
    visual: "logo",
  },
  {
    id: "barra-titulo",
    fecha: "2026-10-22T07:10:00Z",
    seccion: "general",
    titulo: "Regresar, arriba junto al logo",
    texto: "El nombre de cada pantalla y la flecha **‹** para regresar ahora están en la barra de arriba, junto al logo.",
    visual: "barraTitulo",
  },
  {
    id: "ranking-meseros",
    fecha: "2026-10-22T07:55:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "Ranking de meseros",
    texto: "En tu inicio ves en qué lugar vas esta semana. La venta suma puntos y las **cancelaciones** restan.",
    visual: "ranking",
  },
  {
    id: "encuestas-qr",
    fecha: "2026-10-22T08:40:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "Encuestas para tus clientes",
    texto: "En tu inicio toca **Encuesta para el cliente**, escribe el total de la cuenta y muéstrale el QR. Su calificación sale como ⭐ en el ranking.",
    visual: "encuesta",
  },
  {
    id: "ver-mis-encuestas",
    fecha: "2026-10-23T01:48:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "Ve lo que te contestaron",
    texto: "En **Encuesta**, abajo, toca una de **Tus encuestas de esta semana** para verla tal cual la llenó el cliente, con su comentario.",
    visual: "encuesta",
  },
  {
    id: "puntos-logros",
    fecha: "2026-10-23T01:53:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "Puntos y logros",
    texto: "Cada semana del ranking suma **puntos** que se juntan en **Mi perfil** (se podrán canjear más adelante). Hay ganador cada semana y **logros** por rachas.",
    visual: "puntos",
  },
  {
    id: "encuesta-mesa-obligatoria",
    fecha: "2026-10-23T02:00:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "La mesa ya es obligatoria",
    texto: "Para generar el QR escribe el **total** y la **mesa**. El cliente empieza escribiendo el total de su ticket.",
    visual: "encuesta",
  },
  {
    id: "ranking-perfiles",
    fecha: "2026-10-23T02:41:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "Ve el perfil de tus compañeros",
    texto: "En el **Ranking**, toca a alguien para ver su perfil: su foto, su lugar, su ⭐ de encuestas y sus **logros**.",
    visual: "ranking",
  },
  {
    id: "monedas-anubis",
    fecha: "2026-10-23T02:55:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "Monedas Anubis",
    texto: "Lo que juntas cada semana ahora son **Monedas Anubis 🪙**, en **Mi perfil**; solo las ves tú. Los **puntos** son los del ranking.",
    visual: "puntos",
  },
  {
    id: "monedas-semanas-pasadas",
    fecha: "2026-10-23T21:59:00Z",
    seccion: "general",
    soloPiso: true,
    trasCargaMonedas: true,
    titulo: "Ya tienes monedas de semanas pasadas",
    texto: "Calculamos tus **Monedas Anubis** y **logros** desde la primera semana con cortes, como si esto hubiera existido desde entonces. Míralos en **Mi perfil**.",
    visual: "puntos",
  },
  {
    id: "ranking-turnos-encuestas",
    fecha: "2026-10-23T23:00:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "Nuevo ranking: por turno y con encuestas",
    texto: "El **Ranking general** suma venta **por turno** (doblar cuenta 2), cancelaciones y **encuestas contestadas**. Y hay un **Ranking de encuestas** con su propio premio.",
    visual: "ranking",
  },
  {
    id: "encuestas-al-corte",
    fecha: "2026-10-25T03:10:00Z",
    seccion: "general",
    soloPiso: true,
    titulo: "Tus encuestas suman con tu corte",
    texto: "Las encuestas de un día suman en el ranking **en cuanto se hace tu corte**. Antes salen como pendientes: no se pierden.",
    visual: "encuesta",
  },
  {
    id: "corte-paso-a-paso",
    fecha: "2026-10-25T03:40:00Z",
    seccion: "corte",
    titulo: "Corte de mesero paso a paso",
    texto: "Al tocar **+** en meseros, el corte va **una pregunta a la vez**: propina, venta, tarjetas, transferencias y **gastos con su categoría**. Al final ves **cuánto entrega** y el **cambio**.",
    visual: "guardarCorte",
  },
  {
    id: "gasto-transferencia-paso-a-paso",
    fecha: "2026-10-25T04:54:00Z",
    seccion: "corte",
    titulo: "Gastos y transferencias paso a paso",
    texto: "Al tocar **+** en Gastos o Transferencias primero pregunta **¿Se rebaja de algún corte?**: si es de un mesero, se descuenta de **lo que entrega**.",
    visual: "guardarCorte",
  },
  {
    id: "corte-por-pasos-y-turnos",
    fecha: "2026-10-25T05:34:00Z",
    seccion: "corte",
    titulo: "El corte ahora te dice qué sigue",
    texto: "Arriba ves el **siguiente paso** con su botón, y abajo las pestañas **Turno 1 · Apertura**, **Turno 2 · Cierre** y **Todo el día**. El **efectivo a entregar** siempre queda a la vista.",
    visual: "guardarCorte",
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

// Una novedad con fecha a futuro (un cambio que arranca después) todavía no
// se muestra.
const yaPublicada = (n: Novedad) => new Date(n.fecha).getTime() <= Date.now();

// Novedades que le tocan a esta persona ahora mismo, de la más vieja a la
// más nueva.
export async function novedadesPendientes(profile: Profile, data: AppData, tieneCorte: boolean): Promise<Novedad[]> {
  const estado = await leerEstado();
  // El dueño ve todas las novedades de todas las secciones (aunque él haya
  // pedido el cambio), una sola vez cada una.
  if (profile.role === "owner") {
    return NOVEDADES.filter((n) => yaPublicada(n) && !estado.vistas.includes(n.id)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  const secciones = seccionesConAcceso(profile, tieneCorte);
  const empleado = data.empleados.find((e) => e.id === profile.empleado_id);
  const puesto = empleado?.puestoId ? data.puestos.find((p) => p.id === empleado.puestoId) : undefined;
  const areaConteo = puesto ? insumoAreaForPuesto(puesto.nombre) : null;
  const corteHecho = tieneCorte ? ultimoCorteHecho(data, profile) : null;
  return NOVEDADES.filter((n) => {
    const general = n.seccion === "general";
    if (!yaPublicada(n) || (!general && !secciones.includes(n.seccion)) || estado.vistas.includes(n.id)) return false;
    if (n.soloArea && n.soloArea !== areaConteo) return false;
    if (n.soloPiso && !esDePiso(data, profile)) return false;
    if (n.trasCargaMonedas && !data.monedasCargaInicial) return false;
    const tiempos: number[] = [];
    const accesos = general ? Object.values(estado.ultimoAcceso) : [estado.ultimoAcceso[n.seccion]];
    accesos.forEach((acceso) => acceso && tiempos.push(new Date(acceso).getTime()));
    // El "Corte hecho por" solo dice el día del corte, no la hora en que se
    // capturó: se toma como del día anterior, para no perder novedades
    // publicadas ese mismo día.
    if ((n.seccion === "corte" || general) && corteHecho) tiempos.push(new Date(corteHecho).getTime() - 24 * 60 * 60 * 1000);
    if (tiempos.length === 0) return false;
    const ultimo = Math.max(...tiempos);
    // La de la carga de monedas cuenta desde que se hizo la carga.
    const publicada = n.trasCargaMonedas && data.monedasCargaInicial && data.monedasCargaInicial > n.fecha ? data.monedasCargaInicial : n.fecha;
    return ultimo < new Date(publicada).getTime();
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
