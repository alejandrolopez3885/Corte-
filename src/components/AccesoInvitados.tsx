import { useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Field } from "./ui";
import { supabase } from "../lib/supabaseClient";
import { createStaffAccount, errorMessage, revokeStaffAccess, PIN_LENGTH } from "../lib/staffAccounts";

// Acceso de invitado (Equipo > Personal, solo dueño): alguien que ve todo
// el negocio con números reales, sin poder cambiar nada, con un recorrido
// guiado. Vence solo. Aquí se crea, se prueba el recorrido, se ve su último
// uso y su opinión, y se le quita el acceso.
interface Invitado {
  id: string;
  display_name: string | null;
  invitado_hasta: string;
}
interface Opinion {
  id: number;
  profile_id: string | null;
  nombre: string;
  estrellas: number;
  gusto: string[];
  sucursales: string | null;
  mejoras: string | null;
  creado_en: string;
}
interface Uso {
  actor_id: string;
  seccion: string | null;
  creado_en: string;
}

const DIAS = [3, 7, 14, 30];
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }).replace(".", "");
const cuando = (iso: string) => new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(".", "");
const estrellasTexto = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export function AccesoInvitados({ ownerId, onProbar }: { ownerId: string; onProbar: () => void }) {
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [opiniones, setOpiniones] = useState<Opinion[]>([]);
  const [usos, setUsos] = useState<Uso[]>([]);
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [dias, setDias] = useState(7);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<Invitado | null>(null);
  const [ahora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, display_name, invitado_hasta").eq("owner_id", ownerId).not("invitado_hasta", "is", null);
    const lista = (data as Invitado[]) || [];
    setInvitados(lista.sort((a, b) => b.invitado_hasta.localeCompare(a.invitado_hasta)));
    const { data: ops } = await supabase.from("invitado_opiniones").select("*").order("creado_en", { ascending: false });
    setOpiniones((ops as Opinion[]) || []);
    if (lista.length) {
      const { data: us } = await supabase
        .from("bitacora")
        .select("actor_id, seccion, creado_en")
        .in("actor_id", lista.map((x) => x.id))
        .order("creado_en", { ascending: false })
        .limit(300);
      setUsos((us as Uso[]) || []);
    }
  }, [ownerId]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear() {
    setAviso(null);
    if (!nombre.trim()) return setAviso("Escribe su nombre.");
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return setAviso(`El PIN debe tener ${PIN_LENGTH} números.`);
    setOcupado(true);
    try {
      const hasta = new Date();
      hasta.setDate(hasta.getDate() + dias);
      hasta.setHours(23, 59, 0, 0);
      await createStaffAccount({ displayName: nombre.trim(), pin, ownerId, invitadoHasta: hasta.toISOString() });
      setAviso(`Listo: ${nombre.trim()} entra con su nombre y el PIN ${pin} hasta el ${fecha(hasta.toISOString())}.`);
      setNombre("");
      setPin("");
      cargar();
    } catch (e) {
      setAviso(errorMessage(e, "No se pudo crear el acceso."));
    }
    setOcupado(false);
  }

  async function quitar(inv: Invitado) {
    setOcupado(true);
    try {
      await revokeStaffAccess(inv.id);
      setAviso(`Se quitó el acceso de ${inv.display_name || "invitado"}.`);
      cargar();
    } catch (e) {
      setAviso(errorMessage(e, "No se pudo quitar el acceso."));
    }
    setQuitando(null);
    setOcupado(false);
  }

  return (
    <div className="invitados">
      <div className="invitados-tarjeta">
        <h4>Acceso de invitado</h4>
        <p className="hint">Ve todo con números reales, sin poder cambiar nada, con un recorrido guiado. Vence solo.</p>
        <button type="button" className="invitados-probar" onClick={onProbar}>
          <Play size={15} /> Probar el recorrido como lo verá
        </button>
        <Field label="Nombre">
          <input className="text-input" value={nombre} maxLength={60} placeholder="Ej. Lic. Pérez" onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <Field label="PIN">
          <input
            className="text-input"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            value={pin}
            placeholder="4 números"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Vence">
          <select className="text-input" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {DIAS.map((d) => (
              <option key={d} value={d}>
                en {d} días
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className="btn-primary" disabled={ocupado} onClick={crear}>
          {ocupado ? "Creando…" : "Crear acceso"}
        </button>
        {aviso && <p className="puntos-aviso">{aviso}</p>}
      </div>

      {invitados.map((inv) => {
        const vence = new Date(inv.invitado_hasta).getTime();
        const vencido = vence < ahora;
        const diasRestan = Math.ceil((vence - ahora) / 86400000);
        const suyos = usos.filter((u) => u.actor_id === inv.id);
        const vio = [...new Set(suyos.map((u) => u.seccion).filter((x): x is string => !!x))].slice(0, 6);
        const ops = opiniones.filter((o) => o.profile_id === inv.id);
        return (
          <div key={inv.id} className="invitados-tarjeta">
            <h4>
              {inv.display_name || "Invitado"} · {vencido ? "venció" : `vence en ${diasRestan} ${diasRestan === 1 ? "día" : "días"}`}
            </h4>
            <span className="hint">
              {suyos.length ? `Último uso: ${cuando(suyos[0].creado_en)}${vio.length ? ` · vio ${vio.join(", ")}` : ""}` : "Todavía no ha entrado."}
            </span>
            {ops.map((o) => (
              <div key={o.id} className="invitados-opinion">
                <b>
                  Su opinión · <span className="encuesta-estrellas">{estrellasTexto(o.estrellas)}</span>
                </b>
                {o.gusto.length > 0 && <span>Le gustó: {o.gusto.join(", ")}</span>}
                {o.sucursales && (
                  <span>
                    ¿Otras sucursales? <b>{o.sucursales === "si" ? "Sí" : o.sucursales === "tal vez" ? "Tal vez" : "No"}</b>
                  </span>
                )}
                {o.mejoras && <em>“{o.mejoras}”</em>}
                <small>{cuando(o.creado_en)}</small>
              </div>
            ))}
            {quitando?.id === inv.id ? (
              <div className="invitados-confirmar">
                <span>¿Quitarle el acceso? Ya no podrá entrar.</span>
                <button type="button" className="btn-warn" disabled={ocupado} onClick={() => quitar(inv)}>
                  Sí, quitar acceso
                </button>
                <button type="button" className="link-btn" onClick={() => setQuitando(null)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" className="btn-secundario" onClick={() => setQuitando(inv)}>
                Quitar acceso
              </button>
            )}
          </div>
        );
      })}
      {opiniones.some((o) => !invitados.some((i) => i.id === o.profile_id)) && (
        <div className="invitados-tarjeta">
          <h4>Opiniones de accesos anteriores</h4>
          {opiniones
            .filter((o) => !invitados.some((i) => i.id === o.profile_id))
            .map((o) => (
              <div key={o.id} className="invitados-opinion">
                <b>
                  {o.nombre} · <span className="encuesta-estrellas">{estrellasTexto(o.estrellas)}</span>
                </b>
                {o.gusto.length > 0 && <span>Le gustó: {o.gusto.join(", ")}</span>}
                {o.mejoras && <em>“{o.mejoras}”</em>}
                <small>{cuando(o.creado_en)}</small>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
