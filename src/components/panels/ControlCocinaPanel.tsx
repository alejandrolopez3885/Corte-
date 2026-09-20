import { ChefHat } from "lucide-react";
import { InsumosPanel } from "./InsumosPanel";
import type { InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

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
  return (
    <InsumosPanel
      onBack={onBack}
      area="cocina"
      title="Control de Cocina"
      emptyIcon={<ChefHat size={26} strokeWidth={1.3} />}
      emptyText="Aún no agregas insumos de cocina. Empieza por proveedor, como Fracksa u otros."
      insumos={insumos.filter((i) => i.area === "cocina")}
      proveedores={proveedores}
      onSaveInsumo={onSaveInsumo}
      onRemoveInsumo={onRemoveInsumo}
    />
  );
}
