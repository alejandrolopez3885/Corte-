import { useState } from "react";
import { Sheet, Field, SumInput } from "../ui";

export function AppsModal({
  onClose,
  onSave,
  value,
}: {
  onClose: () => void;
  onSave: (rawValue: string) => void;
  value: number;
}) {
  const [text, setText] = useState(String(value || ""));
  return (
    <Sheet title="Ventas de apps" onClose={onClose}>
      <p className="hint">Este total se suma a la venta del día, pero no forma parte del efectivo a entregar.</p>
      <Field label="Total del día">
        <SumInput value={text} onChange={setText} placeholder="0.00 o 150,200,80" />
      </Field>
      <button className="btn-primary" onClick={() => onSave(text)}>
        Guardar
      </button>
    </Sheet>
  );
}
