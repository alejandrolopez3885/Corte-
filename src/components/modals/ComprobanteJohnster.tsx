import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { money } from "../../lib/dataModel";
import { supabase } from "../../lib/supabaseClient";

// "Ver comprobante": la foto de un comprobante tal como está en Johnster Bot
// (la trae la función johnster con { accion: "comprobante" }): el ticket de
// un gasto (id) o el comprobante bancario de tarjetas de un día (fecha).
// Se guarda en memoria mientras la app está abierta.
export type PedidoComprobante = { id: string; fecha?: undefined } | { fecha: string; id?: undefined };
export interface Comprobante {
  pedido: PedidoComprobante;
  titulo: string;
  monto: number;
  drive?: string | null; // el bancario también se puede abrir en Drive
}
const fotos = new Map<string, string>();

export function VerComprobante({ pedido, titulo, monto, drive, onClose }: Comprobante & { onClose: () => void }) {
  const clave = pedido.id ? `g:${pedido.id}` : `b:${pedido.fecha}`;
  const [url, setUrl] = useState<string | null>(fotos.get(clave) || null);
  const [error, setError] = useState<string | null>(null);
  async function traer() {
    setError(null);
    const { data, error: e } = await supabase.functions.invoke("johnster", { body: { accion: "comprobante", ...pedido } });
    if (e || !(data instanceof Blob)) {
      const ctx = (e as { context?: Response } | null)?.context;
      setError((ctx && (await ctx.json().catch(() => null))?.error) || "No se pudo traer el comprobante del bot.");
      return;
    }
    const u = URL.createObjectURL(new Blob([data], { type: "image/jpeg" }));
    fotos.set(clave, u);
    setUrl(u);
  }
  useEffect(() => {
    if (!url) traer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onClose]);
  // Directo en <body>: dentro de una hoja o del asistente (con scroll o
  // animación) el visor quedaba recortado y a veces sin el botón de cerrar.
  return createPortal(
    <div className="vc-fondo" onClick={onClose}>
      <div className="vc-head" onClick={(e) => e.stopPropagation()}>
        <span>
          {titulo}
          <small>
            {money(monto)} · comprobante en Johnster
            {drive && (
              <>
                {" · "}
                <a href={drive} target="_blank" rel="noreferrer">
                  Abrir en Drive <ExternalLink size={12} />
                </a>
              </>
            )}
          </small>
        </span>
        <button className="vc-cerrar" onClick={onClose} aria-label="Cerrar">
          <X size={22} />
        </button>
      </div>
      <div className="vc-foto" onClick={(e) => e.stopPropagation()}>
        {url ? (
          <img src={url} alt={`Comprobante: ${titulo}`} />
        ) : error ? (
          <div className="vc-msg">
            {error}
            <button className="btn-primary" onClick={traer}>
              Intentar de nuevo ↻
            </button>
          </div>
        ) : (
          <div className="vc-msg">Trayendo el comprobante del bot…</div>
        )}
      </div>
    </div>,
    document.body
  );
}
