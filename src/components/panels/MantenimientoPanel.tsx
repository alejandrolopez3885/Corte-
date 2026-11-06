import { useState } from "react";
import { ClipboardList, FolderOpen, Wrench } from "lucide-react";
import { TituloPagina } from "../BarraTitulo";
import { Field } from "../ui";
import { money, todayIso, uid } from "../../lib/dataModel";
import type { MantenimientoEntry } from "../../lib/types";
import type { SaveState } from "../../lib/useAppData";

const AREAS = ["Comedor", "Cocina", "Bar", "Terraza", "Baño hombres", "Baño mujeres"];
const PAGO = { pendiente: "Pendiente de pago", pagado: "Pagado", por_definir: "Por definir" } as const;
type Vista = "inicio" | "lista" | "detalle" | "formulario" | "revision";
type Borrador = Omit<MantenimientoEntry, "costo"> & { costoTexto: string; costoConocido: boolean };

function nuevoBorrador(): Borrador {
  return { id: uid(), area: "", equipo: "", fecha: todayIso(), descripcion: "", costoTexto: "", costoConocido: false, pago: "por_definir" };
}

export function MantenimientoPanel({ onBack, backLabel, registros, areasAdicionales, onGuardar, saveState, onReintentar }: {
  onBack?: () => void;
  backLabel: string;
  registros: MantenimientoEntry[];
  areasAdicionales: string[];
  onGuardar: (registro: MantenimientoEntry) => void;
  saveState: SaveState;
  onReintentar: () => void;
}) {
  const [vista, setVista] = useState<Vista>("inicio");
  const [paso, setPaso] = useState(1);
  const [borrador, setBorrador] = useState<Borrador>(nuevoBorrador);
  const [agregandoArea, setAgregandoArea] = useState(false);
  const [areaNueva, setAreaNueva] = useState("");
  const [error, setError] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [filtroArea, setFiltroArea] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const areas = [...new Set([...AREAS, ...areasAdicionales, ...registros.map((r) => r.area)])];
  const registro = registros.find((r) => r.id === seleccionado);

  function iniciar(entrada?: MantenimientoEntry) {
    setBorrador(entrada
      ? { ...entrada, costoTexto: entrada.costo === null ? "" : String(entrada.costo), costoConocido: entrada.costo !== null }
      : nuevoBorrador());
    setPaso(1);
    setError("");
    setAgregandoArea(false);
    setAreaNueva("");
    setVista("formulario");
  }

  function volver() {
    setError("");
    if (vista === "inicio") onBack?.();
    else if (vista === "lista") setVista("inicio");
    else if (vista === "detalle") setVista("lista");
    else if (vista === "revision") setVista("formulario");
    else if (paso > 1) setPaso(paso - 1);
    else setVista(registro ? "detalle" : "inicio");
  }

  function siguiente() {
    let mensaje = "";
    if (paso === 1 && agregandoArea) mensaje = "Confirma la nueva área con «Usar esta área».";
    else if (paso === 1 && !borrador.area.trim()) mensaje = "Elige un área o agrega una nueva.";
    if (paso === 2 && !borrador.equipo.trim()) mensaje = "Escribe el nombre del equipo.";
    if (paso === 3 && (!borrador.fecha || !borrador.descripcion.trim())) mensaje = "Escribe la fecha y describe el trabajo realizado.";
    if (paso === 4 && borrador.costoConocido && (!/^\d+(?:[.,]\d{1,2})?$/.test(borrador.costoTexto.trim()) || !Number.isFinite(Number(borrador.costoTexto.replace(",", "."))))) {
      mensaje = "Escribe un costo válido, con hasta dos decimales.";
    }
    if (mensaje) { setError(mensaje); return; }
    setError("");
    if (paso === 4) setVista("revision");
    else setPaso(paso + 1);
  }

  function guardar() {
    const { costoTexto, costoConocido, ...resto } = borrador;
    const entrada = { ...resto, area: resto.area.trim(), equipo: resto.equipo.trim(), descripcion: resto.descripcion.trim(), costo: costoConocido ? Number(costoTexto.replace(",", ".")) : null };
    onGuardar(entrada);
    setSeleccionado(entrada.id);
    setVista("detalle");
  }

  const filtrados = registros.filter((r) => (!filtroArea || r.area === filtroArea) && r.equipo.toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es")))
    .slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const titulo = vista === "lista" ? "Bitácora de mantenimiento" : vista === "detalle" ? "Detalle del mantenimiento" : "Mantenimiento";
  return (
    <div className="page-section mantenimiento">
      <TituloPagina titulo={titulo} onBack={vista === "inicio" ? onBack : volver} backLabel={vista === "inicio" ? backLabel : "Volver"} />
      {saveState === "saving" && <p className="hint" role="status">Guardando…</p>}
      {saveState === "saved" && vista === "detalle" && <p className="hint" role="status">Guardado.</p>}
      {saveState === "error" && <div className="inv-error" role="alert">No se pudo guardar. <button className="link-btn" onClick={onReintentar}>Reintentar</button></div>}
      {vista === "inicio" && <>
        <h2 className="ca-pregunta">¿Qué vas a hacer?</h2>
        <div className="menu-list">
          <button className="menu-item" onClick={() => { setSeleccionado(null); iniciar(); }}><span className="menu-item-icon"><ClipboardList size={20} /></span><span className="menu-item-text"><strong>Registrar mantenimiento</strong><span>Guarda los datos paso a paso</span></span></button>
          <button className="menu-item" onClick={() => setVista("lista")}><span className="menu-item-icon"><FolderOpen size={20} /></span><span className="menu-item-text"><strong>Consultar bitácora</strong><span>Historial por área y equipo</span></span></button>
        </div>
        <p className="mant-aviso">Los costos de la bitácora no se agregan a los gastos de la app.</p>
      </>}
      {vista === "lista" && <>
        <p className="hint">Consulta los trabajos por área y equipo.</p>
        <Field label="Área"><select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}><option value="">Todas las áreas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
        <Field label="Buscar equipo"><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre del equipo" /></Field>
        {filtrados.length === 0 ? <p className="hint">No hay mantenimientos para mostrar.</p> : <div className="menu-list">{filtrados.map((r) =>
          <button key={r.id} className="menu-item" onClick={() => { setSeleccionado(r.id); setVista("detalle"); }}><span className="menu-item-icon"><Wrench size={20} /></span><span className="menu-item-text"><strong>{r.equipo}</strong><span>{r.area} · {r.fecha} · {r.costo === null ? "Costo por definir" : money(r.costo)} · {PAGO[r.pago]}</span></span></button>
        )}</div>}
        <button className="btn-primary" onClick={() => { setSeleccionado(null); iniciar(); }}>Registrar mantenimiento</button>
      </>}
      {vista === "detalle" && registro && <>
        <h2 className="ca-pregunta">{registro.equipo}</h2><p className="hint">{registro.area} · {registro.fecha}</p>
        <div className="mant-resumen"><strong>Trabajo realizado</strong><p>{registro.descripcion}</p><p>Costo: {registro.costo === null ? "Por definir" : money(registro.costo)}</p><p>Pago: {PAGO[registro.pago]}</p></div>
        <p className="mant-aviso">El costo no se agrega a los gastos de la app.</p>
        <button className="btn-primary" onClick={() => iniciar(registro)}>Actualizar registro</button>
      </>}
      {vista === "formulario" && <>
        <p className="mant-paso">Registro · Paso {paso} de 4</p>
        <div className="ca-barra-avance" role="progressbar" aria-label="Progreso del registro" aria-valuemin={1} aria-valuemax={4} aria-valuenow={paso}><i style={{ width: `${paso * 25}%` }} /></div>
        {paso === 1 && <><h2 className="ca-pregunta">¿En qué área se hizo?</h2><p className="hint">Elige el lugar donde está el equipo.</p><div className="mant-areas">{areas.map((a) => <button key={a} className={`ca-opcion ${borrador.area === a ? "elegida" : ""}`} aria-pressed={borrador.area === a} onClick={() => setBorrador({ ...borrador, area: a })}>{a}</button>)}</div>
          {agregandoArea ? <><Field label="Nombre de la nueva área"><input value={areaNueva} onChange={(e) => setAreaNueva(e.target.value)} /></Field><button className="btn-secundario" onClick={() => {
            const nombre = areaNueva.trim();
            if (!nombre) { setError("Escribe el nombre del área."); return; }
            const existente = areas.find((a) => a.localeCompare(nombre, "es", { sensitivity: "base" }) === 0);
            setBorrador({ ...borrador, area: existente || nombre }); setAgregandoArea(false); setError("");
          }}>Usar esta área</button>{borrador.area && !areas.includes(borrador.area) && <p className="hint">Área seleccionada: {borrador.area}</p>}</> : <><button className="btn-secundario" onClick={() => setAgregandoArea(true)}>+ Agregar otra área</button>{borrador.area && !areas.includes(borrador.area) && <p className="hint">Área seleccionada: {borrador.area}</p>}</>}</>}
        {paso === 2 && <><h2 className="ca-pregunta">¿Qué equipo se atendió?</h2><p className="hint">Área: {borrador.area}</p><Field label="Nombre del equipo"><input value={borrador.equipo} onChange={(e) => setBorrador({ ...borrador, equipo: e.target.value })} /></Field></>}
        {paso === 3 && <><h2 className="ca-pregunta">¿Qué se hizo y cuándo?</h2><Field label="Fecha del mantenimiento"><input type="date" value={borrador.fecha} onChange={(e) => setBorrador({ ...borrador, fecha: e.target.value })} /></Field><Field label="Descripción del trabajo"><textarea rows={4} value={borrador.descripcion} onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} /></Field></>}
        {paso === 4 && <><h2 className="ca-pregunta">¿Cuál es el costo?</h2><p className="hint">Si aún no lo sabes, puedes registrarlo después.</p><div className="ca-opciones"><button className={`ca-opcion ${borrador.costoConocido ? "elegida" : ""}`} aria-pressed={borrador.costoConocido} onClick={() => setBorrador({ ...borrador, costoConocido: true })}>Ya conozco el costo</button><button className={`ca-opcion ${!borrador.costoConocido ? "elegida" : ""}`} aria-pressed={!borrador.costoConocido} onClick={() => setBorrador({ ...borrador, costoConocido: false })}>Costo por definir</button></div>
          {borrador.costoConocido && <Field label="Costo en pesos"><input type="text" inputMode="decimal" value={borrador.costoTexto} onChange={(e) => setBorrador({ ...borrador, costoTexto: e.target.value })} /></Field>}
          <span className="mant-label">Estado del pago</span><div className="ca-opciones">{(Object.keys(PAGO) as MantenimientoEntry["pago"][]).map((p) => <button key={p} className={`ca-opcion ${borrador.pago === p ? "elegida" : ""}`} aria-pressed={borrador.pago === p} onClick={() => setBorrador({ ...borrador, pago: p })}>{PAGO[p]}</button>)}</div><p className="mant-aviso">Es solo para control: no registra ni modifica gastos.</p></>}
        {error && <p className="inv-error" role="alert">{error}</p>}
        <button className="btn-primary" onClick={siguiente}>{paso === 4 ? "Revisar registro" : "Continuar"}</button>
      </>}
      {vista === "revision" && <><h2 className="ca-pregunta">Revisa el mantenimiento</h2><p className="hint">Confirma los datos antes de agregarlo a la bitácora.</p><div className="mant-resumen"><p>Área: <strong>{borrador.area}</strong></p><p>Equipo: <strong>{borrador.equipo}</strong></p><p>Fecha: <strong>{borrador.fecha}</strong></p><p>Trabajo: <strong>{borrador.descripcion}</strong></p><p>Costo: <strong>{borrador.costoConocido ? money(Number(borrador.costoTexto.replace(",", "."))) : "Por definir"}</strong></p><p>Pago: <strong>{PAGO[borrador.pago]}</strong></p></div><p className="mant-aviso">El costo no se agrega a los gastos de la app.</p><button className="btn-primary" onClick={guardar}>Guardar mantenimiento</button><button className="btn-secundario" onClick={() => setVista("formulario")}>Volver a editar</button></>}
    </div>
  );
}
