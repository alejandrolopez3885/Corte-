import { useEffect } from "react";
import { supabase } from "./supabaseClient";
import { dateForDay, formatAssignedDate, money } from "./dataModel";
import { DAY_SHORT, GASTO_CATEGORIAS } from "./types";
import type { AppData, DayName, MonthData, Profile } from "./types";

// Bitácora (Negocio > Análisis > Historial de cambios): quién cambió qué y
// cuándo en toda la app, más los inicios y cierres de sesión. Vive en su
// propia tabla de Supabase (supabase/migration_007_bitacora.sql) en la que
// solo se pueden agregar renglones — nadie la puede editar ni borrar desde
// la app, a diferencia de app_data, que cualquier cuenta del negocio
// reescribe completa en cada guardado.

export interface CambioBitacora {
  accion: "cambió" | "agregó" | "eliminó";
  // Al agregar/eliminar algo con varios montos (ej. el corte de un mesero),
  // cada uno con su valor.
  campos?: { campo: string; valor: string }[];
  campo?: string;
  antes?: string;
  despues?: string;
  texto?: string; // descripción de lo que se agregó/eliminó
}

export interface RenglonBitacora {
  id: number;
  owner_id: string;
  actor_id: string;
  actor_nombre: string | null;
  tipo: "cambio" | "login" | "logout" | "vista";
  seccion: string | null;
  donde: string | null;
  detalle: CambioBitacora[] | null;
  ref_fecha?: string | null;
  creado_en: string;
}

interface Grupo {
  seccion: string;
  donde: string;
  fecha?: string; // fecha del corte/día al que se refiere
  cambios: CambioBitacora[];
}

type Json = unknown;
interface Hoja {
  path: string[];
  tipo: "agregó" | "eliminó" | "cambió";
  antes?: Json;
  despues?: Json;
}

const esObjeto = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const tieneIds = (v: Json): v is { id: string }[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => esObjeto(x) && typeof x.id === "string");

// Compara dos valores y junta los cambios en "hojas": un campo que cambió,
// o un elemento entero que se agregó o eliminó (listas con id se comparan
// por id, para que reordenar no cuente como cambio).
function comparar(a: Json, b: Json, path: string[], out: Hoja[]) {
  if (a === b) return;
  if (a === undefined || a === null) {
    if (b !== undefined && b !== null) out.push({ path, tipo: "agregó", despues: b });
    return;
  }
  if (b === undefined || b === null) {
    out.push({ path, tipo: "eliminó", antes: a });
    return;
  }
  if ((tieneIds(a) || (Array.isArray(a) && a.length === 0)) && (tieneIds(b) || (Array.isArray(b) && b.length === 0))) {
    const mapaA = new Map((a as { id: string }[]).map((x) => [x.id, x]));
    const mapaB = new Map((b as { id: string }[]).map((x) => [x.id, x]));
    mapaA.forEach((x, id) => comparar(x, mapaB.get(id), [...path, id], out));
    mapaB.forEach((x, id) => {
      if (!mapaA.has(id)) comparar(undefined, x, [...path, id], out);
    });
    return;
  }
  if (esObjeto(a) && esObjeto(b)) {
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => comparar(a[k], b[k], [...path, k], out));
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    // Listas de objetos sin id (ej. las 4 semanas de un mes): por posición.
    if ([...a, ...b].some((x) => typeof x === "object" && x !== null)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) comparar(a[i], b[i], [...path, String(i)], out);
      return;
    }
  }
  out.push({ path, tipo: "cambió", antes: a, despues: b });
}

const CAMPOS: Record<string, string> = {
  tarjetasDesglose: "Montos de tarjetas", transferenciaDesglose: "Montos de transferencia", desglose: "Montos",
  ventaAppsDesglose: "Montos de ventas de apps",
  venta: "Venta", tarjetas: "Tarjetas", transferencia: "Transferencia", propina: "Propina", propinaTipo: "Tipo de propina",
  gastosTotal: "Gastos", total: "Total", concepto: "Concepto", estado: "Estado", categoria: "Categoría",
  persona: "Persona", nombre: "Nombre", precio: "Precio", unidad: "Unidad", proveedorId: "Proveedor",
  altaRotacion: "Alta rotación", unidadPedido: "Se pide por", equivalenciaPedido: "Equivalencia de pedido",
  apodos: "Apodos", incluyeJueves: "Se pide los jueves", efectivoReal: "Efectivo real", ventaApps: "Venta de apps",
  asignadoA: "Asignado a", monto: "Monto", operativos: "Gastos operativos", fijos: "Gastos fijos",
  comisionDidi: "Comisión DIDI", comisionUber: "Comisión UBER", comisionRappi: "Comisión RAPPI",
  sueldoDiario: "Sueldo diario", puestoId: "Puesto", areaId: "Área", numero: "Número", fecha: "Fecha",
  tipo: "Tipo", empleadoId: "Empleado", meseroId: "Mesero", label: "Nombre del mes",
};
const CAMPOS_DINERO = new Set([
  "venta", "tarjetas", "transferencia", "propina", "gastosTotal", "total", "precio", "efectivoReal", "ventaApps",
  "monto", "operativos", "fijos", "comisionDidi", "comisionUber", "comisionRappi", "sueldoDiario",
]);

