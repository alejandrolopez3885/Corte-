import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Trash2, X } from "lucide-react";
import { NumInput, SumInput, Toggle } from "../ui";
import { ConceptoInput } from "../ConceptoInput";
import { money, round2, sumFromText, uid } from "../../lib/dataModel";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import { GASTO_CATEGORIAS } from "../../lib/types";
import type { EmpleadoEntry, Gasto, GastoCategoria, GastoEstado, MeseroCatalogEntry, MeseroCut, PropinaTipo } from "../../lib/types";
import type { MeseroFormValues } from "./MeseroModal";

// Corte de mesero paso por paso (como encuesta, con barra de avance): a
// quién, propina, venta del sistema, tarjetas, transferencias y gastos; al
// final el desglose con lo que tiene que entregar en efectivo y un cuadro
// para el efectivo recibido que solo calcula el cambio (no se guarda ni
// cambia el efectivo del día o de la semana). Cada gasto lleva el
// formulario completo (primero la categoría) con "Guardar otro gasto". Al
// final: "Hacer otro corte" (guarda y empieza otro) o "Guardar corte"
// (guarda y regresa al corte del día). Al editar un corte abre directo en
// el resultado, con "Cambiar" en cada dato.

interface GastoNuevo {
  id: string;
  categoria: GastoCategoria;
  concepto: string;
  monto: string;
  estado: GastoEstado;
  empleadoId: string;
  meseroId: string;
}

// Igual que en el formulario de gasto (GastoModal).
const LIGABLES_A_EMPLEADO = new Set<GastoCategoria>(["nomina", "comida_empleado"]);
const etiquetaCategoria = (c?: GastoCategoria) => GASTO_CATEGORIAS.find((x) => x.value === c)?.label || "Sin categoría";

type Paso = "mesero" | "cobro" | "propina" | "venta" | "tarjetas" | "transferencias" | "gastos";

const PROPINAS: { valor: PropinaTipo; texto: string }[] = [
  { valor: "p3", texto: "Sí, 3%" },
  { valor: "p2", texto: "Sí, 2%" },
  { valor: "manual", texto: "Sí, otra cantidad" },
  { valor: "none", texto: "No se cobra propina" },
];

