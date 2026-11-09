import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Si se publicó una versión nueva mientras la app estaba abierta (en el
// iPad la app se queda viva aunque se cierre), avisa con un botón para
// cargarla. Revisa al volver a la app y cada 5 minutos. Lo que se esté
// contando en Inventario queda como borrador, así que actualizar no lo pierde.
function scriptActual(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  return s ? new URL(s.src).pathname : null;
}

export function AvisoVersion() {
  const [hayNueva, setHayNueva] = useState(false);
  useEffect(() => {
    const actual = scriptActual();
    if (!import.meta.env.PROD || !actual) return;
    let cancelado = false;
    const revisar = async () => {
      try {
        const html = await (await fetch("/", { cache: "no-store" })).text();
        const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
        if (!cancelado && m && new URL(m[1], location.href).pathname !== actual) setHayNueva(true);
      } catch {
        // sin conexión: se revisa la próxima vez
      }
    };
    const alVolver = () => document.visibilityState === "visible" && revisar();
    document.addEventListener("visibilitychange", alVolver);
    const t = window.setInterval(revisar, 5 * 60 * 1000);
    revisar();
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alVolver);
      window.clearInterval(t);
    };
  }, []);
  if (!hayNueva) return null;
  return (
    <div className="aviso-version" role="status">
      <span>Hay una versión nueva</span>
      <button type="button" onClick={() => location.reload()}>
        <RefreshCw size={16} aria-hidden /> Actualizar
      </button>
    </div>
  );
}