const fmtNum = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

function textoValor(v: Json, campo?: string): string {
  if (v === undefined || v === null || v === "") return "—";
  // Montos sueltos que se sumaron: "300 + 450 + 750".
  if (campo && /desglose$/i.test(campo) && Array.isArray(v)) return v.map((n) => fmtNum(Number(n))).join(" + ");
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return campo && CAMPOS_DINERO.has(campo) ? money(v) : String(v);
  if (typeof v === "string") return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  if (Array.isArray(v) && v.every((x) => typeof x !== "object")) return v.join(", ");
  if (esObjeto(v) && typeof v.nombre === "string") return v.nombre;
  const s = JSON.stringify(v);
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

// "Gasto “Hielo” $85", "Mesero Juan", "Insumo Pollo"…
const PROPINA_TIPO: Record<string, string> = { p3: "3%", p2: "2%", manual: "Manual", none: "Sin propina" };

// Todos los montos de un elemento que se agregó/eliminó, para no perder
// nada: el corte de un mesero completo, una transferencia con sus montos
// sueltos, un gasto con su categoría.
function camposElemento(v: Json, tipoLista: string): { campo: string; valor: string }[] | undefined {
  if (!esObjeto(v)) return undefined;
  const conDesglose = (monto: Json, desglose: Json) =>
    `${textoValor(monto, "total")}${Array.isArray(desglose) && desglose.length > 1 ? ` (${textoValor(desglose, "desglose")})` : ""}`;
  if (tipoLista === "Mesero") {
    return [
      { campo: "Venta", valor: textoValor(v.venta, "venta") },
      { campo: "Tarjetas", valor: conDesglose(v.tarjetas, v.tarjetasDesglose) },
      { campo: "Transferencia", valor: conDesglose(v.transferencia, v.transferenciaDesglose) },
      {
        campo: "Propina",
        valor: `${PROPINA_TIPO[String(v.propinaTipo)] || (v.aplicaPropina ? "3%" : "—")} · ${textoValor(v.propina, "propina")}`,
      },
      { campo: "Gastos", valor: textoValor(v.gastosTotal, "gastosTotal") },
      { campo: "Entrega", valor: textoValor(v.total, "total") },
    ];
  }
  if (tipoLista === "Transferencia" && Array.isArray(v.desglose) && v.desglose.length > 1) {
    return [{ campo: "Montos", valor: textoValor(v.desglose, "desglose") }];
  }
  if (tipoLista === "Gasto" && typeof v.categoria === "string") {
    return [{ campo: "Categoría", valor: GASTO_CATEGORIAS.find((c) => c.value === v.categoria)?.label || v.categoria }];
  }
  return undefined;
}

function resumenElemento(v: Json, tipoLista: string): string {
  if (!esObjeto(v)) return textoValor(v);
  const nombre = (v.nombre ?? v.concepto ?? v.persona ?? v.numero) as string | undefined;
  const total = typeof v.total === "number" ? ` ${money(v.total)}` : typeof v.monto === "number" ? ` ${money(v.monto)}` : "";
  return `${tipoLista}${nombre ? ` “${nombre}”` : ""}${total}`.trim();
}

function fechaCorta(iso: string): string {
  return formatAssignedDate(iso);
}

const AREA: Record<string, string> = { cocina: "Cocina", bar: "Bar" };

// Traduce la ruta de un cambio a: en qué sección, dónde exactamente y
// cómo se llama el campo.
function ubicar(h: Hoja, prev: AppData, next: AppData): { seccion: string; donde: string; campo?: string; lista?: string; fecha?: string } {
  const p = h.path;
  const mes = (mk: string): MonthData | undefined => next.months?.[mk] ?? prev.months?.[mk];
  const buscar = (lista: string, id: string): Record<string, Json> | undefined =>
    ((next as unknown as Record<string, { id: string }[]>)[lista] || []).find((x) => x.id === id) as Record<string, Json> | undefined ||
    ((prev as unknown as Record<string, { id: string }[]>)[lista] || []).find((x) => x.id === id) as Record<string, Json> | undefined;

  switch (p[0]) {
    case "months": {
      const [, mk, , w, , day, lista, id, campo] = p;
      const m = mk ? mes(mk) : undefined;
      const etiquetaMes = m?.label || mk;
      if (p.length <= 2) return { seccion: "Corte", donde: `Corte · Mes ${etiquetaMes}`, lista: "Mes" };
      if (p[2] !== "weeks") return { seccion: "Corte", donde: `Corte · Mes ${etiquetaMes}`, campo: CAMPOS[p[2]] || p[2] };
      const semana = `Semana ${Number(w) + 1} (${etiquetaMes})`;
      if (p[4] !== "days" || !day) {
        return { seccion: "Corte", donde: `Corte · ${semana}`, campo: p.slice(4).map((k) => CAMPOS[k] || k).join(" · ") };
      }
      const fecha = m ? dateForDay(mk, Number(w), m, day as DayName) : "";
      const conFecha = <T extends object>(x: T) => ({ ...x, fecha: fecha || undefined });
      const base = `Corte ${DAY_SHORT[day as DayName] || day}${fecha ? ` ${fechaCorta(fecha).replace(/^[^ ]+ /, "")}` : ""}`;
      const dia = m?.weeks?.[Number(w)]?.days?.[day as DayName];
      const diaPrev = prev.months?.[mk]?.weeks?.[Number(w)]?.days?.[day as DayName];
      if (lista === "meseros") {
        const cut = (dia?.meseros || []).find((x) => x.id === id) || (diaPrev?.meseros || []).find((x) => x.id === id);
        const ETIQUETA_MESERO: Record<string, string> = { total: "Entrega", gastosTotal: "Gastos" };
        return conFecha({
          seccion: "Corte",
          donde: `${base} · Mesero ${cut?.nombre || ""}`.trim(),
          campo: campo ? ETIQUETA_MESERO[campo] || CAMPOS[campo] || campo : undefined,
          lista: "Mesero",
        });
      }
      if (lista === "gastos" || lista === "transferencias") {
        const items = [...(dia?.[lista] || []), ...(diaPrev?.[lista] || [])] as unknown as Record<string, Json>[];
        const item = items.find((x) => x.id === id);
        const nombreItem = (item?.concepto ?? item?.persona) as string | undefined;
        const etiqueta = lista === "gastos" ? "Gasto" : "Transferencia";
        return conFecha({
          seccion: "Corte",
          donde: `${base} · ${lista === "gastos" ? "Gastos" : "Transferencias"}`,
          campo: campo ? `${etiqueta}${nombreItem ? ` “${nombreItem}”` : ""} · ${CAMPOS[campo] || campo}` : undefined,
          lista: etiqueta,
        });
      }
      return conFecha({ seccion: "Corte", donde: base, campo: lista ? CAMPOS[lista] || lista : undefined });
    }
    case "conteosDiariosTexto":
      return { seccion: "Conteo diario", donde: `Conteo diario ${AREA[p[1]] || p[1]} · ${p[2] ? fechaCorta(p[2]) : ""}`, campo: "Conteo", fecha: p[2] };
    case "pedidosDiarios":
      return { seccion: "Conteo diario", donde: `Pedido diario ${AREA[p[1]] || p[1]} · ${p[2] ? fechaCorta(p[2]) : ""}`, campo: p[3], fecha: p[2] };
    case "inventariosNotas":
      return { seccion: "Inventario", donde: `Inventario · ${p[1] ? fechaCorta(p[1]) : ""}`, campo: "Notas", fecha: p[1] };
    case "pedidosInventario":
      return { seccion: "Inventario", donde: `Pedido de inventario · ${p[1] ? fechaCorta(p[1]) : ""}`, campo: p[2], fecha: p[1] };
    case "conteosDiarios":
      return { seccion: "Conteo diario", donde: `Conteo diario · ${p[1] ? fechaCorta(p[1]) : ""}`, campo: p[2] };
    case "insumos":
    case "proveedores":
    case "meseros":
    case "empleados":
    case "areas":
    case "puestos":
    case "facturas": {
      const nombres: Record<string, [string, string]> = {
        insumos: ["Catálogo", "Insumo"], proveedores: ["Proveedores", "Proveedor"], meseros: ["Equipo", "Mesero"],
        empleados: ["Equipo", "Empleado"], areas: ["Equipo", "Área"], puestos: ["Equipo", "Puesto"], facturas: ["Facturas", "Factura"],
      };
      const [seccion, etiqueta] = nombres[p[0]];
      const item = p[1] ? buscar(p[0], p[1]) : undefined;
      const nombre = (item?.nombre ?? item?.numero) as string | undefined;
      return {
        seccion,
        donde: p.length >= 3 ? `${etiqueta}${nombre ? ` “${nombre}”` : ""}` : seccion,
        campo: p[2] ? CAMPOS[p[2]] || p[2] : undefined,
        lista: etiqueta,
      };
    }
    case "horarios":
    case "nominaDescuentos": {
      const seccion = p[0] === "horarios" ? "Horarios" : "Nómina";
      const m = p[1] ? mes(p[1]) : undefined;
      const semana = p[3] !== undefined ? ` Semana ${Number(p[3]) + 1}` : "";
      return { seccion, donde: `${seccion}${semana} (${m?.label || p[1] || ""})`, campo: p.slice(4).map((k) => CAMPOS[k] || k).join(" · ") || undefined };
    }
    default:
      return { seccion: "Otros", donde: p[0] || "App", campo: p.slice(1).join(" · ") || undefined };
  }
}

// Texto largo (conteo/notas): solo los renglones que cambiaron.
function cambiosDeTexto(antes: string, despues: string, campo: string): CambioBitacora[] {
  const a = antes.split("\n").map((l) => l.trim()).filter(Boolean);
  const b = despues.split("\n").map((l) => l.trim()).filter(Boolean);
  const quitados = a.filter((l) => !b.includes(l));
  const nuevos = b.filter((l) => !a.includes(l));
  const out: CambioBitacora[] = [];
  const n = Math.max(quitados.length, nuevos.length);
  for (let i = 0; i < n; i++) {
    if (quitados[i] !== undefined && nuevos[i] !== undefined) out.push({ accion: "cambió", campo, antes: quitados[i], despues: nuevos[i] });
    else if (nuevos[i] !== undefined) out.push({ accion: "agregó", texto: `${campo}: ${nuevos[i]}` });
    else out.push({ accion: "eliminó", texto: `${campo}: ${quitados[i]}` });
  }
  return out;
}

export function describirCambios(prev: AppData, next: AppData): Grupo[] {
  const hojas: Hoja[] = [];
  comparar(prev, next, [], hojas);
  const grupos = new Map<string, Grupo>();
  hojas.forEach((h) => {
    const ultimo = h.path[h.path.length - 1];
    // "Hecho por" lo estampa la app sola en cada guardado del equipo; ya
    // queda el actor en la bitácora.
    if (ultimo === "hechoPor" || h.path.includes("hechoPor")) return;
    const u = ubicar(h, prev, next);
    const key = `${u.seccion}|${u.donde}`;
    if (!grupos.has(key)) grupos.set(key, { seccion: u.seccion, donde: u.donde, fecha: u.fecha, cambios: [] });
    const g = grupos.get(key)!;
    if (h.tipo === "cambió" && typeof h.antes === "string" && typeof h.despues === "string" && (h.antes.includes("\n") || h.despues.includes("\n"))) {
      g.cambios.push(...cambiosDeTexto(h.antes, h.despues, u.campo || "Texto"));
    } else if (h.tipo === "cambió") {
      g.cambios.push({ accion: "cambió", campo: u.campo, antes: textoValor(h.antes, ultimo), despues: textoValor(h.despues, ultimo) });
    } else {
      const valor = h.tipo === "agregó" ? h.despues : h.antes;
      const elemento = !!u.lista && esObjeto(valor);
      const texto = elemento
        ? u.lista === "Mesero"
          ? `Corte de ${(valor as Record<string, Json>).nombre ?? "mesero"}`
          : resumenElemento(valor, u.lista!)
        : `${u.campo ? `${u.campo}: ` : ""}${textoValor(valor, ultimo)}`;
      const campos = elemento ? camposElemento(valor, u.lista!) : undefined;
      g.cambios.push({ accion: h.tipo, texto, ...(campos ? { campos } : {}) });
    }
  });
  // Al editar el corte de un mesero, su transferencia se quita y se vuelve a
  // crear igual: un "eliminó" y un "agregó" idénticos no son un cambio real.
  grupos.forEach((g) => {
    const firma = (c: CambioBitacora) => JSON.stringify([c.texto, c.campos]);
    const quitados = g.cambios.filter((c) => c.accion === "eliminó").map(firma);
    const agregados = g.cambios.filter((c) => c.accion === "agregó").map(firma);
    const iguales = new Set(quitados.filter((f) => agregados.includes(f)));
    if (iguales.size > 0) g.cambios = g.cambios.filter((c) => c.accion === "cambió" || !iguales.has(firma(c)));
  });
  return [...grupos.values()].filter((g) => g.cambios.length > 0);
}

function ownerIdDe(profile: Profile): string {
  return profile.role === "owner" ? profile.id : (profile.owner_id as string);
}

function nombreDe(profile: Profile): string {
  return profile.display_name || (profile.role === "owner" ? "Dueño" : "Equipo");
}

export async function registrarCambios(profile: Profile, prev: AppData, next: AppData) {
  const grupos = describirCambios(prev, next);
  if (grupos.length === 0) return;
  const filas = grupos.map((g) => ({
    owner_id: ownerIdDe(profile),
    actor_id: profile.id,
    actor_nombre: nombreDe(profile),
    tipo: "cambio",
    seccion: g.seccion,
    donde: g.donde,
    detalle: g.cambios,
    ...(g.fecha ? { ref_fecha: g.fecha } : {}),
  }));
  let { error } = await supabase.from("bitacora").insert(filas);
  // Sin migration_008 todavía no existe ref_fecha: se guarda sin ella.
  if (error && /ref_fecha/.test(error.message)) {
    ({ error } = await supabase.from("bitacora").insert(filas.map(({ ref_fecha: _omit, ...resto }) => resto)));
  }
  if (error) console.error("No se pudo guardar en la bitácora", error);
}

async function insertarConSesion(fila: { tipo: RenglonBitacora["tipo"]; seccion?: string; donde?: string; detalle?: CambioBitacora[] }) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return;
  const { error } = await supabase.from("bitacora").insert({
    owner_id: ownerIdDe(profile as Profile),
    actor_id: userId,
    actor_nombre: nombreDe(profile as Profile),
    ...fila,
  });
  if (error) console.error("No se pudo guardar en la bitácora", error);
}

