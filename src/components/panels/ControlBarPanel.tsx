import { useState } from "react";
import { ArrowLeft, ClipboardList, Martini, Package } from "lucide-react";
import { InsumosPanel } from "./InsumosPanel";
import { ConteoDiarioPanel } from "./ConteoDiarioPanel";
import { plantillaConteo } from "../../lib/dataModel";
import type { ConteoTextoArea, InsumoEntry, MonthData, ProveedorCatalogEntry } from "../../lib/types";

type ControlBarView = "menu" | "catalogo" | "conteo";

export function ControlBarPanel({
  onBack,
  insumos,
  proveedores,
  onSaveInsumo,
  onRemoveInsumo,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  conteosTexto,
  onGuardarConteo,
  pedidosDiarios,
  onGuardarPedido,
  initialView = "menu",
}: {
  onBack: () => void;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onSaveInsumo: (entry: InsumoEntry, nuevoProveedor?: ProveedorCatalogEntry) => void;
  onRemoveInsumo: (id: string) => void;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  conteosTexto: Record<ConteoTextoArea, Record<string, string>>;
  onGuardarConteo: (area: ConteoTextoArea, fecha: string, texto: string) => void;
  pedidosDiarios: Record<ConteoTextoArea, Record<string, Record<string, number>>>;
  onGuardarPedido: (area: ConteoTextoArea, fecha: string, pedido: Record<string, number>) => void;
  // Desde Inicio se abre directo en el Conteo diario.
  initialView?: ControlBarView;
}) {
  const [view, setView] = useState<ControlBarView>(initialView);
  const insumosBar = insumos.filter((i) => i.area === "bar");

  if (view === "catalogo") {
    return (
      <InsumosPanel
        onBack={() => setView("menu")}
        backLabel="Control de Bar"
        area="bar"
        title="Catálogo"
        emptyIcon={<Martini size={26} strokeWidth={1.3} />}
        emptyText="Aún no agregas insumos de bar. Empieza con tus cervezas y refrescos."
        insumos={insumosBar}
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
        backLabel="Control de Bar"
        emptyIcon={<Martini size={26} strokeWidth={1.3} />}
        emptyText="Aún no marcas insumos de bar como alta rotación. Márcalos desde el Catálogo para que aparezcan aquí."
        plantilla={plantillaConteo("bar")}
        insumos={insumosBar}
        proveedores={proveedores}
        months={months}
        monthKeys={monthKeys}
        initialMonthKey={initialMonthKey}
        initialWeekIndex={initialWeekIndex}
        textos={conteosTexto.bar}
        onGuardar={(fecha, texto) => onGuardarConteo("bar", fecha, texto)}
        pedidos={pedidosDiarios.bar}
        onGuardarPedido={(fecha, pedido) => onGuardarPedido("bar", fecha, pedido)}
        conPedido={false}
      />
    );
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Control de Bar</h2>
      <div className="menu-list">
        <button className="menu-item" onClick={() => setView("conteo")}>
          <span className="menu-item-icon">
            <ClipboardList size={20} />
          </span>
          <span className="menu-item-text">
            <strong>Conteo diario</strong>
            <span>Captura de insumos de alta rotación</span>
          </span>
        </button>
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
