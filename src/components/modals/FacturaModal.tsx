import { useState } from "react";
import { Sheet, Field, NumInput } from "../ui";
import type { FacturaProveedor } from "../../lib/types";

export interface FacturaFormValues {
  proveedor: string;
  total: string;
}

export function FacturaModal({
  onClose,
  onSave,
  onDelete,
  editing,
  proveedorSuggestions,
}: {
  onClose: () => void;
  onSave: (form: FacturaFormValues, editingId?: string) => void;
  onDelete?: () => void;
  editing?: FacturaProveedor;
  proveedorSuggestions: string[];
}) {
  const [proveedor, setProveedor] = useState(editing?.proveedor || "");
  const [total, setTotal] = useState(editing ? String(editing.total) : "");

  return (
    <Sheet title={editing ? "Editar factura" : "Nueva factura"} onClose={onClose} onDelete={onDelete}>
      <p className="hint">Notas o facturas de proveedores pagadas por transferencia. No afectan tu efectivo.</p>
      <Field label="Proveedor">
        <input
          className="text-input"
          list="proveedores-catalog"
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          placeholder="Nombre del proveedor"
        />
        <datalist id="proveedores-catalog">
          {proveedorSuggestions.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="Total">
        <NumInput value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
      </Field>
      {!editing && <p className="hint">Se guarda como pendiente. Categoría: Operación (fija).</p>}
      <button
        className="btn-primary"
        disabled={!proveedor.trim() || !total}
        onClick={() => onSave({ proveedor: proveedor.trim(), total }, editing?.id)}
      >
        Guardar factura
      </button>
    </Sheet>
  );
}
