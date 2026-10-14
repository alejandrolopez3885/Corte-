import { useState, type ReactNode } from "react";
import { ArrowLeft, Circle, CircleDot, ClipboardPaste, TriangleAlert } from "lucide-react";
import { Empty, Field, NumInput, Sheet } from "../ui";
import {
  dateForDay,
  formatDayNumber,
  formatLongDayDate,
  formatWeekRange,
  mostRecentDayInWeek,
  resolveWeekStartDate,
  sumFromText,
} from "../../lib/dataModel";
import { leerNotaWhatsApp, unidadNoCoincide, type LineaReconocida } from "../../lib/pegarConteo";
import { DAYS, DAY_SHORT } from "../../lib/types";
import type { DayName, InsumoEntry, MonthData, ProveedorCatalogEntry } from "../../lib/types";

export function ConteoDiarioPanel({
  onBack,
  backLabel,
  emptyIcon,
  emptyText,
  insumos,
  proveedores,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  conteosDiarios,
  onGuardar,
}: {
  onBack?: () => void;
  backLabel: string;
  emptyIcon: ReactNode;
  emptyText: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  conteosDiarios: Record<string, Record<string, number>>;
  onGuardar: (fecha: string, valores: Record<string, number>, apodosNuevos?: Record<string, string[]>) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [dayName, setDayName] = useState<DayName>(() =>
    months[initialMonthKey] ? mostRecentDayInWeek(initialMonthKey, initialWeekIndex, months[initialMonthKey]) : "Lunes"
  );

  const month = months[monthKey] || null;
  const weekStartDate = month ? resolveWeekStartDate(monthKey, weekIndex, month) : null;
  const fecha = month ? dateForDay(monthKey, weekIndex, month, dayName) : null;

  if (monthKeys.length === 0 || !month || !fecha || !weekStartDate) {
    return (
      <div className="page-section">
        {onBack && (
          <button className="link-btn back-link" onClick={onBack}>
            <ArrowLeft size={15} /> {backLabel}
          </button>
        )}
        <h2 className="page-title">Conteo diario</h2>
        <Empty icon={emptyIcon} text="Primero crea un mes en Corte para poder llevar el conteo diario." />
      </div>
    );
  }

  function irASemana(mk: string, wi: number) {
    setMonthKey(mk);
    setWeekIndex(wi);
    setDayName(mostRecentDayInWeek(mk, wi, months[mk]));
  }

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <h2 className="page-title">Conteo diario</h2>

      <div className="field-row">
        <Field label="Mes">
          <select className="text-input" value={monthKey} onChange={(e) => irASemana(e.target.value, 0)}>
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select className="text-input" value={weekIndex} onChange={(e) => irASemana(monthKey, Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {i + 1}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

      <nav className="day-scroll">
        {DAYS.map((d) => {
          const dDate = dateForDay(monthKey, weekIndex, month, d);
          const hasData = Object.keys(conteosDiarios[dDate] || {}).length > 0;
          return (
            <button key={d} className={`day-chip ${d === dayName ? "active" : ""}`} onClick={() => setDayName(d)}>
              {hasData ? <CircleDot size={9} /> : <Circle size={9} />}
              {DAY_SHORT[d]} <span className="day-chip-date">{formatDayNumber(dDate)}</span>
            </button>
          );
        })}
      </nav>
      <p className="active-day-date">{formatLongDayDate(fecha)}</p>

      {insumos.length === 0 ? (
        <Empty icon={emptyIcon} text={emptyText} />
      ) : (
        // key={fecha} fuerza a React a desmontar y volver a montar el
        // formulario al cambiar de día, para que su estado (valores,
        // bloqueo) siempre nazca de lo que ya está guardado para ESA
        // fecha — nunca de un estado que quedó de otro día por un efecto
        // que no alcanzó a sincronizar a tiempo.
        <ConteoDiaForm
          key={fecha}
          fecha={fecha}
          grupos={agruparPorProveedor(insumos, proveedores)}
          guardadoDelDia={conteosDiarios[fecha] || {}}
          onGuardar={onGuardar}
        />
      )}
    </div>
  );
}

function agruparPorProveedor(insumos: InsumoEntry[], proveedores: ProveedorCatalogEntry[]) {
  const porProveedor = new Map<string, InsumoEntry[]>();
  const sinProveedor: InsumoEntry[] = [];
  insumos.forEach((i) => {
    if (!i.proveedorId) {
      sinProveedor.push(i);
      return;
    }
    if (!porProveedor.has(i.proveedorId)) porProveedor.set(i.proveedorId, []);
    porProveedor.get(i.proveedorId)!.push(i);
  });
  const grupos: { key: string; nombre: string; items: InsumoEntry[] }[] = [];
  proveedores.forEach((p) => {
    const items = porProveedor.get(p.id);
    if (items && items.length > 0) grupos.push({ key: p.id, nombre: p.nombre, items });
  });
  if (sinProveedor.length > 0) grupos.push({ key: "sin", nombre: "Sin proveedor", items: sinProveedor });
  return grupos;
}

function ConteoDiaForm({
  fecha,
  grupos,
  guardadoDelDia,
  onGuardar,
}: {
  fecha: string;
  grupos: { key: string; nombre: string; items: InsumoEntry[] }[];
  guardadoDelDia: Record<string, number>;
  onGuardar: (fecha: string, valores: Record<string, number>, apodosNuevos?: Record<string, string[]>) => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    grupos.forEach((g) =>
      g.items.forEach((i) => {
        init[i.id] = guardadoDelDia[i.id] !== undefined ? String(guardadoDelDia[i.id]) : "";
      })
    );
    return init;
  });
  const [locked, setLocked] = useState(() => Object.keys(guardadoDelDia).length > 0);
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);
  const [pegando, setPegando] = useState(false);
  // Tras pegar la nota, lo que no venía en ella se marca como faltante.
  const [marcarFaltantes, setMarcarFaltantes] = useState(false);
  const [apodosPendientes, setApodosPendientes] = useState<Record<string, string[]>>({});

  const todos = grupos.flatMap((g) => g.items);
  const faltantes = marcarFaltantes ? todos.filter((i) => !valores[i.id]?.trim()) : [];

  function aplicarPegado(nuevos: Record<string, string>, apodos: Record<string, string[]>) {
    setValores((v) => ({ ...v, ...nuevos }));
    setApodosPendientes((prev) => {
      const out = { ...prev };
      Object.entries(apodos).forEach(([id, lista]) => (out[id] = [...(out[id] || []), ...lista]));
      return out;
    });
    setMarcarFaltantes(true);
    setPegando(false);
  }

  function guardar() {
    const out: Record<string, number> = {};
    grupos.forEach((g) =>
      g.items.forEach((i) => {
        if (valores[i.id]?.trim()) out[i.id] = sumFromText(valores[i.id]);
      })
    );
    onGuardar(fecha, out, Object.keys(apodosPendientes).length > 0 ? apodosPendientes : undefined);
    setApodosPendientes({});
    setMarcarFaltantes(false);
    setLocked(true);
  }

  return (
    <>
      {locked && (
        <div className="conteo-locked-banner">
          <span>Este conteo ya está guardado y los campos están bloqueados.</span>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(true)}>
            Editar
          </button>
        </div>
      )}
      {!locked && (
        <button className="pegar-whatsapp-btn" onClick={() => setPegando(true)}>
          <ClipboardPaste size={16} /> Pegar nota de WhatsApp
        </button>
      )}
      {grupos.map((g) => (
        <div className="insumos-grupo" key={g.key}>
          <h3 className="insumos-grupo-titulo">{g.nombre}</h3>
          <div className="catalog-list">
            {g.items.map((i) => (
              <div key={i.id} className={`catalog-row conteo-row ${faltantes.includes(i) ? "falta" : ""}`}>
                <div>
                  <strong>{i.nombre}</strong>
                  <span>{faltantes.includes(i) ? `Falta la cantidad · ${i.unidad}` : i.unidad}</span>
                </div>
                <NumInput
                  value={valores[i.id] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [i.id]: e.target.value }))}
                  placeholder="0"
                  disabled={locked}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      {faltantes.length > 0 && (
        <p className="conteo-faltan-aviso">
          <TriangleAlert size={15} /> Faltan {faltantes.length} {faltantes.length === 1 ? "producto" : "productos"} por
          capturar: {faltantes.map((i) => i.nombre).join(", ")}.
        </p>
      )}
      <button className="btn-primary" onClick={guardar} disabled={locked}>
        Guardar conteo
      </button>

      {pegando && <PegarNotaSheet insumos={todos} onClose={() => setPegando(false)} onAplicar={aplicarPegado} />}

      {pidiendoConfirmacion && (
        <Sheet title="Editar conteo guardado" onClose={() => setPidiendoConfirmacion(false)}>
          <p className="hint">
            Este conteo de {formatLongDayDate(fecha)} ya se guardó. No deberías editarlo salvo que
            estés seguro de que el valor capturado está mal — cambiarlo afecta tu historial de
            inventario de ese día.
          </p>
          <button
            className="btn-warn"
            onClick={() => {
              setLocked(false);
              setPidiendoConfirmacion(false);
            }}
          >
            <TriangleAlert size={16} /> Sí, necesito editarlo
          </button>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(false)}>
            Cancelar
          </button>
        </Sheet>
      )}
    </>
  );
}

// Pegar la nota del chat: se lee, se muestra qué se reconoció, qué no y
// qué productos no venían, y solo al tocar "Rellenar conteo" pasa al
// formulario (que todavía hay que guardar como siempre).
function PegarNotaSheet({
  insumos,
  onClose,
  onAplicar,
}: {
  insumos: InsumoEntry[];
  onClose: () => void;
  onAplicar: (valores: Record<string, string>, apodos: Record<string, string[]>) => void;
}) {
  const [texto, setTexto] = useState("");
  const [lineas, setLineas] = useState<LineaReconocida[] | null>(null);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  // Asignación elegida por línea (índice) — arranca con lo reconocido solo.
  const [asignacion, setAsignacion] = useState<Record<number, string>>({});
  const [recordar, setRecordar] = useState<Record<number, boolean>>({});

  function leer() {
    const r = leerNotaWhatsApp(texto, insumos);
    setLineas(r.lineas);
    setIgnoradas(r.ignoradas);
    const a: Record<number, string> = {};
    const rec: Record<number, boolean> = {};
    r.lineas.forEach((l, idx) => {
      if (l.insumoId) a[idx] = l.insumoId;
      else rec[idx] = true;
    });
    setAsignacion(a);
    setRecordar(rec);
  }

  const porId = new Map(insumos.map((i) => [i.id, i]));

  if (!lineas) {
    return (
      <Sheet title="Pegar nota de WhatsApp" onClose={onClose}>
        <p className="hint">
          Copia el mensaje del chat con el conteo (ej. "Pollo 9kg", "Pan B 44pz") y pégalo aquí. Las cantidades
          se acomodan solas en su producto y antes de rellenar ves qué faltó.
        </p>
        <textarea
          className="text-input pegar-textarea"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Ff 11.77kg\nPollo 9kg\nPan B 44pz"}
          rows={10}
          autoFocus
        />
        <button className="btn-primary" onClick={leer} disabled={!texto.trim()}>
          Leer nota
        </button>
      </Sheet>
    );
  }

  const asignados = new Set(Object.values(asignacion).filter(Boolean));
  const faltan = insumos.filter((i) => !asignados.has(i.id));
  const conteoPorInsumo = new Map<string, number>();
  Object.values(asignacion).forEach((id) => id && conteoPorInsumo.set(id, (conteoPorInsumo.get(id) || 0) + 1));

  function aplicar() {
    const valores: Record<string, string> = {};
    const apodos: Record<string, string[]> = {};
    lineas!.forEach((l, idx) => {
      const id = asignacion[idx];
      if (!id) return;
      // Si dos líneas caen en el mismo producto, gana la última del mensaje.
      valores[id] = String(l.cantidad);
      if (!l.insumoId && recordar[idx]) apodos[id] = [...(apodos[id] || []), l.texto];
    });
    onAplicar(valores, apodos);
  }

  return (
    <Sheet title="Revisar nota" onClose={onClose}>
      <div className="pegar-lista">
        {lineas.map((l, idx) => {
          const id = asignacion[idx];
          const insumo = id ? porId.get(id) : undefined;
          const auto = !!l.insumoId && id === l.insumoId;
          return (
            <div key={idx} className={`pegar-linea ${id ? "ok" : "pendiente"}`}>
              <div className="pegar-linea-top">
                <code>{l.linea}</code>
                <strong>
                  {l.cantidad}
                  {insumo ? ` ${insumo.unidad}` : ""}
                </strong>
              </div>
              {auto ? (
                <span className="pegar-linea-match">
                  → {insumo!.nombre}
                  <button className="link-btn" onClick={() => setAsignacion((a) => ({ ...a, [idx]: "" }))}>
                    Cambiar
                  </button>
                </span>
              ) : (
                <>
                  <select
                    className="text-input"
                    value={id || ""}
                    onChange={(e) => setAsignacion((a) => ({ ...a, [idx]: e.target.value }))}
                  >
                    <option value="">
                      {l.candidatos.length > 1 ? "¿Cuál de estos es?" : "No reconocido — elige el producto o déjalo fuera"}
                    </option>
                    {[...l.candidatos.map((c) => porId.get(c)!), ...insumos.filter((i) => !l.candidatos.includes(i.id))].map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre}
                      </option>
                    ))}
                  </select>
                  {id && !l.insumoId && (
                    <label className="pegar-recordar">
                      <input
                        type="checkbox"
                        checked={!!recordar[idx]}
                        onChange={(e) => setRecordar((r) => ({ ...r, [idx]: e.target.checked }))}
                      />
                      Recordar "{l.texto}" como {insumo?.nombre}
                    </label>
                  )}
                </>
              )}
              {insumo && unidadNoCoincide(l.unidad, insumo.unidad) && (
                <span className="pegar-aviso">Ojo: se anotó en "{l.unidad}" y el producto se cuenta en {insumo.unidad}.</span>
              )}
              {id && (conteoPorInsumo.get(id) || 0) > 1 && (
                <span className="pegar-aviso">Este producto viene más de una vez — se usa la última línea.</span>
              )}
            </div>
          );
        })}
        {lineas.length === 0 && <p className="hint">No se encontró ninguna línea con cantidad.</p>}
      </div>

      {faltan.length > 0 && (
        <div className="pegar-faltan">
          <strong>
            <TriangleAlert size={14} /> Faltan en la nota ({faltan.length})
          </strong>
          <span>{faltan.map((i) => i.nombre).join(", ")}</span>
        </div>
      )}
      {ignoradas.length > 0 && <p className="hint">Líneas sin cantidad que se ignoraron: {ignoradas.join(" · ")}</p>}

      <button className="btn-primary" onClick={aplicar} disabled={asignados.size === 0}>
        Rellenar conteo
      </button>
      <button className="link-btn" onClick={() => setLineas(null)}>
        Volver a pegar
      </button>
    </Sheet>
  );
}
