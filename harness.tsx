import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/index.css";
import { ConteoDiarioPanel } from "./src/components/panels/ConteoDiarioPanel";
import { plantillaConteo } from "./src/lib/dataModel";
const months: any = { "2026-10": { label: "Octubre 2026", weeks: [0,1,2,3].map(() => ({ days: {} })) } };
const proveedores = [{ id: "p1", nombre: "Fracksa" }];
const mk = (nombre: string, proveedorId?: string, unidad = "kg", unidadPedido?: string) => ({ id: nombre, area: "cocina" as const, nombre, unidad, proveedorId, unidadPedido });
const insumos = [mk("Papas a la francesa","p1","kg","caja"), mk("Papas crisscut","p1","kg","caja")];
function App() {
  const [textos, setTextos] = useState<Record<string, string>>({});
  return <div className="app-shell"><ConteoDiarioPanel backLabel="Inicio" onBack={() => {}} emptyIcon={null} emptyText="x"
    plantilla={"Papas a la francesa (kg): \nPapas crisscut (kg): "} insumos={insumos} proveedores={proveedores} months={months} monthKeys={["2026-10"]} initialMonthKey="2026-10" initialWeekIndex={1}
    textos={textos} onGuardar={(f, t) => setTextos((x) => ({ ...x, [f]: t }))} pedidos={{}} onGuardarPedido={() => {}} /></div>;
}
createRoot(document.getElementById("root")!).render(<App />);
