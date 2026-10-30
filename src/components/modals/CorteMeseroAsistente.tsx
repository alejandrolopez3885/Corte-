import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { NumInput, SumInput } from "../ui";
import { money, round2, sumFromText, uid } from "../../lib/dataModel";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import type { EmpleadoEntry, Gasto, GastoCategoria, MeseroCatalogEntry, MeseroCut, PropinaTipo } from "../../lib/types";
import type { MeseroFormValues } from "./MeseroModal";
import {
  FormularioGasto, ListaAgregados, MarcoAsistente, Opcion, etiquetaCategoria, faltaEnGasto, gastoEnBlanco, gastoSinLlenar, iniciales, ligasDeGasto,
  type BorradorGasto,
} from "./asistente";

// Corte de mesero paso por paso (como encuesta, con barra de avance): a
// quién, propina, venta del sistema, tarjetas, transferencias y gastos; al
// final el desglose con lo que tiene que entregar en efectivo y un cuadro
// para el efectivo recibido que solo calcula el cambio (no se guarda ni
// cambia el efectivo del día o de la semana). Cada gasto lleva el
// formulario completo (primero la categoría) con "Guardar otro gasto". Al
// final: "Hacer otro corte" (guarda y empieza otro) o "Guardar corte"
// (guarda y regresa al corte del día). Al editar un corte abre directo en
// el resultado, con "Cambiar" en cada dato.

interface GastoNuevo extends BorradorGasto {
  id: string;
  categoria: GastoCategoria;
}

type Paso = "mesero" | "cobro" | "propina" | "venta" | "tarjetas" | "transferencias" | "gastos";

const PROPINAS: { valor: PropinaTipo; texto: string }[] = [
  { valor: "p3", texto: "Sí, 3%" },
  { valor: "p2", texto: "Sí, 2%" },
  { valor: "manual", texto: "Sí, otra cantidad" },
  { valor: "none", texto: "No se cobra propina" },
];

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
  estadoAuto = false,
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
  estadoAuto?: boolean;
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
  const [g, setG] = useState<BorradorGasto>(gastoEnBlanco);
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

  const gastoVacio = gastoSinLlenar(g);
  // Agrega el gasto que se está llenando; false si le falta algo.
  function agregarGasto(): boolean {
    const falta = faltaEnGasto(g);
    if (falta) return setAvisoGasto(falta), false;
    setGastos((l) => [...l, { id: uid(), ...g, categoria: g.categoria as GastoCategoria, concepto: g.concepto.trim() }]);
    setG(gastoEnBlanco());
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
          ...ligasDeGasto(x),
        })),
        transferMonto: transferSum > 0 ? transferMonto : "",
        ...(esAcumulado ? { lecturaSistema: lectura, cobro: esParaLlevar ? cobro || undefined : undefined } : {}),
      },
      editing?.id,
      otro
    );
  }

  const opcion = (elegida: boolean, texto: ReactNode, alTocar: () => void, extra?: ReactNode) => (
    <Opcion elegida={elegida} onClick={alTocar} extra={extra}>
      {texto}
    </Opcion>
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
      ayuda: gastos.length || existingGastos.length ? undefined : "Si no tuvo gastos, toca No tuvo gastos.",
      contenido: (
        <>
          <ListaAgregados
            filas={[
              ...existingGastos.map((x) => ({ id: x.id, titulo: x.concepto, detalle: etiquetaCategoria(x.categoria), monto: x.total })),
              ...gastos.map((x) => ({
                id: x.id,
                titulo: x.concepto,
                detalle: `${etiquetaCategoria(x.categoria)}${x.estado === "ingresado" ? " · ingresado" : ""}`,
                monto: parseFloat(x.monto) || 0,
                onQuitar: () => setGastos((l) => l.filter((y) => y.id !== x.id)),
              })),
            ]}
          />
          <FormularioGasto g={g} setG={setG} catalog={catalog} empleados={empleados} historial={historial} meseroCancelacion={meseroId} estadoAuto={estadoAuto} aviso={avisoGasto} />
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

  const pie = (
    <>
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
                {/* En gastos: sin nada llenado es "No tuvo gastos"; con algo, "Guardar y continuar". */}
                {actual !== "gastos" ? "Siguiente" : !gastoVacio ? "Guardar y continuar" : gastos.length ? "Siguiente" : "No tuvo gastos"}
                <ArrowRight size={19} />
              </button>
            </>
          )}
        </>
      )}
    </>
  );

  return (
    <MarcoAsistente
      titulo={editing ? `Corte de ${editing.nombre}` : "Hacer corte a mesero"}
      avance={enResultado ? "Resultado" : `Pregunta ${paso + 1} de ${totalPasos}`}
      porcentaje={porcentaje}
      clavePaso={enResultado ? "resultado" : paso}
      onClose={onClose}
      onDelete={onDelete}
      etiquetaEliminar="Eliminar corte"
      pie={pie}
    >
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
    </MarcoAsistente>
  );
}
