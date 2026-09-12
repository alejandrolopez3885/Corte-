import { Sheet } from "../ui";

export function DeleteMonthModal({
  onClose,
  onConfirm,
  monthLabel,
}: {
  onClose: () => void;
  onConfirm: () => void;
  monthLabel: string;
}) {
  return (
    <Sheet title="Eliminar mes" onClose={onClose}>
      <p className="hint">
        Vas a eliminar <strong>{monthLabel}</strong> por completo: todos los meseros, gastos, transferencias, facturas y ventas de
        apps capturados en sus 4 semanas. Esta acción no se puede deshacer.
      </p>
      <button className="btn-danger" onClick={onConfirm}>
        Sí, eliminar {monthLabel}
      </button>
      <button className="link-btn" onClick={onClose} style={{ textAlign: "center" }}>
        Cancelar
      </button>
    </Sheet>
  );
}
