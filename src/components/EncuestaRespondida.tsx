import { useEffect } from "react";
import { Check } from "lucide-react";
import type { EncuestaContestada } from "../lib/encuestas";

// Estrellas de la encuesta del cliente. Sin onChange son solo para ver
// (la encuesta ya contestada).
export function Estrellas({ valor, onChange, etiqueta }: { valor: number; onChange?: (n: number) => void; etiqueta: string }) {
  return (
    <div className="ep-estrellas">
      <span>{etiqueta}</span>
      <div role={onChange ? "radiogroup" : "img"} aria-label={onChange ? etiqueta : `${etiqueta}: ${valor} de 5`}>
        {[1, 2, 3, 4, 5].map((n) =>
          onChange ? (
            <button key={n} type="button" className={n <= valor ? "llena" : ""} onClick={() => onChange(n)} aria-label={`${n} de 5`}>
              ★
            </button>
          ) : (
            <span key={n} className={`ep-estrella-fija ${n <= valor ? "llena" : ""}`}>
              ★
            </span>
          )
        )}
      </div>
    </div>
  );
}

const cuando = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(".", "");

// La encuesta tal cual la vio el cliente, ya respondida y sin poder
// cambiar nada: la abre el dueño desde Encuestas y el mesero desde su
// pantalla de Encuesta (solo las suyas que cuentan).
export function EncuestaRespondida({ r, onCerrar }: { r: EncuestaContestada; onCerrar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  return (
    <div className="ep-fondo ep-encima" role="dialog" aria-modal="true" aria-label="Encuesta contestada">
      <div className="ep-tarjeta">
        <img className="ep-logo" src="/favicon.svg" alt="" />
        <h1>¿Cómo te atendimos?</h1>
        <p className="hint">Te atendió {r.mesero_nombre} · toma 30 segundos</p>
        <div className="ep-sello">
          <Check size={15} /> Contestada el {cuando(r.respondida_en)}
          {r.mesa ? ` · Mesa ${r.mesa}` : ""}
        </div>
        <label className="field">
          <span>Total de tu cuenta (como viene en tu ticket)</span>
          <input className="text-input" readOnly value={String(r.total_cliente)} />
        </label>
        <Estrellas etiqueta="Atención de tu mesero" valor={r.atencion} />
        <Estrellas etiqueta="Comida" valor={r.comida} />
        <Estrellas etiqueta="Rapidez" valor={r.rapidez} />
        <label className="field">
          <span>Comentario (opcional)</span>
          <textarea className="text-input" rows={3} readOnly value={r.comentario || ""} placeholder="Sin comentario" />
        </label>
        <button className="btn-primary" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
