import { useState } from "react";
import { ArrowLeft, ChefHat, ClipboardList, Package } from "lucide-react";
import { InsumosPanel } from "./InsumosPanel";
import { ConteoDiarioPanel } from "./ConteoDiarioPanel";
import type { InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

type ControlCocinaView = "menu" | "catalogo" | "conteo";

export function ControlCocinaPanel({
  onBack,
  insumos,
  proveedores,
  onSaveInsumo,
  onRemoveInsumo,
  conteoHoy,
  onGuardarConteo,
}: {
  onBack: () => void;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onSaveInsumo: (entry: InsumoEntry, nuevoProveedor?: ProveedorCatalogEntry) => void;
  onRemoveInsumo: (id: string) => void;
  conteoHoy: Record<string, number>;
  onGuardarConteo: (fecha: string, valores: Record<string, number>) => void;
}) {
  const [view, setView] = useState<ControlCocinaView>("menu");
  const insumosCocina = insumos.filter((i) => i.area === "cocina");

  if (view === "catalogo") {
    return (
      <InsumosPanel
        onBack={() => setView("menu")}
        backLabel="Control de Cocina"
        area="cocina"
        title="Catálogo"
        emptyIcon={<ChefHat size={26} strokeWidth={1.3} />}
        emptyText="Aún no agregas insumos de cocina. Empieza por proveedor, como Fracksa u otros."
        insumos={insumosCocina}
        proveedores={proveedores}
        onSaveInsumo={onSaveInsumo}
        onRemoveInsumo={onRemoveInsumo}
      />
    );
  }

  if (view === "conteo") {
    return (
      <ConteoDiarioPanel
        onBack={() => setView("menu")}
        backLabel="Control de Cocina"
        emptyIcon={<ChefHat size={26} strokeWidth={1.3} />}
        emptyText="Aún no marcas insumos de cocina como alta rotación. Márcalos desde el Catálogo para que aparezcan aquí."
        insumos={insumosCocina.filter((i) => i.altaRotacion)}
        conteoHoy={conteoHoy}
        onGuardar={onGuardarConteo}
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
        <button className="menu-item" onClick={() => setView("conteo")}>
          <span className="menu-item-icon">
            <ClipboardList size={20} />
          </span>
          <span className="menu-item-text">
            <strong>Conteo diario</strong>
            <span>Captura de insumos de alta rotación</span>
          </span>
        </button>
      </div>
    </div>
  );
}
