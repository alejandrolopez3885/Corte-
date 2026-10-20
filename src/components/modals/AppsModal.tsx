import { useState } from "react";
import { Sheet, Field, SumInput } from "../ui";

export function AppsModal({
  onClose,
  onSave,
  value,
  desglose,
}: {
  onClose: () => void;
  onSave: (rawValue: string, desglose?: number[]) => void;
  value: number;
  desglose?: number[];
}) {
  const [text, setText] = useState(String(value || ""));
  const [partes, setPartes] = useState<number[] | undefined>(desglose);
  return (
    <Sheet title="Ventas de apps" onClose={onClose}>
      <p className="hint">Este total se suma a la venta del día, pero no forma parte del efectivo a entregar.</p>
      <Field label="Total del día">
        <SumInput value={text} onChange={setText} onPartes={setPartes} placeholder="0.00 o 150+200+80" sumar />
      </Field>
      <button className="btn-primary" onClick={() => onSave(text, partes)}>
        Guardar
      </button>
    </Sheet>
  );
}
