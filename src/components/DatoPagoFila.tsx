import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { conEspacios, tipoNumero, type DatosPago } from "../lib/datosPago";

// A dónde pagarle (solo dueño): banco y número completo, con "Copiar".
export function DatoPagoFila({ datos, detalle = false }: { datos: DatosPago; detalle?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const fecha = new Date(datos.confirmado_en).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <div className="dato-pago" onClick={(e) => e.stopPropagation()}>
      <div className="dato-pago-fila">
        <span>
          <strong>{datos.banco}</strong> · {tipoNumero(datos.numero) === "CLABE" ? "CLABE " : ""}
          {conEspacios(datos.numero)}
        </span>
        <button
          type="button"
          className="dato-pago-copiar"
          onClick={() => {
            navigator.clipboard?.writeText(datos.numero).then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1800);
            });
          }}
        >
          {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      {detalle && (
        <small>
          A nombre de {datos.titular} · lo confirmó el {fecha}
        </small>
      )}
    </div>
  );
}
