import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Sheet, Field, NumInput, Empty } from "../ui";
import { computeFacturasSummary, formatShortDate, money, uid } from "../../lib/dataModel";
import type { FacturaProveedor, ProveedorCatalogEntry } from "../../lib/types";

export interface FacturaFormValues {
  proveedorId: string;
  numero: string;
  total: string;
  fecha: string;
}

type View = "list" | "form" | "catalog";

export function ProveedoresModal({
  onClose,
  facturas,
  proveedores,
  onSaveFactura,
  onDeleteFactura,
  onToggleEstado,
  onSaveProveedor,
  onRemoveProveedor,
}: {
  onClose: () => void;
  facturas: FacturaProveedor[];
  proveedores: ProveedorCatalogEntry[];
  onSaveFactura: (form: FacturaFormValues, editingId?: string) => void;
  onDeleteFactura: (id: string) => void;
  onToggleEstado: (id: string) => void;
  onSaveProveedor: (entry: ProveedorCatalogEntry) => void;
  onRemoveProveedor: (id: string) => void;
}) {
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<FacturaProveedor | undefined>(undefined);

  function proveedorNombre(id: string): string {
    return proveedores.find((p) => p.id === id)?.nombre || "Proveedor eliminado";
  }

  if (view === "catalog") {
    return (
      <Sheet title="Lista de proveedores" onClose={onClose}>
        <button type="button" className="link-btn" onClick={() => setView("list")}>
          ← Volver a facturas
        </button>
        <ProveedorCatalogView proveedores={proveedores} onSave={onSaveProveedor} onRemove={onRemoveProveedor} />
      </Sheet>
    );
  }

  if (view === "form") {
    return (
      <Sheet
        title={editing ? "Editar factura" : "Nueva factura"}
        onClose={() => setView("list")}
        onDelete={editing ? () => { onDeleteFactura(editing.id); setView("list"); } : undefined}
      >
        <FacturaForm
          proveedores={proveedores}
          editing={editing}
          onManageProveedores={() => setView("catalog")}
          onSave={(form) => {
            onSaveFactura(form, editing?.id);
            setView("list");
          }}
        />
      </Sheet>
    );
  }

  const summary = computeFacturasSummary(facturas);
  const sorted = [...facturas].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <Sheet title="Proveedores" onClose={onClose}>
      <p className="hint">
        Facturas y notas de proveedores pagadas por transferencia. No forman parte de tu efectivo.
      </p>
      <div className="summary-grid-modal">
        <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
          <span>Total de facturas ({summary.countTotal})</span>
          <strong>{money(summary.totalMonto)}</strong>
        </div>
        <div className="summary-item">
          <span>Ingresadas ({summary.countIngresado})</span>
          <strong>{money(summary.totalIngresado)}</strong>
        </div>
        <div className="summary-item">
          <span>Pendientes ({summary.countPendiente})</span>
          <strong>{money(summary.totalPendiente)}</strong>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={() => {
          if (proveedores.length === 0) {
            setView("catalog");
            return;
          }
          setEditing(undefined);
          setView("form");
        }}
      >
        + Nueva factura
      </button>
      <button type="button" className="link-btn" onClick={() => setView("catalog")}>
        Administrar lista de proveedores
      </button>

      {sorted.length === 0 ? (
        <Empty icon={<Check size={26} strokeWidth={1.3} />} text="Aún no registras ninguna factura de proveedor." />
      ) : (
        <div className="card-list">
          {sorted.map((f) => (
            <div key={f.id} className="card gasto-card">
              <button
                className="gasto-main"
                onClick={() => {
                  setEditing(f);
                  setView("form");
                }}
              >
                <div className="card-top">
                  <span className="card-name">{proveedorNombre(f.proveedorId)}</span>
                  <span className="card-total">{money(f.total)}</span>
                </div>
                <span className="card-tag">
                  {f.numero ? `Factura ${f.numero} · ` : ""}
                  {formatShortDate(f.fecha)}
                </span>
              </button>
              <button className={`estado-chip ${f.estado}`} onClick={() => onToggleEstado(f.id)}>
                {f.estado === "pendiente" ? "Confirmar" : "Ingresada"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function FacturaForm({
  proveedores,
  editing,
  onSave,
  onManageProveedores,
}: {
  proveedores: ProveedorCatalogEntry[];
  editing?: FacturaProveedor;
  onSave: (form: FacturaFormValues) => void;
  onManageProveedores: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [proveedorId, setProveedorId] = useState(editing?.proveedorId || proveedores[0]?.id || "");
  const [numero, setNumero] = useState(editing?.numero || "");
  const [total, setTotal] = useState(editing ? String(editing.total) : "");
  const [fecha, setFecha] = useState(editing?.fecha || today);

  return (
    <>
      <Field label="Proveedor">
        <select className="text-input" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button type="button" className="link-btn" onClick={onManageProveedores}>
          + Agregar un proveedor nuevo a la lista
        </button>
      </Field>
      <Field label="Número de factura">
        <input className="text-input" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej. F-00123" />
      </Field>
      <Field label="Total">
        <NumInput value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Fecha">
        <input type="date" className="date-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <p className="hint">Categoría: Operación (fija).</p>
      <button
        className="btn-primary"
        disabled={!proveedorId || !total}
        onClick={() => onSave({ proveedorId, numero, total, fecha })}
      >
        Guardar factura
      </button>
    </>
  );
}

function ProveedorCatalogView({
  proveedores,
  onSave,
  onRemove,
}: {
  proveedores: ProveedorCatalogEntry[];
  onSave: (entry: ProveedorCatalogEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [nombre, setNombre] = useState("");

  function add() {
    if (!nombre.trim()) return;
    onSave({ id: uid(), nombre: nombre.trim() });
    setNombre("");
  }

  return (
    <>
      <p className="hint">Estos nombres son los que podrás elegir al capturar una factura.</p>
      <div className="catalog-list">
        {proveedores.length === 0 && <p className="hint">Aún no agregas a ningún proveedor.</p>}
        {proveedores.map((p) => (
          <div key={p.id} className="catalog-row">
            <strong>{p.nombre}</strong>
            <button className="icon-btn" onClick={() => onRemove(p.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="field-row">
        <Field label="Nombre">
          <input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nuevo proveedor" />
        </Field>
      </div>
      <button className="btn-primary" onClick={add} disabled={!nombre.trim()}>
        Agregar a la lista
      </button>
    </>
  );
}
