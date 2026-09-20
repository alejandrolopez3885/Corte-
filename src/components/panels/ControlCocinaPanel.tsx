import { useState } from "react";
import { ArrowLeft, ChefHat, Package } from "lucide-react";
import { InsumosPanel } from "./InsumosPanel";
import type { InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

type ControlCocinaView = "menu" | "catalogo";

export function ControlCocinaPanel({
  onBack,
  insumos,
  proveedores,
  onSaveInsumo,
  onRemoveInsumo,
}: {
  onBack: () => void;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onSaveInsumo: (entry: InsumoEntry, nuevoProveedor?: ProveedorCatalogEntry) => void;
  onRemoveInsumo: (id: string) => void;
}) {
  const [view, setView] = useState<ControlCocinaView>("menu");

  if (view === "catalogo") {
    return (
      <InsumosPanel
        onBack={() => setView("menu")}
        backLabel="Control de Cocina"
        area="cocina"
        title="Catálogo"
        emptyIcon={<ChefHat size={26} strokeWidth={1.3} />}
        emptyText="Aún no agregas insumos de cocina. Empieza por proveedor, como Fracksa u otros."
        insumos={insumos.filter((i) => i.area === "cocina")}
        proveedores={proveedores}
        onSaveInsumo={onSaveInsumo}
        onRemoveInsumo={onRemoveInsumo}
      />
    );
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Control de Cocina</h2>
      <div className="menu-list">
        <button className="menu-item" onClick={() => setView("catalogo")}>
          <span className="menu-item-icon">
            <Package size={20} />
          </span>
          <span className="menu-item-text">
            <strong>Catálogo</strong>
            <span>Productos, precio, unidad y proveedor</span>
          </span>
        </button>
      </div>
    </div>
  );
}
