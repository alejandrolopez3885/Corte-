import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { pidePorOtraUnidad, sumFromText, todayIso, uid } from "../../lib/dataModel";
import { normalizar } from "../../lib/inventarioNotas";
import type { InsumoArea, InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";
import { MarcoAsistente, Opcion } from "./asistente";

type Paso = "nombre" | "area" | "unidad" | "proveedor" | "pedido" | "precio" | "rotacion" | "resumen" | "jueves";
const NUEVO = "__nuevo__";

export function InsumoAsistente({ areaInicial, nombreInicial = "", insumos, proveedores, inventarioJueves = false, onClose, onSave }: {
  areaInicial?: InsumoArea;
  nombreInicial?: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  inventarioJueves?: boolean;
  onClose: () => void;
  onSave: (entry: InsumoEntry, proveedor?: ProveedorCatalogEntry, incluirJueves?: boolean) => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [area, setArea] = useState<InsumoArea | "">(areaInicial || "");
  const [unidad, setUnidad] = useState("kg");
  const [presentacion, setPresentacion] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [proveedorNuevo, setProveedorNuevo] = useState("");
  const [unidadPedido, setUnidadPedido] = useState("");
  const [equivalencia, setEquivalencia] = useState("");
  const [precio, setPrecio] = useState("");
  const [altaRotacion, setAltaRotacion] = useState(false);
  const [incluirJueves, setIncluirJueves] = useState(false);
  const [paso, setPaso] = useState(0);
  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const proveedorValido = !proveedorId || proveedorId === NUEVO || !!proveedor;
  const advertirJueves = inventarioJueves && !altaRotacion && !proveedor?.incluyeJueves;
  const pasos: Paso[] = ["nombre", "area", "unidad", "proveedor", "pedido", "precio", ...(area !== "general" ? ["rotacion" as const] : []), "resumen", ...(advertirJueves ? ["jueves" as const] : [])];
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const nombreNormal = normalizar(nombre);
  const repetido = !!nombreNormal && insumos.some((i) =>
    (i.apodos || []).some((n) => normalizar(n) === nombreNormal) ||
    (normalizar(i.nombre) === nombreNormal && (!area || i.area === area)));
  const proveedorRepetido = proveedorId === NUEVO && proveedores.some((p) => [p.nombre, ...(p.apodos || [])].some((n) => normalizar(n) === normalizar(proveedorNuevo)));
  const unidadFinal = area === "bar" ? "pieza" : unidad;
  const requiereEquivalencia = pidePorOtraUnidad({ id: "", area: area || "general", nombre, unidad: unidadFinal, presentacion, unidadPedido });
  const numeroValido = (s: string) => !s.trim() || (/^\d+(?:[.,]\d+)?$/.test(s.trim()) && Number(s.replace(",", ".")) > 0);
  const listo = actual === "nombre" ? !!nombreNormal && !/[:\r\n]/.test(nombre) : actual === "area" ? !!area && !repetido
    : actual === "unidad" ? unidadFinal !== "pieza" || !/[:()\r\n]/.test(presentacion)
    : actual === "proveedor" ? proveedorValido && (proveedorId !== NUEVO || (!!normalizar(proveedorNuevo) && !proveedorRepetido))
    : actual === "pedido" ? numeroValido(equivalencia)
    : actual === "precio" ? numeroValido(precio) : actual === "resumen" || actual === "jueves" ? !!nombre.trim() && !!area && !repetido && proveedorValido && !proveedorRepetido : true;

  function guardar() {
    if (!area || !listo) return;
    const nuevo = proveedorId === NUEVO ? { id: uid(), nombre: proveedorNuevo.trim() } : undefined;
    const entry: InsumoEntry = {
      id: uid(), area, nombre: nombre.trim(), unidad: unidadFinal,
      proveedorId: nuevo?.id || proveedorId || undefined,
      presentacion: unidadFinal === "pieza" ? presentacion.trim() || undefined : undefined,
      unidadPedido: unidadPedido.trim() || undefined,
      equivalenciaPedido: requiereEquivalencia ? sumFromText(equivalencia.replace(",", ".")) || undefined : undefined,
      precio: sumFromText(precio.replace(",", ".")) || undefined,
      altaRotacion: area !== "general" && altaRotacion,
      ...(area !== "general" && altaRotacion ? { conteoDiarioDesde: todayIso() } : {}),
    };
    onSave(entry, nuevo, advertirJueves && incluirJueves && !!proveedorId);
  }
  const botones = <><button type="button" className="ca-boton secundario" onClick={() => paso ? setPaso(paso - 1) : onClose()}><ArrowLeft size={18} /> Atrás</button>
    <button type="button" className="ca-boton" disabled={!listo} onClick={() => paso === pasos.length - 1 ? guardar() : setPaso(paso + 1)}>{paso === pasos.length - 1 ? "Guardar producto" : "Siguiente"} {paso !== pasos.length - 1 && <ArrowRight size={18} />}</button></>;

  return <MarcoAsistente titulo="Nuevo producto" avance={actual === "resumen" ? "Revisar antes de guardar" : actual === "jueves" ? "Antes de guardar" : `Pregunta ${paso + 1} de ${pasos.length - (advertirJueves ? 2 : 1)}`} porcentaje={Math.round((paso + 1) / pasos.length * 100)} clavePaso={actual} onClose={onClose} pie={botones}>
    {actual === "nombre" && <><h2 className="ca-pregunta">¿Cómo se llama el producto?</h2><label className="ca-campo"><span>Nombre del producto</span><input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></label>{nombre.trim() && !listo && <p className="inv-error" role="alert">Escribe un nombre con letras o números y sin dos puntos.</p>}</>}
    {actual === "area" && <><h2 className="ca-pregunta">¿De qué área es?</h2><div className="ca-opciones">{(["bar", "cocina", "general"] as const).map((a) => <Opcion key={a} elegida={area === a} onClick={() => { setArea(a); if (a === "general") setAltaRotacion(false); }}>{a === "bar" ? "Bar" : a === "cocina" ? "Cocina" : "General"}</Opcion>)}</div>{repetido && <p className="inv-error" role="alert">Este nombre ya se usa en el catálogo o como apodo. Revisa el producto existente.</p>}</>}
    {actual === "unidad" && <><h2 className="ca-pregunta">¿Cómo lo cuentas?</h2><div className="ca-opciones">{area !== "bar" && <Opcion elegida={unidadFinal === "kg"} onClick={() => setUnidad("kg")}>Kilogramos</Opcion>}<Opcion elegida={unidadFinal === "pieza"} onClick={() => setUnidad("pieza")}>Pieza</Opcion></div>{unidadFinal === "pieza" && <label className="ca-campo"><span>Presentación para contar (opcional)</span><input className="text-input" value={presentacion} onChange={(e) => setPresentacion(e.target.value)} placeholder="Ej. botella, caja o bolsa" /></label>}{!listo && <p className="inv-error" role="alert">Escribe la presentación sin paréntesis ni dos puntos.</p>}</>}
    {actual === "proveedor" && <><h2 className="ca-pregunta">¿Quién lo surte?</h2><label className="ca-campo"><span>Proveedor</span><select aria-label="Proveedor" className="text-input" value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setIncluirJueves(false); }}><option value="">Sin proveedor</option>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}<option value={NUEVO}>+ Agregar proveedor</option></select></label>{proveedorId === NUEVO && <label className="ca-campo"><span>Nombre del nuevo proveedor</span><input className="text-input" value={proveedorNuevo} onChange={(e) => setProveedorNuevo(e.target.value)} /></label>}{proveedorRepetido && <p className="inv-error" role="alert">Este proveedor ya existe. Selecciónalo de la lista.</p>}</>}
    {actual === "pedido" && <><h2 className="ca-pregunta">¿Cómo se pide?</h2><p className="ca-ayuda">Es opcional; puedes completarlo después.</p><label className="ca-campo"><span>Se pide por</span><input className="text-input" value={unidadPedido} onChange={(e) => setUnidadPedido(e.target.value)} placeholder="Ej. caja o bolsa" /></label>{requiereEquivalencia && <label className="ca-campo"><span>¿Cuánto trae 1 {unidadPedido.trim()}? ({unidadFinal === "kg" ? "kg" : presentacion || "piezas"})</span><input className="text-input" inputMode="decimal" value={equivalencia} onChange={(e) => setEquivalencia(e.target.value)} /></label>}{!numeroValido(equivalencia) && <p className="inv-error" role="alert">Escribe una cantidad mayor a cero o déjala vacía.</p>}</>}
    {actual === "precio" && <><h2 className="ca-pregunta">¿Cuál es su precio?</h2><p className="ca-ayuda">Es opcional.</p><label className="ca-campo"><span>Precio de referencia por {unidadPedido || presentacion || (unidadFinal === "kg" ? "kg" : "pieza")}</span><input className="text-input" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="$0.00" /></label>{!numeroValido(precio) && <p className="inv-error" role="alert">Escribe un precio mayor a cero o déjalo vacío.</p>}</>}
    {actual === "rotacion" && <><h2 className="ca-pregunta">¿Es de alta rotación?</h2><div className="ca-opciones"><Opcion elegida={altaRotacion} onClick={() => setAltaRotacion(true)}>Sí, es de alta rotación</Opcion><Opcion elegida={!altaRotacion} onClick={() => setAltaRotacion(false)}>No, es de inventario</Opcion></div>{altaRotacion && <p className="ca-ayuda">Este producto no se contará en Inventario. Se cuenta al final del turno en el Conteo diario de {area === "bar" ? "Bar" : "Cocina"}.</p>}</>}
    {actual === "resumen" && <><h2 className="ca-pregunta">¿Todo está bien?</h2><div className="ca-opciones"><p><b>{nombre}</b> · {area === "bar" ? "Bar" : area === "cocina" ? "Cocina" : "General"}</p><p>Se cuenta por: {unidadFinal === "kg" ? "kg" : presentacion || "pieza"}</p><p>Proveedor: {nuevoNombre(proveedorId, proveedorNuevo, proveedores)}</p><p>Se pide por: {unidadPedido || "sin definir"}{requiereEquivalencia && equivalencia ? ` · ${equivalencia}` : ""}</p><p>Precio: {precio || "sin definir"}</p>{area !== "general" && <p>Alta rotación: {altaRotacion ? "Sí · Conteo diario" : "No · Inventario"}</p>}</div></>}
    {actual === "jueves" && (proveedorId ? <><h2 className="ca-pregunta">¿Incluimos a este proveedor los jueves?</h2><p className="ca-ayuda"><b>{nombre} se guardará en el catálogo</b>, pero su proveedor no está incluido los jueves.</p><div className="ca-opciones"><Opcion elegida={!incluirJueves} onClick={() => setIncluirJueves(false)}>No, dejarlo fuera<small className="ca-sub">El producto no aparecerá en el conteo de hoy.</small></Opcion><Opcion elegida={incluirJueves} onClick={() => setIncluirJueves(true)}>Sí, incluir al proveedor<small className="ca-sub">Desde hoy se contarán sus productos habituales cada jueves.</small></Opcion></div><p className="ca-ayuda">También se incluirá en los pedidos de jueves. Los productos de alta rotación seguirán en su conteo diario.</p></> : <><h2 className="ca-pregunta">Este producto no se contará hoy</h2><p className="ca-ayuda">{nombre} se guardará en el catálogo, pero para contarlo los jueves necesita un proveedor incluido en el inventario de jueves.</p><button type="button" className="ca-boton secundario" onClick={() => setPaso(pasos.indexOf("proveedor"))}>Elegir proveedor</button></>)}
    {(actual === "resumen" || actual === "jueves") && !listo && <p className="inv-error" role="alert">El catálogo cambió. Regresa a revisar el nombre y el proveedor antes de guardar.</p>}
  </MarcoAsistente>;
}

function nuevoNombre(id: string, nuevo: string, proveedores: ProveedorCatalogEntry[]) {
  return id === NUEVO ? nuevo : proveedores.find((p) => p.id === id)?.nombre || "Sin proveedor";
}