// Inicio/cierre de sesión — se llama justo después de entrar o antes de
// salir, con la sesión todavía activa.
export function registrarAcceso(tipo: "login" | "logout") {
  return insertarConSesion({ tipo });
}

// Cambios que no pasan por app_data (cuentas de equipo y sus permisos).
export function registrarEvento(seccion: string, donde: string, cambios: CambioBitacora[]) {
  return insertarConSesion({ tipo: "cambio", seccion, donde, detalle: cambios });
}

// Qué pantalla abrió cada quien (solo el nombre, nada de lo que vio). Se
// registra cada vez que cambia de pantalla.
export function useRegistrarVista(profile: Profile | null, pantalla: string | null) {
  useEffect(() => {
    if (!profile || !pantalla) return;
    supabase
      .from("bitacora")
      .insert({ owner_id: ownerIdDe(profile), actor_id: profile.id, actor_nombre: nombreDe(profile), tipo: "vista", seccion: pantalla })
      .then(({ error }) => {
        // Si todavía no se corre migration_008, 'vista' no está permitido — se ignora.
        if (error && error.code !== "23514") console.error("No se pudo registrar la pantalla", error);
      });
  }, [profile, pantalla]);
}

// Todo lo registrado sobre un día del corte (por su fecha), para "Historial
// de este día" dentro del Corte.
export async function cargarBitacoraDelDia(ownerId: string, fecha: string) {
  return supabase
    .from("bitacora")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("ref_fecha", fecha)
    .eq("seccion", "Corte")
    .order("creado_en", { ascending: false });
}

export async function contarBitacoraDelDia(ownerId: string, fecha: string) {
  const { count } = await supabase
    .from("bitacora")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("ref_fecha", fecha)
    .eq("seccion", "Corte");
  return count || 0;
}

export async function cargarBitacora(ownerId: string, desdeIso: string, hastaIso: string) {
  return supabase
    .from("bitacora")
    .select("*")
    .eq("owner_id", ownerId)
    .gte("creado_en", desdeIso)
    .lt("creado_en", hastaIso)
    .order("creado_en", { ascending: false })
    .limit(10000);
}
