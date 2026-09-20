import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Empty, NumInput } from "../ui";
import { sumFromText, todayIso } from "../../lib/dataModel";
import type { InsumoEntry } from "../../lib/types";

export function ConteoDiarioPanel({
  onBack,
  backLabel,
  emptyIcon,
  emptyText,
  insumos,
  conteoHoy,
  onGuardar,
}: {
  onBack: () => void;
  backLabel: string;
  emptyIcon: ReactNode;
  emptyText: string;
  insumos: InsumoEntry[];
  conteoHoy: Record<string, number>;
  onGuardar: (fecha: string, valores: Record<string, number>) => void;
}) {
  const fecha = todayIso();
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    insumos.forEach((i) => {
      init[i.id] = conteoHoy[i.id] !== undefined ? String(conteoHoy[i.id]) : "";
    });
    return init;
  });
  const [guardado, setGuardado] = useState(false);

  function guardar() {
    const out: Record<string, number> = {};
    insumos.forEach((i) => {
      if (valores[i.id]?.trim()) out[i.id] = sumFromText(valores[i.id]);
    });
    onGuardar(fecha, out);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> {backLabel}
      </button>
      <h2 className="page-title">Conteo diario</h2>
      <p className="hint">Cuánto queda hoy ({fecha}) de cada insumo de alta rotación.</p>

      {insumos.length === 0 ? (
        <Empty icon={emptyIcon} text={emptyText} />
      ) : (
        <>
          <div className="catalog-list">
            {insumos.map((i) => (
              <div key={i.id} className="catalog-row conteo-row">
                <div>
                  <strong>{i.nombre}</strong>
                  <span>{i.unidad}</span>
                </div>
                <NumInput
                  value={valores[i.id] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [i.id]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={guardar}>
            {guardado ? "Guardado ✓" : "Guardar conteo"}
          </button>
        </>
      )}
    </div>
  );
}
