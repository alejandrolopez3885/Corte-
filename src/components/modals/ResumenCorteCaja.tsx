import { useContext } from "react";
import { money } from "../../lib/dataModel";
import { ResumenCorteContext } from "./resumenCorte";

export function ResumenCorteCaja() {
  const resumen = useContext(ResumenCorteContext);
  if (!resumen) return null;
  return (
    <details className="ca-resumen-dia">
      <summary><b>Resumen del día</b> · Venta {money(resumen.venta)} · Pendiente {money(resumen.efectivo)}</summary>
      <p>Tarjetas {money(resumen.tarjetas)} · Transferencias {money(resumen.transferencias)} · Gastos {money(resumen.gastos)}</p>
      <small>Solo incluye movimientos guardados; las propinas se llevan aparte.</small>
    </details>
  );
}
