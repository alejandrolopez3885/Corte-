import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

// Modo solo lectura (invitado o la prueba del dueño): todo se ve, pero los
// botones que guardan, borran o cambian algo quedan deshabilitados con 🔒
// (siguen a la vista, para que se sepa que existen). Además la app no
// guarda nada (useAppData) y la base rechaza cualquier escritura del
// invitado.
export const ACCIONES =
  ".btn-primary, .btn-warn, .btn-danger, .btn-secundario, button[type=submit], .icon-btn.danger, .encuesta-resp-acciones button, .encuesta-prueba-btn, .puntos-fila, .add-btn, .fab-add";
// Lo que sí se puede tocar aunque tenga esas clases: navegar y cerrar.
const PERMITIDOS = /^(cerrar|cancelar|regresar|volver|ver\b.*|salir|siguiente.*|anterior.*|saltar|empezar.*|explorar.*|‹.*)$/i;

function bloqueado(el: Element | null): HTMLElement | null {
  const accion = el?.closest(ACCIONES) as HTMLElement | null;
  if (!accion || accion.closest(".recorrido-ui")) return null;
  if (PERMITIDOS.test((accion.textContent || "").trim())) return null;
  return accion;
}

export function SoloLecturaGuard() {
  const [aviso, setAviso] = useState(false);
  useEffect(() => {
    document.body.classList.add("solo-lectura");
    const parar = (e: Event) => {
      if (!bloqueado(e.target as Element)) return;
      e.preventDefault();
      e.stopPropagation();
      setAviso(true);
    };
    // Marca los botones bloqueados (para el 🔒) conforme van apareciendo.
    const marcar = () =>
      document.querySelectorAll(ACCIONES).forEach((el) => {
        if (bloqueado(el)) el.setAttribute("data-bloqueado", "");
        else el.removeAttribute("data-bloqueado");
      });
    marcar();
    const obs = new MutationObserver(marcar);
    obs.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", parar, true);
    document.addEventListener("submit", parar, true);
    return () => {
      document.body.classList.remove("solo-lectura");
      document.removeEventListener("click", parar, true);
      document.removeEventListener("submit", parar, true);
      obs.disconnect();
      document.querySelectorAll("[data-bloqueado]").forEach((el) => el.removeAttribute("data-bloqueado"));
    };
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(false), 2200);
    return () => clearTimeout(t);
  }, [aviso]);
  return aviso ? <div className="solo-lectura-aviso">🔒 Solo lectura: aquí se puede ver todo, pero no se guarda nada.</div> : null;
}

// La franja de arriba: invitado o prueba del dueño.
export function SoloLecturaBarra({ prueba, onRecorrido, onSalir }: { prueba: boolean; onRecorrido: () => void; onSalir?: () => void }) {
  return (
    <div className={`solo-lectura-barra recorrido-ui ${prueba ? "prueba" : ""}`}>
      <span>
        <Eye size={15} /> {prueba ? "Vista de invitado (prueba)" : "Solo lectura · puedes ver todo, no se guarda nada"}
      </span>
      <span className="solo-lectura-botones">
        <button type="button" onClick={onRecorrido}>
          Ver recorrido
        </button>
        {prueba && onSalir && (
          <button type="button" className="salir" onClick={onSalir}>
            Salir
          </button>
        )}
      </span>
    </div>
  );
}
