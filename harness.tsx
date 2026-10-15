import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { ConteoDiarioPanel } from "./src/components/panels/ConteoDiarioPanel";
import { plantillaConteo } from "./src/lib/dataModel";
const months: any = { "2026-10": { label: "Octubre 2026", weeks: [0,1,2,3].map(() => ({ days: {} })) } };
const proveedores = [{ id: "p1", nombre: "Metroplex" }, { id: "p2", nombre: "Carnes del Norte" }];
const mk = (nombre: string, proveedorId?: string, unidad = "kg", unidadPedido?: string) => ({ id: nombre, area: "cocina" as const, nombre, unidad, proveedorId, unidadPedido });
const insumos = [mk("Papas a la francesa","p1","kg","caja"), mk("Papas crisscut","p1","kg","caja"), mk("Alitas","p2"), mk("Pollo","p2"), mk("Carne de hamburguesa","p2"), mk("Carne de taco","p2"), mk("Dedos de queso","p1","pieza","caja"), mk("Pan de hamburguesa"), mk("Pan de hot dog"), mk("Tocino","p2"), mk("Salchicha","p2","pieza"), mk("Elotes","p1","pieza","bolsa"), mk("Guacamole","p1","pieza","bolsa")];
function App() {
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [pedidos, setPedidos] = useState<Record<string, Record<string, number>>>({});
  return <div className="app-shell"><ConteoDiarioPanel backLabel="Inicio" onBack={() => {}} emptyIcon={null} emptyText="x"
    plantilla={plantillaConteo("cocina", [])} insumos={insumos} proveedores={proveedores} months={months} monthKeys={["2026-10"]} initialMonthKey="2026-10" initialWeekIndex={1}
    textos={textos} onGuardar={(f, t) => setTextos((x) => ({ ...x, [f]: t }))}
    pedidos={pedidos} onGuardarPedido={(f, p) => setPedidos((x) => ({ ...x, [f]: p }))} /></div>;
}
createRoot(document.getElementById("root")!).render(<App />);
