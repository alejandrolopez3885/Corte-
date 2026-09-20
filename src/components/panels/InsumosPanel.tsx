import { useState, type ReactNode } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Empty } from "../ui";
import { money } from "../../lib/dataModel";
import { InsumoModal } from "../modals/InsumoModal";
import type { InsumoArea, InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

export function InsumosPanel({
  onBack,
  backLabel,
  area,
  title,
  emptyIcon,
  emptyText,
  insumos,
  proveedores,
  onSaveInsumo,
  onRemoveInsumo,
}: {
  onBack: () => void;
  backLabel: string;
  area: InsumoArea;
  title: string;
  emptyIcon: ReactNode;
  emptyText: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onSaveInsumo: (entry: InsumoEntry, nuevoProveedor?: ProveedorCatalogEntry) => void;
  onRemoveInsumo: (id: string) => void;
}) {
  const [modal, setModal] = useState<{ editing?: InsumoEntry } | null>(null);

  const porProveedor = new Map<string, InsumoEntry[]>();
  const sinProveedor: InsumoEntry[] = [];
  insumos.forEach((i) => {
    if (!i.proveedorId) {
      sinProveedor.push(i);
      return;
    }
    if (!porProveedor.has(i.proveedorId)) porProveedor.set(i.proveedorId, []);
    porProveedor.get(i.proveedorId)!.push(i);
  });
  const grupos: { key: string; nombre: string; items: InsumoEntry[] }[] = [];
  proveedores.forEach((p) => {
    const items = porProveedor.get(p.id);
    if (items && items.length > 0) grupos.push({ key: p.id, nombre: p.nombre, items });
  });
  if (sinProveedor.length > 0) grupos.push({ key: "sin", nombre: "Sin proveedor", items: sinProveedor });

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> {backLabel}
      </button>
      <div className="page-title-row">
        <h2 className="page-title">{title}</h2>
        <button className="icon-btn accent" onClick={() => setModal({})} aria-label="Agregar insumo">
          <Plus size={18} />
        </button>
      </div>
      <p className="hint">Catálogo de insumos — el primer paso para poder llevar compras y conteo de inventario.</p>

      {insumos.length === 0 ? (
        <Empty icon={emptyIcon} text={emptyText} />
      ) : (
        grupos.map((g) => (
          <div className="insumos-grupo" key={g.key}>
            <h3 className="insumos-grupo-titulo">{g.nombre}</h3>
            <div className="catalog-list">
              {g.items.map((i) => (
                <button key={i.id} className="catalog-row catalog-row-button" onClick={() => setModal({ editing: i })}>
                  <div>
                    <strong>{i.nombre}</strong>
                    <span>
                      {i.unidad}
                      {i.precio ? ` · ${money(i.precio)}` : ""}
                      {i.altaRotacion ? " · alta rotación" : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {modal && (
        <InsumoModal
          area={area}
          editing={modal.editing}
          proveedores={proveedores}
          onClose={() => setModal(null)}
          onSave={onSaveInsumo}
          onDelete={
            modal.editing
              ? () => {
                  onRemoveInsumo(modal.editing!.id);
                  setModal(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
