import { useEffect, useRef, type ReactNode } from "react";
import { Check, Paperclip, Trash2, X } from "lucide-react";
import { NumInput, Toggle } from "../ui";
import { ConceptoInput } from "../ConceptoInput";
import { money } from "../../lib/dataModel";
import { GASTO_CATEGORIAS } from "../../lib/types";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import type { EmpleadoEntry, GastoCategoria, GastoEstado, MeseroCatalogEntry, MeseroCut } from "../../lib/types";

// Piezas compartidas de los formularios paso por paso (corte de mesero,
// gasto y transferencia): el marco con la barra de avance, las opciones
// grandes, el formulario completo de un gasto y la pregunta "¿Se rebaja de
// algún corte?".

export const iniciales = (n: string) =>
  n
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function Opcion({ elegida, onClick, children, extra }: { elegida: boolean; onClick: () => void; children: ReactNode; extra?: ReactNode }) {
  return (
    <button type="button" className={`ca-opcion ${elegida ? "elegida" : ""}`} onClick={onClick}>
      {extra}
      <span>{children}</span>
      {elegida && <Check size={20} className="ca-check" />}
    </button>
  );
}

// Pantalla completa con barra de avance. En iPad/iPhone el teclado tapa la
// parte de abajo sin cambiar el alto de la página: se ajusta a lo visible
// para poder bajar hasta el final y que los botones queden arriba del
// teclado. Cada pregunta (clavePaso) empieza desde arriba.
export function MarcoAsistente({
  titulo,
  avance,
  porcentaje,
  clavePaso,
  onClose,
  onDelete,
  etiquetaEliminar = "Eliminar",
  pie,
  children,
}: {
  titulo: string;
  avance: string;
  porcentaje: number;
  clavePaso: string | number;
  onClose: () => void;
  onDelete?: () => void;
  etiquetaEliminar?: string;
  pie: ReactNode;
  children: ReactNode;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const cuerpo = useRef<HTMLElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = raiz.current;
    if (!vv || !el) return;
    const ajustar = () => {
      el.style.height = `${vv.height}px`;
      el.style.top = `${vv.offsetTop}px`;
    };
    ajustar();
    vv.addEventListener("resize", ajustar);
    vv.addEventListener("scroll", ajustar);
    return () => {
      vv.removeEventListener("resize", ajustar);
      vv.removeEventListener("scroll", ajustar);
    };
  }, []);
  useEffect(() => {
    cuerpo.current?.scrollTo(0, 0);
  }, [clavePaso]);

  return (
    <div className="ca" ref={raiz}>
      <header className="ca-barra">
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
          <X size={20} />
        </button>
        <h3>{titulo}</h3>
        {onDelete ? (
          <button type="button" className="icon-btn" aria-label={etiquetaEliminar} onClick={onDelete}>
            <Trash2 size={18} />
          </button>
        ) : (
          <span className="ca-espacio" />
        )}
      </header>
      <div className="ca-progreso">
        <div>
          <span>{avance}</span>
          <b>{porcentaje}%</b>
        </div>
        <div className="ca-barra-avance">
          <i style={{ width: `${porcentaje}%` }} />
        </div>
      </div>
      <main className="ca-cuerpo" ref={cuerpo}>
        <div className="ca-cuerpo-interior">
          {children}
          {/* Espacio real al final (Safari no cuenta el padding al bajar): siempre se puede subir lo último a la vista. */}
          <div className="ca-espacio-final" aria-hidden="true" />
        </div>
      </main>
      <footer className="ca-pie">{pie}</footer>
    </div>
  );
}

// --- Gasto ---

export interface BorradorGasto {
  categoria: GastoCategoria | "";
  concepto: string;
  monto: string;
  estado: GastoEstado;
  empleadoId: string;
  meseroId: string;
}

export const gastoEnBlanco = (): BorradorGasto => ({ categoria: "", concepto: "", monto: "", estado: "pendiente", empleadoId: "", meseroId: "" });
export const gastoSinLlenar = (g: BorradorGasto) => !g.categoria && !g.concepto.trim() && !g.monto.trim();
// Qué le falta al gasto ("" si está completo).
export const faltaEnGasto = (g: BorradorGasto) =>
  !g.categoria ? "Primero elige la categoría." : !g.concepto.trim() ? "Escribe el concepto." : !(parseFloat(g.monto) > 0) ? "Escribe el total del gasto." : "";

// Igual que en el formulario de gasto de siempre (GastoModal).
export const LIGABLES_A_EMPLEADO = new Set<GastoCategoria>(["nomina", "comida_empleado"]);
export const etiquetaCategoria = (c?: GastoCategoria) => GASTO_CATEGORIAS.find((x) => x.value === c)?.label || "Sin categoría";

// Lo que se guarda de quién (solo en las categorías que aplican).
export const ligasDeGasto = (g: BorradorGasto) => ({
  empleadoId: g.categoria && LIGABLES_A_EMPLEADO.has(g.categoria) ? g.empleadoId || undefined : undefined,
  meseroId: g.categoria === "cancelaciones" ? g.meseroId || undefined : undefined,
});

