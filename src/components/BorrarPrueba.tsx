import { useState } from "react";
import { Trash2 } from "lucide-react";

// Botón de borrar encuestas de prueba (Encuestas del dueño), que antes de
// borrar pregunta "¿Seguro?" con "Sí, borrar" / "No".
export function BorrarPrueba({ texto, pregunta, onBorrar, centrado = false }: { texto: string; pregunta: string; onBorrar: () => Promise<boolean>; centrado?: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [fallo, setFallo] = useState(false);

  if (!confirmando)
    return (
      <button
        type="button"
        className={centrado ? "borrar-prueba-todas" : "borrar-prueba"}
        onClick={(e) => {
          e.stopPropagation();
          setFallo(false);
          setConfirmando(true);
        }}
      >
        <Trash2 size={14} /> {texto}
      </button>
    );
  return (
    <div className="borrar-prueba-confirmar" onClick={(e) => e.stopPropagation()}>
      <span>{fallo ? "No se pudo borrar. Revisa tu conexión." : pregunta}</span>
      <button
        type="button"
        className="si"
        disabled={borrando}
        onClick={async () => {
          setBorrando(true);
          const ok = await onBorrar();
          setBorrando(false);
          if (ok) setConfirmando(false);
          else setFallo(true);
        }}
      >
        {borrando ? "Borrando…" : "Sí, borrar"}
      </button>
      <button type="button" className="no" disabled={borrando} onClick={() => setConfirmando(false)}>
        No
      </button>
    </div>
  );
}
