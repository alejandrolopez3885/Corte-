import { useState } from "react";
import { X } from "lucide-react";
import { Sheet, Field, NumInput, SumInput } from "../ui";
import { money, round2, sumFromText, uid } from "../../lib/dataModel";
import type { Gasto, MeseroCatalogEntry, MeseroCut, PropinaTipo } from "../../lib/types";

export interface MeseroFormValues {
  meseroId: string;
  nombre: string;
  propinaTipo: PropinaTipo;
  manualPropina: string;
  venta: string;
  tarjetas: string;
  gastos: { concepto: string; monto: string }[];
  transferMonto: string;
}

interface GastoRow {
  id: string;
  concepto: string;
  monto: string;
}

export function MeseroModal({
  onClose,
  onSave,
  onDelete,
  editing,
  catalog,
  existingGastos,
}: {
  onClose: () => void;
  onSave: (form: MeseroFormValues, editingId?: string) => void;
  onDelete?: () => void;
  editing?: MeseroCut;
  catalog: MeseroCatalogEntry[];
  existingGastos: Gasto[];
}) {
  const [meseroId, setMeseroId] = useState(editing?.meseroId || "");
  const [nombre, setNombre] = useState(editing?.nombre || "");
  const [propinaTipo, setPropinaTipo] = useState<PropinaTipo>(
    editing?.propinaTipo || (editing ? (editing.aplicaPropina ? "p3" : "none") : "p3")
  );
  const [manualPropina, setManualPropina] = useState(
    editing?.propinaTipo === "manual" ? String(editing.propina) : ""
  );
  const [venta, setVenta] = useState(editing ? String(editing.venta) : "");
  const [tarjetas, setTarjetas] = useState(editing ? String(editing.tarjetas) : "");
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [showTransfer, setShowTransfer] = useState(!!editing?.transferencia);
  const [transferMonto, setTransferMonto] = useState(editing?.transferencia ? String(editing.transferencia) : "");

  function handleSelect(id: string) {
    const m = catalog.find((c) => c.id === id);
    setMeseroId(id);
    if (m) setNombre(m.nombre);
  }

  function addGastoRow() {
    setGastos((g) => [...g, { id: uid(), concepto: "", monto: "" }]);
  }
  function updateGastoRow(id: string, field: "concepto" | "monto", val: string) {
    setGastos((g) => g.map((x) => (x.id === id ? { ...x, [field]: val } : x)));
  }
  function removeGastoRow(id: string) {
    setGastos((g) => g.filter((x) => x.id !== id));
  }

  const v = parseFloat(venta) || 0;
  const t = sumFromText(tarjetas);
  const transferSum = showTransfer ? sumFromText(transferMonto) : 0;
  const existingGastosSum = (existingGastos || []).reduce((s, g) => s + g.total, 0);
  const newGastosSum = gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  const gastosSum = round2(existingGastosSum + newGastosSum);
  const propina =
    propinaTipo === "p3" ? round2(v * 0.03) : propinaTipo === "p2" ? round2(v * 0.02) : propinaTipo === "manual" ? parseFloat(manualPropina) || 0 : 0;
  // A nivel de corte individual, la propina sí se suma: es lo que el mesero entrega en mano.
  const total = round2(v - t - transferSum + propina - gastosSum);

  return (
    <Sheet title={editing ? "Editar corte" : "Nuevo corte de mesero"} onClose={onClose} onDelete={onDelete}>
      <Field label="Mesero">
        {catalog.length === 0 ? (
          <p className="hint">Aún no tienes meseros en tu lista. Pide al encargado que los agregue.</p>
        ) : (
          <select className="text-input" value={meseroId} onChange={(e) => handleSelect(e.target.value)}>
            <option value="" disabled>
              Selecciona un mesero
            </option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Propina">
        <div className="segmented">
          <button type="button" className={propinaTipo === "p3" ? "active" : ""} onClick={() => setPropinaTipo("p3")}>
            3%
          </button>
          <button type="button" className={propinaTipo === "p2" ? "active" : ""} onClick={() => setPropinaTipo("p2")}>
            2%
          </button>
          <button type="button" className={propinaTipo === "none" ? "active" : ""} onClick={() => setPropinaTipo("none")}>
            Nada
          </button>
          <button type="button" className={propinaTipo === "manual" ? "active" : ""} onClick={() => setPropinaTipo("manual")}>
            Manual
          </button>
        </div>
      </Field>
      {propinaTipo === "manual" && (
        <Field label="Monto de propina">
          <NumInput value={manualPropina} onChange={(e) => setManualPropina(e.target.value)} placeholder="0.00" />
        </Field>
      )}

      <div className="field-row">
        <Field label="Venta total">
          <NumInput value={venta} onChange={(e) => setVenta(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Total tarjetas">
          <SumInput value={tarjetas} onChange={setTarjetas} placeholder="0.00 o 300,300,300" />
        </Field>
      </div>

      <div className="preview">
        <div>
          <span>Propina</span>
          <strong>{money(propina)}</strong>
        </div>
        {transferSum > 0 && (
          <div>
            <span>Transferencia (se descuenta)</span>
            <strong>-{money(transferSum)}</strong>
          </div>
        )}
        {gastosSum > 0 && (
          <div>
            <span>Gastos (se descuentan)</span>
            <strong>-{money(gastosSum)}</strong>
          </div>
        )}
        <div className="preview-main">
          <span>Entrega en efectivo (incluye propina)</span>
          <strong>{money(total)}</strong>
        </div>
      </div>

      {existingGastos && existingGastos.length > 0 && (
        <>
          <div className="mini-head">
            <span>Gastos ya registrados de este corte</span>
          </div>
          <div className="gasto-existing-list">
            {existingGastos.map((g) => (
              <div key={g.id} className="gasto-existing-row">
                <span className="gasto-existing-concepto">{g.concepto}</span>
                <span className="gasto-existing-monto">{money(g.total)}</span>
                <span className={`estado-chip ${g.estado}`}>{g.estado === "pendiente" ? "Pendiente" : "Ingresado"}</span>
              </div>
            ))}
          </div>
          <p className="hint">Para confirmarlos o borrarlos, hazlo desde la sección de Gastos del día.</p>
        </>
      )}

      <div className="mini-head">
        <span>Agregar otro gasto a este corte</span>
        <button type="button" className="link-btn" onClick={addGastoRow}>
          + Agregar gasto
        </button>
      </div>
      {gastos.length === 0 && <p className="hint">Si este mesero pagó algo de su corte, agrégalo aquí. Puedes sumar más de uno.</p>}
      {gastos.map((g) => (
        <div key={g.id} className="gasto-row">
          <Field label="Concepto">
            <input
              className="text-input"
              value={g.concepto}
              onChange={(e) => updateGastoRow(g.id, "concepto", e.target.value)}
              placeholder="Ej. compra de hielo"
            />
          </Field>
          <Field label="Monto">
            <NumInput value={g.monto} onChange={(e) => updateGastoRow(g.id, "monto", e.target.value)} placeholder="0.00" />
          </Field>
          <button type="button" className="icon-btn" onClick={() => removeGastoRow(g.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
      {gastos.length > 0 && <p className="hint">Cada uno se agregará a Gastos como pendiente.</p>}

      <button type="button" className="link-btn" onClick={() => setShowTransfer((s) => !s)}>
        {showTransfer ? "Quitar transferencia de este corte" : "+ Este mesero tiene una transferencia"}
      </button>

      {showTransfer && (
        <Field label="Monto de la transferencia">
          <SumInput value={transferMonto} onChange={setTransferMonto} placeholder="0.00 o 300,300,300" />
        </Field>
      )}
      {showTransfer && <p className="hint">Se agregará a Transferencias a nombre de {nombre || "este mesero"}.</p>}

      <button
        className="btn-primary"
        disabled={!nombre || !venta}
        onClick={() =>
          onSave(
            {
              meseroId,
              nombre,
              propinaTipo,
              manualPropina,
              venta,
              tarjetas,
              gastos: gastos.filter((g) => g.concepto && g.monto),
              transferMonto: showTransfer ? transferMonto : "",
            },
            editing?.id
          )
        }
      >
        Guardar corte
      </button>
    </Sheet>
  );
}
