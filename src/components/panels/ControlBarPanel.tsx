import { Martini } from "lucide-react";
import { InsumosPanel } from "./InsumosPanel";
import type { InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

export function ControlBarPanel({
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
      area="bar"
      title="Control de Bar"
      emptyIcon={<Martini size={26} strokeWidth={1.3} />}
      emptyText="Aún no agregas insumos de bar. Empieza con tus cervezas y refrescos."
      insumos={insumos.filter((i) => i.area === "bar")}
      proveedores={proveedores}
      onSaveInsumo={onSaveInsumo}
      onRemoveInsumo={onRemoveInsumo}
    />
  );
}
