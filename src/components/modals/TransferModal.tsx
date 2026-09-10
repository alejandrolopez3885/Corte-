import { useState } from "react";
import { Sheet, Field, SumInput } from "../ui";
import { sumFromText } from "../../lib/dataModel";
import type { MeseroCatalogEntry, Transferencia } from "../../lib/types";

export interface TransferFormValues {
  persona: string;
  total: string;
}

export function TransferModal({
  onClose,
  onSave,
  onDelete,
  editing,
  catalog,
}: {
  onClose: () => void;
  onSave: (form: TransferFormValues, editingId?: string) => void;
  onDelete?: () => void;
  editing?: Transferencia;
  catalog: MeseroCatalogEntry[];
}) {
  const [persona, setPersona] = useState(editing?.persona || "");
  const [total, setTotal] = useState(editing ? String(editing.total) : "");

  return (
    <Sheet title={editing ? "Editar transferencia" : "Nueva transferencia"} onClose={onClose} onDelete={onDelete}>
      <Field label="Quién cobró">
        <input className="text-input" list="meseros-catalog-t" value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Nombre" />
        <datalist id="meseros-catalog-t">
          {catalog.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
      </Field>
      <Field label="Total">
        <SumInput value={total} onChange={setTotal} placeholder="0.00 o 300,300,300" />
      </Field>
      <button
        className="btn-primary"
        disabled={!persona || !total}
        onClick={() => onSave({ persona, total: String(sumFromText(total)) }, editing?.id)}
      >
        Guardar transferencia
      </button>
    </Sheet>
  );
}
