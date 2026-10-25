import { useState } from "react";
import { Check } from "lucide-react";
import { Sheet } from "./ui";
import { ETIQUETAS, esQuincena, etiquetasDelDia } from "../lib/etiquetas";
import type { DayData, EtiquetaDia } from "../lib/types";

export type ValorEtiquetas = { tipos: EtiquetaDia[]; nota?: string };

// Hoja para elegir las etiquetas de un día (Horarios y Corte).
export function EtiquetasDiaSheet({
  titulo,
  fechaIso,
  inicial,
  onGuardar,
  onClose,
}: {
  titulo: string;
  fechaIso: string;
  inicial?: ValorEtiquetas;
  onGuardar: (v: ValorEtiquetas | undefined) => void;
  onClose: () => void;
}) {
  const [tipos, setTipos] = useState<EtiquetaDia[]>(inicial?.tipos || []);
  const [nota, setNota] = useState(inicial?.nota || "");
  const alternar = (id: EtiquetaDia) => setTipos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <Sheet title={titulo} onClose={onClose}>
      {esQuincena(fechaIso) && <p className="etq-quincena">💰 Es día de quincena (se marca solo).</p>}
      <p className="hint">¿Qué pasó o va a pasar este día? Puedes elegir varias.</p>
      <div className="etq-opciones">
        {ETIQUETAS.map((e) => (
          <button key={e.id} type="button" className={`etq-opcion ${tipos.includes(e.id) ? "on" : ""}`} onClick={() => alternar(e.id)}>
            <span className="etq-icono">{e.icono}</span>
            {e.texto}
            {tipos.includes(e.id) && <Check size={18} className="etq-check" />}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Nota (opcional)</span>
        <input className="text-input" value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Ej. América vs. Chivas, banda de rock, cumpleaños de 40" />
      </label>
      <button
        className="btn-primary"
        onClick={() => onGuardar(tipos.length || nota.trim() ? { tipos, ...(nota.trim() ? { nota: nota.trim() } : {}) } : undefined)}
      >
        Guardar
      </button>
    </Sheet>
  );
}

// Fila chica con las etiquetas de un día y el botón para cambiarlas.
export function EtiquetasDiaFila({ day, fechaIso, onEditar }: { day: DayData; fechaIso: string; onEditar?: () => void }) {
  const lista = etiquetasDelDia(day, fechaIso);
  return (
    <div className="etq-fila">
      {lista.map((e) => (
        <span key={e.texto} className={`etq-chip ${e.auto ? "auto" : ""}`}>
          {e.icono} {e.texto}
        </span>
      ))}
      {day.etiquetas?.nota && <span className="etq-nota">“{day.etiquetas.nota}”</span>}
      {onEditar && (
        <button type="button" className="link-btn etq-editar" onClick={onEditar}>
          {day.etiquetas?.tipos.length || day.etiquetas?.nota ? "Cambiar etiquetas" : "＋ Etiqueta del día"}
        </button>
      )}
    </div>
  );
}