const iniciales = (n: string) =>
  n
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function CorteMeseroAsistente({
  onClose,
  onSave,
  onDelete,
  editing,
  catalog,
  empleados,
  existingGastos,
  historial,
  cortesDelDia = [],
  turnos = false,
}: {
  onClose: () => void;
  // otro: guardar y empezar otro corte en vez de regresar al corte del día.
  onSave: (form: MeseroFormValues, editingId?: string, otro?: boolean) => void;
  onDelete?: () => void;
  editing?: MeseroCut;
  catalog: MeseroCatalogEntry[];
  empleados: EmpleadoEntry[];
  existingGastos: Gasto[];
  historial: NombreHistorial[];
  cortesDelDia?: MeseroCut[];
  turnos?: boolean;
}) {
  const [meseroId, setMeseroId] = useState(editing?.meseroId || "");
  const [nombre, setNombre] = useState(editing?.nombre || "");
  const [propinaTipo, setPropinaTipo] = useState<PropinaTipo | null>(
    editing ? editing.propinaTipo || (editing.aplicaPropina ? "p3" : "none") : null
  );
  const [manualPropina, setManualPropina] = useState(editing?.propinaTipo === "manual" ? String(editing.propina) : "");
  const [venta, setVenta] = useState(editing ? String(editing.lecturaSistema !== undefined ? editing.lecturaSistema : editing.venta) : "");
  const [cobro, setCobro] = useState(editing?.cobro || "");
  const [tarjetas, setTarjetas] = useState(editing ? String(editing.tarjetas) : "");
  const [tarjetasDesglose, setTarjetasDesglose] = useState<number[] | undefined>(editing?.tarjetasDesglose);
  const [transferMonto, setTransferMonto] = useState(editing ? String(editing.transferencia || 0) : "");
  const [transferDesglose, setTransferDesglose] = useState<number[] | undefined>(editing?.transferenciaDesglose);
  const [gastos, setGastos] = useState<GastoNuevo[]>([]);
  // El gasto que se está llenando (se agrega con "Guardar otro gasto" o "Siguiente").
  const vacio = { categoria: "" as GastoCategoria | "", concepto: "", monto: "", estado: "pendiente" as GastoEstado, empleadoId: "", meseroId: "" };
  const [g, setG] = useState(vacio);
  const [avisoGasto, setAvisoGasto] = useState("");
  const [recibido, setRecibido] = useState("");
  // Al editar se empieza en el resultado; "Cambiar" lleva a un paso y regresa.
  const [paso, setPaso] = useState(0);
  const [enResultado, setEnResultado] = useState(!!editing);
  const [desdeResultado, setDesdeResultado] = useState(false);

  // Mismo cálculo que el corte de siempre (MeseroModal): usuarios acumulados
  // ("Para llevar" y los del corte de apertura) capturan la lectura del día.
  const esParaLlevar = turnos && !!catalog.find((c) => c.id === meseroId)?.acumulado;
  const idxEditing = editing ? cortesDelDia.findIndex((m) => m.id === editing.id) : -1;
  const previos = cortesDelDia.filter(
    (m, i) => m.meseroId === meseroId && m.lecturaSistema !== undefined && m.id !== editing?.id && (idxEditing < 0 || i < idxEditing)
  );
  const esAcumulado = turnos && (esParaLlevar || previos.length > 0 || editing?.lecturaSistema !== undefined);
  const lecturaPrevia = previos.length ? (previos[previos.length - 1].lecturaSistema as number) : 0;
  const lectura = parseFloat(venta) || 0;
  const v = esAcumulado ? round2(lectura - lecturaPrevia) : lectura;
  const t = sumFromText(tarjetas);
  const transferSum = sumFromText(transferMonto);
  const existingGastosSum = existingGastos.reduce((s, g) => s + g.total, 0);
  const gastosSum = round2(existingGastosSum + gastos.reduce((s, x) => s + (parseFloat(x.monto) || 0), 0));
  const tipoPropina: PropinaTipo = esParaLlevar ? "none" : propinaTipo || "none";
  const propina =
    tipoPropina === "p3" ? round2(v * 0.03) : tipoPropina === "p2" ? round2(v * 0.02) : tipoPropina === "manual" ? parseFloat(manualPropina) || 0 : 0;
  const total = round2(v - t - transferSum + propina - gastosSum);
  const rec = sumFromText(recibido);
  const diferencia = round2(rec - total);

  const pasos: Paso[] = ["mesero", ...(esParaLlevar ? (["cobro"] as Paso[]) : (["propina"] as Paso[])), "venta", "tarjetas", "transferencias", "gastos"];
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const totalPasos = pasos.length;
  const porcentaje = enResultado ? 100 : Math.round((paso / totalPasos) * 100);

  const listo: Record<Paso, boolean> = {
    mesero: !!meseroId,
    cobro: true,
    propina: !!propinaTipo && (propinaTipo !== "manual" || manualPropina.trim() !== ""),
    venta: venta.trim() !== "",
    // El campo de montos se suma al salir de él; vacío cuenta como $0.
    tarjetas: true,
    transferencias: true,
    gastos: true,
  };

  const gastoVacio = !g.categoria && !g.concepto.trim() && !g.monto.trim();
  // Agrega el gasto que se está llenando; false si le falta algo.
  function agregarGasto(): boolean {
    if (!g.categoria) return setAvisoGasto("Primero elige la categoría."), false;
    if (!g.concepto.trim()) return setAvisoGasto("Escribe el concepto."), false;
    if (!(parseFloat(g.monto) > 0)) return setAvisoGasto("Escribe el total del gasto."), false;
    setGastos((l) => [...l, { id: uid(), ...g, categoria: g.categoria as GastoCategoria, concepto: g.concepto.trim() }]);
    setG(vacio);
    setAvisoGasto("");
    return true;
  }

  function siguiente() {
    // En gastos: lo que se dejó llenado se agrega solo; a medias no deja seguir.
    if (!enResultado && actual === "gastos" && !gastoVacio && !agregarGasto()) return;
    if (desdeResultado || paso >= totalPasos - 1) {
      setDesdeResultado(false);
      setEnResultado(true);
      return;
    }
    setPaso(paso + 1);
  }
  function atras() {
    if (enResultado) {
      setEnResultado(false);
      setPaso(totalPasos - 1);
      return;
    }
    if (paso === 0) onClose();
    else setPaso(paso - 1);
  }
  function irA(p: Paso) {
    setPaso(pasos.indexOf(p));
    setDesdeResultado(true);
    setEnResultado(false);
  }
  // Botón "No trae / No tiene": deja 0 y avanza.
  function ninguno(fijar: () => void) {
    fijar();
    setTimeout(siguiente, 0);
  }

  function guardar(otro = false) {
    onSave(
      {
        meseroId,
        nombre,
        propinaTipo: tipoPropina,
        manualPropina,
        venta,
        tarjetas,
        tarjetasDesglose,
        transferDesglose: transferSum > 0 ? transferDesglose : undefined,
        gastos: gastos.map((x) => ({
          concepto: x.concepto,
          monto: x.monto,
          categoria: x.categoria,
          estado: x.estado,
          ...(LIGABLES_A_EMPLEADO.has(x.categoria) && x.empleadoId ? { empleadoId: x.empleadoId } : {}),
          ...(x.categoria === "cancelaciones" && x.meseroId ? { meseroId: x.meseroId } : {}),
        })),
        transferMonto: transferSum > 0 ? transferMonto : "",
        ...(esAcumulado ? { lecturaSistema: lectura, cobro: esParaLlevar ? cobro || undefined : undefined } : {}),
      },
      editing?.id,
      otro
    );
  }

  const opcion = (elegida: boolean, texto: ReactNode, alTocar: () => void, extra?: ReactNode) => (
    <button type="button" className={`ca-opcion ${elegida ? "elegida" : ""}`} onClick={alTocar}>
      {extra}
      <span>{texto}</span>
      {elegida && <Check size={20} className="ca-check" />}
    </button>
  );

  const yaConCorte = new Set(cortesDelDia.filter((m) => m.id !== editing?.id).map((m) => m.meseroId));

  const preguntas: Record<Paso, { titulo: string; ayuda?: string; contenido: ReactNode }> = {
    mesero: {
      titulo: "¿A quién se le hace corte?",
      ayuda: "Toca su nombre.",
      contenido:
        catalog.length === 0 ? (
          <p className="hint">Aún no tienes meseros en tu lista. Pide al encargado que los agregue.</p>
        ) : (
          <div className="ca-opciones">
            {catalog.map((c) =>
              opcion(
                meseroId === c.id,
                <>
                  {c.nombre}
                  {yaConCorte.has(c.id) && <small>{c.acumulado ? "Ya hay corte hoy: se resta lo ya cortado" : "Ya tiene un corte hoy"}</small>}
                </>,
                () => {
                  setMeseroId(c.id);
                  setNombre(c.nombre);
                },
                <span className="ca-avatar">{iniciales(c.nombre)}</span>
              )
            )}
          </div>
        ),
    },
    cobro: {
      titulo: "¿Quién cobró este turno?",
      ayuda: `${nombre} es el usuario de para llevar: no lleva propina.`,
      contenido: (
        <div className="ca-opciones">
          {catalog
            .filter((c) => !c.acumulado)
            .map((c) => opcion(cobro === c.nombre, c.nombre, () => setCobro(c.nombre), <span className="ca-avatar">{iniciales(c.nombre)}</span>))}
          {opcion(cobro === "", "No sé / nadie en especial", () => setCobro(""))}
        </div>
      ),
    },
    propina: {
      titulo: "¿Se cobra propina?",
      contenido: (
        <div className="ca-opciones">
          {PROPINAS.map((p) => opcion(propinaTipo === p.valor, p.texto, () => setPropinaTipo(p.valor)))}
          {propinaTipo === "manual" && (
            <label className="ca-campo">
              <span>¿Cuánto de propina?</span>
              <NumInput autoFocus value={manualPropina} onChange={(e) => setManualPropina(e.target.value)} placeholder="$0.00" />
            </label>
          )}
        </div>
      ),
    },
    venta: {
      titulo: esAcumulado ? "¿Cuánto marca el sistema en todo el día?" : "¿Cuánto vendió en el sistema?",
      ayuda: esAcumulado ? "La venta total del día que marca el sistema; se resta lo ya cortado." : "El total de venta que marca el sistema.",
      contenido: (
        <>
          <NumInput className="num-input ca-grande" autoFocus value={venta} onChange={(e) => setVenta(e.target.value)} placeholder="$0.00" />
          {esAcumulado && venta && (
            <div className={`acumulado-calculo${v < 0 ? " negativo" : ""}`}>
              {previos.length > 0 ? (
                <>
                  Ya se cortaron hoy <strong>{money(lecturaPrevia)}</strong>
                  <br />
                  Este corte: <strong>{money(v)}</strong>
                  {v < 0 && " — es menor que lo ya cortado, revisa la lectura."}
                </>
              ) : (
                <>
                  Primer corte del día de {nombre}: <strong>{money(v)}</strong>
                </>
              )}
            </div>
          )}
        </>
      ),
    },
    tarjetas: {
      titulo: "¿Cuánto trae en tarjetas?",
      ayuda: "Si son varios vouchers, súmalos con + (300+450).",
      contenido: (
        <>
          <div className="ca-grande-suma">
            <SumInput value={tarjetas} onChange={setTarjetas} onPartes={setTarjetasDesglose} placeholder="$0.00 o 300+450" sumar />
          </div>
          <button type="button" className="ca-ninguno" onClick={() => ninguno(() => setTarjetas("0"))}>
            No trae tarjetas
          </button>
        </>
      ),
    },
    transferencias: {
      titulo: "¿Tiene transferencias?",
      ayuda: `Se agregan a Transferencias a nombre de ${nombre || "este mesero"}.`,
      contenido: (
        <>
          <div className="ca-grande-suma">
            <SumInput value={transferMonto} onChange={setTransferMonto} onPartes={setTransferDesglose} placeholder="$0.00 o 300+450" sumar />
          </div>
          <button type="button" className="ca-ninguno" onClick={() => ninguno(() => setTransferMonto("0"))}>
            No tiene transferencias
          </button>
        </>
      ),
    },
    gastos: {
      titulo: gastos.length ? "¿Otro gasto?" : "¿Pagó algún gasto de su corte?",
      ayuda: gastos.length || existingGastos.length ? undefined : "Si no tuvo gastos, toca Siguiente.",
      contenido: (
        <>
          {(existingGastos.length > 0 || gastos.length > 0) && (
            <div className="ca-gastos-lista">
              {existingGastos.map((x) => (
                <div key={x.id} className="ca-gasto-ya">
                  <span>
                    {x.concepto}
                    <small>{etiquetaCategoria(x.categoria)}</small>
                  </span>
                  <b>{money(x.total)}</b>
                  <i />
                </div>
              ))}
              {gastos.map((x) => (
                <div key={x.id} className="ca-gasto-ya">
                  <span>
                    {x.concepto}
                    <small>
                      {etiquetaCategoria(x.categoria)}
                      {x.estado === "ingresado" ? " · ingresado" : ""}
                    </small>
                  </span>
                  <b>{money(parseFloat(x.monto) || 0)}</b>
                  <button type="button" className="icon-btn" aria-label="Quitar gasto" onClick={() => setGastos((l) => l.filter((y) => y.id !== x.id))}>
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <span className="ca-etiqueta">Categoría</span>
          <div className="ca-categorias">
            {GASTO_CATEGORIAS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={g.categoria === c.value ? "elegida" : ""}
                onClick={() => setG((x) => ({ ...x, categoria: c.value, meseroId: c.value === "cancelaciones" && !x.meseroId ? meseroId : x.meseroId }))}
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
          <Toggle
            checked={g.estado === "ingresado"}
            disabled={!g.categoria}
            onChange={(on) => setG((x) => ({ ...x, estado: on ? "ingresado" : "pendiente" }))}
            label="Ya está ingresado"
          />
          {avisoGasto && <p className="aviso-faltante">{avisoGasto}</p>}
        </>
      ),
    },
  };

  const filaResultado = (texto: string, monto: ReactNode, p?: Paso, clase = "") => (
    <div className={`ca-res-fila ${clase}`}>
      <span>{texto}</span>
      <b>{monto}</b>
      {p ? (
        <button type="button" onClick={() => irA(p)}>
          Cambiar
        </button>
      ) : (
        <i />
      )}
    </div>
  );
  const textoPropina = tipoPropina === "p3" ? "Propina 3%" : tipoPropina === "p2" ? "Propina 2%" : tipoPropina === "manual" ? "Propina" : "Sin propina";
  const pregunta = enResultado ? null : preguntas[actual];

  return (
    <div className="ca">
      <header className="ca-barra">
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
          <X size={20} />
        </button>
        <h3>{editing ? `Corte de ${editing.nombre}` : "Hacer corte a mesero"}</h3>
        {onDelete ? (
          <button type="button" className="icon-btn" aria-label="Eliminar corte" onClick={onDelete}>
            <Trash2 size={18} />
          </button>
        ) : (
          <span className="ca-espacio" />
        )}
      </header>
      <div className="ca-progreso">
        <div>
          <span>{enResultado ? "Resultado" : `Pregunta ${paso + 1} de ${totalPasos}`}</span>
          <b>{porcentaje}%</b>
        </div>
        <div className="ca-barra-avance">
          <i style={{ width: `${porcentaje}%` }} />
        </div>
      </div>

      <main className="ca-cuerpo">
        {pregunta && (
          <>
            <h2 className="ca-pregunta">{pregunta.titulo}</h2>
            {pregunta.ayuda && <p className="ca-ayuda">{pregunta.ayuda}</p>}
            {pregunta.contenido}
          </>
        )}
        {enResultado && (
          <>
            <h2 className="ca-pregunta">Corte de {nombre}</h2>
            <div className="ca-resultado">
              {filaResultado(esAcumulado ? "Venta de este corte" : "Venta en sistema", money(v), "venta")}
              {esParaLlevar
                ? filaResultado("Cobró", cobro || "—", "cobro")
                : filaResultado(textoPropina, `+${money(propina)}`, "propina")}
              {filaResultado("Tarjetas", `−${money(t)}`, "tarjetas")}
              {filaResultado("Transferencias", `−${money(transferSum)}`, "transferencias")}
              {filaResultado("Gastos", `−${money(gastosSum)}`, "gastos")}
              <div className="ca-res-total">
                <span>Efectivo a entregar</span>
                <b>{money(total)}</b>
              </div>
            </div>
            <label className="ca-campo">
              <span>Efectivo recibido</span>
              <NumInput className="num-input ca-grande" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder="$0.00" />
            </label>
            {recibido.trim() !== "" &&
              (diferencia > 0 ? (
                <div className="ca-cambio bien">
                  Dar cambio: <b>{money(diferencia)}</b>
                </div>
              ) : diferencia < 0 ? (
                <div className="ca-cambio mal">
                  Faltan: <b>{money(-diferencia)}</b>
                </div>
              ) : (
                <div className="ca-cambio bien">✓ Exacto, no hay cambio</div>
              ))}
            <p className="hint">El efectivo recibido es solo para calcular el cambio: no se guarda ni cambia el efectivo del día ni de la semana.</p>
          </>
        )}
      </main>

      <footer className="ca-pie">
        {desdeResultado && !enResultado ? (
          <button type="button" className="ca-boton" disabled={!listo[actual]} onClick={siguiente}>
            <Check size={19} /> Listo, volver al resultado
          </button>
        ) : (
          <>
            <button type="button" className="ca-boton secundario" onClick={atras}>
              <ArrowLeft size={19} /> Atrás
            </button>
            {enResultado ? (
              <>
                {!editing && (
                  <button type="button" className="ca-boton secundario ca-medio" disabled={!meseroId || !venta.trim()} onClick={() => guardar(true)}>
                    Hacer otro corte
                  </button>
                )}
                <button type="button" className="ca-boton" disabled={!meseroId || !venta.trim()} onClick={() => guardar()}>
                  <Check size={19} /> Guardar corte
                </button>
              </>
            ) : (
              <>
                {actual === "gastos" && (
                  <button type="button" className="ca-boton secundario ca-medio" disabled={gastoVacio} onClick={agregarGasto}>
                    Guardar otro gasto
                  </button>
                )}
                <button type="button" className="ca-boton" disabled={!listo[actual]} onClick={siguiente}>
                  Siguiente <ArrowRight size={19} />
                </button>
              </>
            )}
          </>
        )}
      </footer>
    </div>
  );
}
