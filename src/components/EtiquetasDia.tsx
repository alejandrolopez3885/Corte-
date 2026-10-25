import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Sheet } from "./ui";
import { ETIQUETAS, etiquetasDelDia } from "../lib/etiquetas";
import { UBICACION, cielo, textoClima, useClima } from "../lib/clima";
import type { DayData, EtiquetaDia } from "../lib/types";

export type ValorEtiquetas = { tipos: EtiquetaDia[]; nota?: string };

// Hoja para elegir las etiquetas de un día (Horarios y Corte).
export function EtiquetasDiaSheet({
  titulo,
  fechaIso,
  inicial,
  arriba,
  onGuardar,
  onClose,
}: {
  titulo: string;
  fechaIso: string;
  inicial?: ValorEtiquetas;
  // Algo que va arriba (ej. el desglose de la venta esperada).
  arriba?: ReactNode;
  onGuardar: (v: ValorEtiquetas | undefined) => void;
  onClose: () => void;
}) {
  const [tipos, setTipos] = useState<EtiquetaDia[]>(inicial?.tipos || []);
  const [nota, setNota] = useState(inicial?.nota || "");
  const alternar = (id: EtiquetaDia) => setTipos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <Sheet title={titulo} onClose={onClose}>
      {arriba}
      {etiquetasDelDia(null, fechaIso).map((e) => (
        <p key={e.texto} className="etq-quincena">
          {e.icono} {e.texto === "Quincena" ? "Es día de quincena" : e.texto} <span>(se marca solo)</span>
        </p>
      ))}
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

// Fila chica con el clima, las etiquetas de un día y el botón para cambiarlas.
export function EtiquetasDiaFila({ day, fechaIso, onEditar }: { day: DayData; fechaIso: string; onEditar?: () => void }) {
  const lista = etiquetasDelDia(day, fechaIso);
  const clima = useClima(fechaIso, fechaIso)(fechaIso);
  return (
    <div className="etq-fila">
      {clima && (
        <span className="etq-chip clima" title={`${cielo(clima.codigo).texto}${clima.pronostico ? " (pronóstico)" : ""} · ${UBICACION.nombre}`}>
          {textoClima(clima)}
        </span>
      )}
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
