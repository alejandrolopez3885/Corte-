import { useState } from "react";
import { Sheet, Field, NumInput, Toggle } from "../ui";
import { GASTO_CATEGORIAS } from "../../lib/types";
import type { Gasto, GastoCategoria, GastoEstado } from "../../lib/types";

export interface GastoFormValues {
  concepto: string;
  total: string;
  estado: GastoEstado;
  categoria: GastoCategoria | "";
}

export function GastoModal({
  onClose,
  onSave,
  onDelete,
  editing,
}: {
  onClose: () => void;
  onSave: (form: GastoFormValues, editingId?: string) => void;
  onDelete?: () => void;
  editing?: Gasto;
}) {
  const [concepto, setConcepto] = useState(editing?.concepto || "");
  const [total, setTotal] = useState(editing ? String(editing.total) : "");
  const [estado, setEstado] = useState<GastoEstado>(editing?.estado || "pendiente");
  const [categoria, setCategoria] = useState<GastoCategoria | "">(editing?.categoria || "");

  const canMarkIngresado = estado === "ingresado" || !!categoria;

  return (
    <Sheet title={editing ? "Editar gasto" : "Nuevo gasto"} onClose={onClose} onDelete={onDelete}>
      <Field label="Concepto">
        <input className="text-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. compra de servilletas" />
      </Field>
      <Field label="Total">
        <NumInput value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Categoría">
        <select
          className="categoria-select"
          style={{ width: "100%" }}
          value={categoria}
          disabled={estado === "ingresado"}
          onChange={(e) => setCategoria(e.target.value as GastoCategoria | "")}
        >
          <option value="">Sin categoría</option>
          {GASTO_CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Toggle
        checked={estado === "ingresado"}
        disabled={!canMarkIngresado}
        onChange={(v) => setEstado(v ? "ingresado" : "pendiente")}
        label="Ya está ingresado"
      />
      {!canMarkIngresado && <p className="hint">Elige una categoría para poder marcarlo como ingresado.</p>}
      <button
        className="btn-primary"
        disabled={!concepto || !total}
        onClick={() => onSave({ concepto, total, estado, categoria }, editing?.id)}
      >
        Guardar gasto
      </button>
    </Sheet>
  );
}
