import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { registrarEvento } from "./bitacora";

// Datos para el pago de nómina: viven en su propia tabla (datos_pago, ver
// supabase/migration_009_datos_pago.sql), que solo pueden leer la persona y
// su dueño. Solo la persona los guarda.

export interface DatosPago {
  profile_id: string;
  owner_id: string;
  empleado_id: string | null;
  banco: string;
  numero: string; // 16 dígitos (tarjeta) o 18 (CLABE), sin espacios
  titular: string;
  confirmado_en: string;
}

export const BANCOS = [
  "BBVA", "Banorte", "Santander", "Banamex", "HSBC", "Scotiabank", "Banco Azteca", "BanCoppel", "Inbursa", "Banregio",
  "BanBajío", "Afirme", "Nu", "Mercado Pago", "Spin by OXXO", "Hey Banco", "Klar", "Stori", "Otro",
];

export const soloDigitos = (t: string) => t.replace(/\D/g, "");

// "4152313800124321" → "4152 3138 0012 4321"; CLABE de 4 en 4 también.
export const conEspacios = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");
export const tapado = (n: string) => `•••• ${n.slice(-4)}`;
export const tipoNumero = (n: string) => (n.length === 18 ? "CLABE" : "Tarjeta");

// Tarjeta: algoritmo de Luhn. CLABE: dígito de control (pesos 3, 7, 1).
function luhn(n: string): boolean {
  let suma = 0;
  [...n].reverse().forEach((c, i) => {
    let d = Number(c);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  });
  return suma % 10 === 0;
}
function clabeValida(n: string): boolean {
  const pesos = [3, 7, 1];
  const suma = [...n.slice(0, 17)].reduce((s, c, i) => s + ((Number(c) * pesos[i % 3]) % 10), 0);
  return (10 - (suma % 10)) % 10 === Number(n[17]);
}

// null = está bien; si no, qué le falta.
export function revisarNumero(texto: string): string | null {
  const n = soloDigitos(texto);
  if (!n) return "Escribe tu número de tarjeta o tu CLABE.";
  if (n.length < 16) return `Faltan dígitos: llevas ${n.length} (tarjeta: 16, CLABE: 18).`;
  if (n.length === 17) return "Sobra o falta un dígito: la tarjeta lleva 16 y la CLABE 18.";
  if (n.length > 18) return `Sobran dígitos: llevas ${n.length} (tarjeta: 16, CLABE: 18).`;
  if (n.length === 16 && !luhn(n)) return "Ese número de tarjeta no es válido: revisa que esté bien escrito.";
  if (n.length === 18 && !clabeValida(n)) return "Esa CLABE no es válida: revisa que esté bien escrita.";
  return null;
}

// Si la tabla todavía no existe (falta correr la migración), Supabase
// responde con un error: la app avisa en vez de fallar.
export type EstadoDatosPago = "cargando" | "listo" | "sin-tabla";

// La persona: sus propios datos.
export function useMisDatosPago(profileId: string) {
  const [datos, setDatos] = useState<DatosPago | null>(null);
  const [estado, setEstado] = useState<EstadoDatosPago>("cargando");
  useEffect(() => {
    let vivo = true;
    supabase
      .from("datos_pago")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) {
          console.error("No se pudieron leer los datos de pago", error);
          setEstado("sin-tabla");
          return;
        }
        setDatos((data as DatosPago) || null);
        setEstado("listo");
      });
    return () => {
      vivo = false;
    };
  }, [profileId]);
  return { datos, setDatos, estado };
}

export async function guardarMisDatosPago(
  profile: { id: string; owner_id: string | null; empleado_id?: string | null },
  anteriores: DatosPago | null,
  nuevos: { banco: string; numero: string; titular: string }
): Promise<{ datos?: DatosPago; error?: string }> {
  if (!profile.owner_id) return { error: "Tu cuenta no está ligada a un dueño." };
  const fila = {
    profile_id: profile.id,
    owner_id: profile.owner_id,
    empleado_id: profile.empleado_id || null,
    banco: nuevos.banco,
    numero: soloDigitos(nuevos.numero),
    titular: nuevos.titular.trim(),
    confirmado_en: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("datos_pago").upsert(fila).select().single();
  if (error) {
    console.error("No se pudieron guardar los datos de pago", error);
    return { error: "No se pudieron guardar. Revisa tu conexión e intenta de nuevo." };
  }
  // En Actividad, sin el número completo.
  const desc = (d: { banco: string; numero: string; titular: string }) => `${d.banco} · ${tipoNumero(d.numero)} ${tapado(d.numero)} · ${d.titular}`;
  registrarEvento("Mi perfil", "Datos de pago", [
    anteriores
      ? { accion: "cambió", campo: "Datos de pago", antes: desc(anteriores), despues: desc(fila) }
      : { accion: "agregó", texto: `Datos de pago: ${desc(fila)}` },
  ]);
  return { datos: data as DatosPago };
}

// El dueño: los de todo su equipo, por profile_id.
export function useDatosPagoEquipo(ownerId: string | null) {
  const [porPerfil, setPorPerfil] = useState<Map<string, DatosPago>>(new Map());
  const [estado, setEstado] = useState<EstadoDatosPago>("cargando");
  useEffect(() => {
    if (!ownerId) return;
    let vivo = true;
    supabase
      .from("datos_pago")
      .select("*")
      .eq("owner_id", ownerId)
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) {
          console.error("No se pudieron leer los datos de pago del equipo", error);
          setEstado("sin-tabla");
          return;
        }
        setPorPerfil(new Map(((data as DatosPago[]) || []).map((d) => [d.profile_id, d])));
        setEstado("listo");
      });
    return () => {
      vivo = false;
    };
  }, [ownerId]);
  return { porPerfil, estado };
}
