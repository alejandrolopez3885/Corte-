import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { PermisoStaff } from "./types";

export const PIN_LENGTH = 4;
const EMAIL_DOMAIN = "cortes.local";

// Los errores de Supabase (Postgrest, Auth) no siempre son instancias de
// Error — muchos son objetos planos con .message. Sin esto, un catch que
// solo revisa `e instanceof Error` esconde el motivo real detrás de un
// mensaje genérico.
export function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// La cuenta del equipo se crea con signUp(), que en algunos casos hace que
// el cliente que lo llama adopte la sesión recién creada. Usamos un cliente
// aparte, sin persistir nada en localStorage, para que crear a alguien más
// nunca cierre la sesión del dueño en esta pestaña.
function createIsolatedAuthClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function pinPassword(pin: string): string {
  return `cortes-pin-${pin}`;
}

function randomLoginSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export interface StaffDirectoryEntry {
  id: string;
  display_name: string;
  login_slug: string;
}

export async function getStaffDirectory(): Promise<StaffDirectoryEntry[]> {
  const { data, error } = await supabase
    .from("staff_login_directory")
    .select("id, display_name, login_slug")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as StaffDirectoryEntry[];
}

export async function signInWithPin(loginSlug: string, pin: string) {
  return supabase.auth.signInWithPassword({
    email: `${loginSlug}@${EMAIL_DOMAIN}`,
    password: pinPassword(pin),
  });
}

export async function createStaffAccount(options: {
  displayName: string;
  pin: string;
  ownerId: string;
  // Solo para cuentas dadas de alta desde Personal (jefe de cocina y
  // similares) — la cuenta de meseros en "Tu equipo" no usa esto.
  empleadoId?: string;
  permisos?: PermisoStaff[];
}): Promise<{ id: string }> {
  const { displayName, pin, ownerId, empleadoId, permisos } = options;
  if (!/^\d{4}$/.test(pin)) {
    throw new Error(`El PIN debe tener exactamente ${PIN_LENGTH} dígitos.`);
  }
  if (!displayName.trim()) {
    throw new Error("El nombre no puede estar vacío.");
  }

  const slug = randomLoginSlug();
  const isolated = createIsolatedAuthClient();
  const { data, error } = await isolated.auth.signUp({
    email: `${slug}@${EMAIL_DOMAIN}`,
    password: pinPassword(pin),
  });
  if (error) throw error;
  if (!data.user) throw new Error("No se pudo crear la cuenta.");

  const newId = data.user.id;

  const { error: profileError } = await supabase.from("profiles").insert({
    id: newId,
    role: "staff",
    display_name: displayName.trim(),
    owner_id: ownerId,
    empleado_id: empleadoId,
    permisos: permisos || [],
  });
  if (profileError) throw profileError;

  const { error: directoryError } = await supabase.from("staff_login_directory").insert({
    id: newId,
    display_name: displayName.trim(),
    login_slug: slug,
  });
  if (directoryError) throw directoryError;

  return { id: newId };
}

// Cambia qué secciones puede ver/usar una cuenta de equipo ya creada desde
// Personal — no cambia su PIN ni su nombre.
export async function updateStaffPermisos(profileId: string, permisos: PermisoStaff[]): Promise<void> {
  const { error } = await supabase.from("profiles").update({ permisos }).eq("id", profileId);
  if (error) throw error;
}

// Quita el acceso de una cuenta dada de alta desde Personal. Borra su fila
// de profiles (staff_login_directory se borra solo por el ON DELETE
// CASCADE) — así deja de aparecer en "¿Quién eres?" y nadie puede volver a
// entrar con ese PIN. No cambia el PIN (no se puede sin la clave de
// servicio de Supabase, que esta app no usa): si necesita volver a tener
// acceso, se da de alta de nuevo con un PIN nuevo.
export async function revokeStaffAccess(profileId: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", profileId);
  if (error) throw error;
}
