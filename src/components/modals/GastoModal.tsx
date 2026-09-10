import { useState } from "react";
import { Sheet, Field, NumInput, Toggle } from "../ui";
import type { Gasto, GastoEstado } from "../../lib/types";

export interface GastoFormValues {
  concepto: string;
  total: string;
  estado: GastoEstado;
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

  return (
    <Sheet title={editing ? "Editar gasto" : "Nuevo gasto"} onClose={onClose} onDelete={onDelete}>
      <Field label="Concepto">
        <input className="text-input" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. compra de servilletas" />
      </Field>
      <Field label="Total">
        <NumInput value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
      </Field>
      <Toggle checked={estado === "ingresado"} onChange={(v) => setEstado(v ? "ingresado" : "pendiente")} label="Ya está ingresado" />
      <button className="btn-primary" disabled={!concepto || !total} onClick={() => onSave({ concepto, total, estado }, editing?.id)}>
        Guardar gasto
      </button>
    </Sheet>
  );
}