// Formulario completo de un gasto: primero la categoría, luego concepto,
// total, a quién (si aplica), comprobante (próximamente) e ingresado.
// meseroCancelacion: el mesero que se pone solo al elegir Cancelaciones.
export function FormularioGasto({
  g,
  setG,
  catalog,
  empleados,
  historial,
  meseroCancelacion,
  aviso,
}: {
  g: BorradorGasto;
  setG: (f: (g: BorradorGasto) => BorradorGasto) => void;
  catalog: MeseroCatalogEntry[];
  empleados: EmpleadoEntry[];
  historial: NombreHistorial[];
  meseroCancelacion?: string;
  aviso?: string;
}) {
  return (
    <>
      <span className="ca-etiqueta">Categoría</span>
      <div className="ca-categorias">
        {GASTO_CATEGORIAS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={g.categoria === c.value ? "elegida" : ""}
            onClick={() => setG((x) => ({ ...x, categoria: c.value, meseroId: c.value === "cancelaciones" && !x.meseroId ? meseroCancelacion || "" : x.meseroId }))}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label className="ca-campo">
        <span>Concepto</span>
        <ConceptoInput value={g.concepto} onChange={(val) => setG((x) => ({ ...x, concepto: val }))} historial={historial} placeholder="Ej. compra de hielo" />
      </label>
      <label className="ca-campo">
        <span>Total</span>
        <NumInput value={g.monto} onChange={(e) => setG((x) => ({ ...x, monto: e.target.value }))} placeholder="$0.00" />
      </label>
      {g.categoria && LIGABLES_A_EMPLEADO.has(g.categoria) && (
        <label className="ca-campo">
          <span>¿Para quién? (opcional)</span>
          <select className="categoria-select" value={g.empleadoId} onChange={(e) => setG((x) => ({ ...x, empleadoId: e.target.value }))}>
            <option value="">Sin asignar</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {g.categoria === "cancelaciones" && (
        <label className="ca-campo">
          <span>¿A quién se le cancela? (opcional)</span>
          <select className="categoria-select" value={g.meseroId} onChange={(e) => setG((x) => ({ ...x, meseroId: e.target.value }))}>
            <option value="">Sin asignar</option>
            {catalog.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* Comprobante del gasto: todavía no disponible. */}
      <button type="button" className="ca-comprobante" disabled>
        <Paperclip size={17} /> Subir comprobante <small>Próximamente</small>
      </button>
      <Toggle
        checked={g.estado === "ingresado"}
        disabled={!g.categoria}
        onChange={(on) => setG((x) => ({ ...x, estado: on ? "ingresado" : "pendiente" }))}
        label="Ya está ingresado"
      />
      {aviso && <p className="aviso-faltante">{aviso}</p>}
    </>
  );
}

// Lista de lo ya agregado (gastos o transferencias), con ✕ para quitar.
export function ListaAgregados({ filas }: { filas: { id: string; titulo: string; detalle?: string; monto: number; onQuitar?: () => void }[] }) {
  if (!filas.length) return null;
  return (
    <div className="ca-gastos-lista">
      {filas.map((f) => (
        <div key={f.id} className="ca-gasto-ya">
          <span>
            {f.titulo}
            {f.detalle && <small>{f.detalle}</small>}
          </span>
          <b>{money(f.monto)}</b>
          {f.onQuitar ? (
            <button type="button" className="icon-btn" aria-label="Quitar" onClick={f.onQuitar}>
              <X size={15} />
            </button>
          ) : (
            <i />
          )}
        </div>
      ))}
    </div>
  );
}

// "¿Se rebaja de algún corte?": los cortes de meseros del día o "No".
// valor: id del corte, "" = no (general), null = sin contestar. Con fondo
// (turno 1), la primera opción es "Con el fondo" y cuánto queda.
export function PreguntaCorte({
  cortes,
  valor,
  onElegir,
  textoNo,
  fondo,
}: {
  cortes: MeseroCut[];
  valor: string | null;
  onElegir: (id: string) => void;
  textoNo: string;
  fondo?: { valor: string; queda: number };
}) {
  return (
    <div className="ca-opciones">
      {fondo && (
        <Opcion elegida={valor === fondo.valor} onClick={() => onElegir(fondo.valor)} extra={<span className="ca-avatar fondo">$</span>}>
          Con el fondo que se dejó ayer
          <small className="ca-sub">Quedan {money(fondo.queda)}</small>
        </Opcion>
      )}
      {cortes.map((c) => (
        <Opcion key={c.id} elegida={valor === c.id} onClick={() => onElegir(c.id)} extra={<span className="ca-avatar">{iniciales(c.nombre)}</span>}>
          Sí, del corte de {c.nombre}
          <small className="ca-sub">Entrega {money(c.total)}</small>
        </Opcion>
      ))}
      <Opcion elegida={valor === ""} onClick={() => onElegir("")}>
        {textoNo}
      </Opcion>
    </div>
  );
}
