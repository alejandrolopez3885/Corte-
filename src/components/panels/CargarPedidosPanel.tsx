import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardPaste, TriangleAlert } from "lucide-react";
import { Field } from "../ui";
import { addDaysIso, formatWeekRange, pluralizarUnidad, todayIso } from "../../lib/dataModel";
import { lunesDe } from "../../lib/tendencias";
import { leerPedidosPegados, semanaDeLosMensajes, type PedidoCargado } from "../../lib/pedidosCargados";
import type { InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

export const SIN_PROVEEDOR = "sin-proveedor";

const fechaCorta = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
const fmt = (n: number) => String(Math.round(n * 100) / 100);
const diaHora = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }).replace(".", "");

// Pedidos (permiso "Pedidos"): se pegan los mensajes de WhatsApp de la
// semana, la app suma cada producto por proveedor y al guardar le aparece
// al dueño en Negocio > Pedidos.
export function CargarPedidosPanel({
  onBack,
  backLabel,
  insumos,
  proveedores,
  cargados,
  onGuardar,
  onAsignarApodo,
}: {
  // Sin onBack (cuenta de equipo con una sola sección) no hay "regresar".
  onBack?: () => void;
  backLabel: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  cargados: Record<string, Record<string, PedidoCargado>>;
  onGuardar: (lunes: string, porProveedor: Record<string, Record<string, number>>) => void;
  onAsignarApodo: (insumoId: string, apodo: string) => void;
}) {
  const estaSemana = lunesDe(todayIso());
  const [lunes, setLunes] = useState(estaSemana);
  const [texto, setTexto] = useState("");
  const [leido, setLeido] = useState(false);
  const [guardado, setGuardado] = useState<number | null>(null);

  // Las fechas de WhatsApp dicen de qué semana son los mensajes.
  const detectada = useMemo(() => (leido ? semanaDeLosMensajes(texto) : null), [leido, texto]);
  const opciones = [estaSemana, addDaysIso(estaSemana, -7)];
  if (detectada && !opciones.includes(detectada.lunes)) opciones.push(detectada.lunes);
  const lectura = useMemo(() => (leido ? leerPedidosPegados(texto, insumos) : null), [leido, texto, insumos]);
  const nombreProv = (id: string) => proveedores.find((p) => p.id === id)?.nombre || "Sin proveedor";
  const yaCargados = cargados[lunes] || {};
  const ordenAlfa = [...insumos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  function guardar() {
    if (!lectura) return;
    const porProveedor: Record<string, Record<string, number>> = {};
    lectura.porProveedor.forEach((g) => {
      const k = g.proveedorId || SIN_PROVEEDOR;
      porProveedor[k] = Object.fromEntries(g.productos.map((p) => [p.clave, p.total]));
    });
    onGuardar(lunes, porProveedor);
    setGuardado(lectura.porProveedor.length);
    setTexto("");
    setLeido(false);
  }

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <h2 className="page-title">Pedidos</h2>
      <Field label="Semana">
        <select
          className="text-input"
          value={lunes}
          onChange={(e) => {
            setLunes(e.target.value);
            setGuardado(null);
          }}
        >
          {opciones.map((l) => (
            <option key={l} value={l}>
              {l === estaSemana ? "Esta semana · " : l === addDaysIso(estaSemana, -7) ? "Semana pasada · " : ""}
              {formatWeekRange(l)}
            </option>
          ))}
        </select>
      </Field>

      {guardado !== null && (
        <p className="importar-listo">
          ✓ Se guardaron los pedidos de {guardado} {guardado === 1 ? "proveedor" : "proveedores"}. Ya los ve el dueño en Pedidos.
        </p>
      )}

      {Object.keys(yaCargados).length > 0 && !leido && (
        <div className="cp-cargados">
          <strong>Ya cargados esta semana</strong>
          {Object.entries(yaCargados).map(([provId, c]) => (
            <span key={provId}>
              ✓ {provId === SIN_PROVEEDOR ? "Sin proveedor" : nombreProv(provId)} · {Object.keys(c.cantidades).length} productos · {c.por}, {diaHora(c.en)}
            </span>
          ))}
          <small>Si vuelves a pegar los de un proveedor, se reemplazan.</small>
        </div>
      )}

      {!leido ? (
        <>
          <textarea
            className="text-input cp-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Pega aquí los mensajes de pedidos…\n\nApodaca\n1 caja de francesa\n2 bolsas de elotes\n5kg carne molida"}
          />
          <p className="hint">
            En WhatsApp selecciona todos los mensajes de pedidos de la semana, cópialos y pégalos aquí. No importa si van mezclados los
            proveedores: la app los separa y suma cada producto.
          </p>
          <button
            className="btn-primary"
            disabled={!texto.trim()}
            onClick={() => {
              setLeido(true);
              const s = semanaDeLosMensajes(texto);
              if (s) setLunes(s.lunes);
            }}
          >
            <ClipboardPaste size={16} /> Leer y sumar
          </button>
        </>
      ) : (
        lectura && (
          <>
            {detectada && (
              <p className="hint">
                Mensajes del {fechaCorta(detectada.desde)} al {fechaCorta(detectada.hasta)}: se guardan en la semana del{" "}
                {formatWeekRange(detectada.lunes)}.
              </p>
            )}
            {lectura.noReconocidos.length > 0 && (
              <div className="cp-sin">
                <strong>
                  <TriangleAlert size={14} /> {lectura.noReconocidos.length}{" "}
                  {lectura.noReconocidos.length === 1 ? "producto sin reconocer" : "productos sin reconocer"}
                </strong>
                {lectura.noReconocidos.map((r, i) => (
                  <label key={`${r.linea}-${i}`} className="cp-sin-fila">
                    <span>“{r.linea}”</span>
                    <select
                      className="importar-area"
                      value=""
                      onChange={(e) => e.target.value && onAsignarApodo(e.target.value, r.texto)}
                    >
                      <option value="">¿Qué producto es?</option>
                      {(r.candidatos.length > 0 ? ordenAlfa.filter((x) => r.candidatos.includes(x.id)) : ordenAlfa).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <small>Se recuerda para la próxima. Si no lo ligas, no se suma.</small>
              </div>
            )}
            {lectura.porProveedor.length === 0 && <p className="hint">No encontré productos con cantidad en lo que pegaste.</p>}
            {lectura.porProveedor.map((g) => (
              <div className="tend-card" key={g.proveedorId || SIN_PROVEEDOR}>
                <h4>
                  {nombreProv(g.proveedorId)}
                  {yaCargados[g.proveedorId || SIN_PROVEEDOR] && <span className="cp-reemplaza">Reemplaza lo cargado</span>}
                </h4>
                {g.productos.map((p) => (
                  <div key={p.clave} className="cp-fila">
                    <span>
                      {p.insumo.nombre}
                      {p.partes.length > 1 && <small>{p.partes.map(fmt).join(" + ")}</small>}
                      {p.aviso && <small className="cp-aviso">{p.aviso}</small>}
                    </span>
                    <b>
                      {fmt(p.total)} {pluralizarUnidad(p.presentacion, p.total)}
                    </b>
                  </div>
                ))}
              </div>
            ))}
            <button className="btn-primary" disabled={lectura.porProveedor.length === 0} onClick={guardar}>
              Guardar pedidos de la semana
            </button>
            <button className="link-btn" onClick={() => setLeido(false)}>
              Volver a editar lo pegado
            </button>
          </>
        )
      )}
    </div>
  );
}
