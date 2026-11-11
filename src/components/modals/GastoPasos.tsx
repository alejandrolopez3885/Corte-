import { useState } from "react";
import { ConceptoInput } from "../ConceptoInput";
import { NumInput } from "../ui";
import { GASTO_CATEGORIAS } from "../../lib/types";
import type { EmpleadoEntry, GastoCategoria, MeseroCatalogEntry } from "../../lib/types";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import { LIGABLES_A_EMPLEADO, Opcion, type BorradorGasto } from "./asistente";

type Paso = "concepto" | "monto" | "categoria" | "persona" | "estado";
type GastoCompleto = BorradorGasto & { categoria: GastoCategoria };

export function GastoPasos({ inicial, catalog, empleados, historial, meseroCancelacion, estadoAuto, onGuardar, onGuardarOtro, onCancelar }: {
  inicial: BorradorGasto;
  catalog: MeseroCatalogEntry[];
  empleados: EmpleadoEntry[];
  historial: NombreHistorial[];
  meseroCancelacion?: string;
  estadoAuto: boolean;
  onGuardar: (g: GastoCompleto) => void;
  onGuardarOtro?: (g: GastoCompleto) => void;
  onCancelar: () => void;
}) {
  const [g, setG] = useState(inicial);
  const [paso, setPaso] = useState<Paso>("concepto");
  const persona = !!g.categoria && (LIGABLES_A_EMPLEADO.has(g.categoria) || g.categoria === "cancelaciones");
  const pasos: Paso[] = ["concepto", "monto", "categoria", ...(persona ? ["persona" as const] : []), ...(!estadoAuto ? ["estado" as const] : [])];
  const i = pasos.indexOf(paso);
  const listo = paso === "concepto" ? !!g.concepto.trim() : paso === "monto" ? Number.isFinite(Number(g.monto)) && Number(g.monto) > 0 : paso === "categoria" ? !!g.categoria : true;
  function siguiente() {
    if (!listo) return;
    if (i === pasos.length - 1) {
      if (!g.categoria) return setPaso("categoria");
      onGuardar({ ...g, categoria: g.categoria, concepto: g.concepto.trim() });
    }
    else setPaso(pasos[i + 1]);
  }
  function guardarOtro() {
    if (!g.categoria) return setPaso("categoria");
    onGuardarOtro?.({ ...g, categoria: g.categoria, concepto: g.concepto.trim() });
  }
  return (
    <>
      <p className="ca-ayuda">Gasto · pregunta {i + 1} de {pasos.length}</p>
      {paso === "concepto" && <><h2 className="ca-pregunta">¿En qué se gastó?</h2><label className="ca-campo"><span>Concepto</span><ConceptoInput value={g.concepto} onChange={(v) => setG((x) => ({ ...x, concepto: v }))} historial={historial} placeholder="Ej. compra de hielo" /></label></>}
      {paso === "monto" && <><h2 className="ca-pregunta">¿Cuánto se gastó?</h2><label className="ca-campo"><span>Total</span><NumInput autoFocus value={g.monto} onChange={(e) => setG((x) => ({ ...x, monto: e.target.value }))} placeholder="$0.00" /></label></>}
      {paso === "categoria" && <><h2 className="ca-pregunta">¿Qué tipo de gasto es?</h2><div className="ca-opciones">{GASTO_CATEGORIAS.map((c) => <Opcion key={c.value} elegida={g.categoria === c.value} onClick={() => setG((x) => ({ ...x, categoria: c.value, meseroId: c.value === "cancelaciones" && !x.meseroId ? meseroCancelacion || "" : x.meseroId }))}>{c.label}</Opcion>)}</div></>}
      {paso === "persona" && <><h2 className="ca-pregunta">{g.categoria === "cancelaciones" ? "¿A quién se le cancela?" : "¿Para quién es el gasto?"}</h2><p className="ca-ayuda">Puedes dejarlo sin asignar.</p><label className="ca-campo"><span>Persona</span><select className="categoria-select" value={g.categoria === "cancelaciones" ? g.meseroId : g.empleadoId} onChange={(e) => { const id = e.target.value; setG((x) => g.categoria === "cancelaciones" ? { ...x, meseroId: id } : { ...x, empleadoId: id }); }}><option value="">Sin asignar</option>{(g.categoria === "cancelaciones" ? catalog : empleados).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label></>}
      {paso === "estado" && <><h2 className="ca-pregunta">¿Ya está ingresado?</h2><div className="ca-opciones"><Opcion elegida={g.estado === "pendiente"} onClick={() => setG((x) => ({ ...x, estado: "pendiente" }))}>No, pendiente</Opcion><Opcion elegida={g.estado === "ingresado"} onClick={() => setG((x) => ({ ...x, estado: "ingresado" }))}>Sí, ya está ingresado</Opcion></div></>}
      <div className="ca-gasto-pasos-botones">
        <button type="button" className="ca-boton secundario" onClick={() => i === 0 ? onCancelar() : setPaso(pasos[i - 1])}>Atrás</button>
        {i === pasos.length - 1 && onGuardarOtro && <button type="button" className="ca-boton secundario" disabled={!listo} onClick={guardarOtro}>Guardar otro gasto</button>}
        <button type="button" className="ca-boton" disabled={!listo} onClick={siguiente}>{i === pasos.length - 1 ? "Listo" : "Siguiente"}</button>
      </div>
    </>
  );
}
