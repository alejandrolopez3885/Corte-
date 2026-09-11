import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export const PIN_LENGTH = 4;
const EMAIL_DOMAIN = "cortes.local";

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
}): Promise<{ id: string }> {
  const { displayName, pin, ownerId } = options;
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
