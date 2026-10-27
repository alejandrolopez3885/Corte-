import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { money } from "../../lib/dataModel";
import { supabase } from "../../lib/supabaseClient";

// "Ver comprobante": la foto del ticket de un gasto tal como está en
// Johnster Bot (la trae la función johnster con { accion: "comprobante" }).
// Se guarda en memoria mientras la app está abierta.
const fotos = new Map<string, string>();

export function VerComprobante({ id, concepto, monto, onClose }: { id: string; concepto: string; monto: number; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(fotos.get(id) || null);
  const [error, setError] = useState<string | null>(null);
  async function traer() {
    setError(null);
    const { data, error: e } = await supabase.functions.invoke("johnster", { body: { accion: "comprobante", id } });
    if (e || !(data instanceof Blob)) {
      const ctx = (e as { context?: Response } | null)?.context;
      setError((ctx && (await ctx.json().catch(() => null))?.error) || "No se pudo traer el comprobante del bot.");
      return;
    }
    const u = URL.createObjectURL(new Blob([data], { type: "image/jpeg" }));
    fotos.set(id, u);
    setUrl(u);
  }
  useEffect(() => {
    if (!url) traer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <div className="vc-fondo" onClick={onClose}>
      <div className="vc-head" onClick={(e) => e.stopPropagation()}>
        <span>
          {concepto}
          <small>{money(monto)} · comprobante en Johnster</small>
        </span>
        <button className="vc-cerrar" onClick={onClose} aria-label="Cerrar">
          <X size={22} />
        </button>
      </div>
      <div className="vc-foto" onClick={(e) => e.stopPropagation()}>
        {url ? (
          <img src={url} alt={`Comprobante de ${concepto}`} />
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
    </div>
  );
}

// El comprobante bancario vive en Google Drive: solo se abre el link (se ve
// si tu cuenta de Google tiene permiso para ese archivo).
export function LinkBancario({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <a className="vc-link" href={url} target="_blank" rel="noreferrer">
      Ver en Drive <ExternalLink size={13} />
    </a>
  );
}
