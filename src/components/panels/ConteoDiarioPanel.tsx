import { useState, type ReactNode } from "react";
import { ArrowLeft, Circle, CircleDot, TriangleAlert } from "lucide-react";
import { Empty, Field, NumInput, Sheet } from "../ui";
import {
  dateForDay,
  formatDayNumber,
  formatLongDayDate,
  formatWeekRange,
  mostRecentDayInWeek,
  resolveWeekStartDate,
  esCantidadValida,
  leerConteoTexto,
  normalizarNombre,
  type LineaConteoTexto,
} from "../../lib/dataModel";
import { DAYS, DAY_SHORT } from "../../lib/types";
import type { DayName, InsumoEntry, MonthData, ProveedorCatalogEntry } from "../../lib/types";

export function ConteoDiarioPanel({
  onBack,
  backLabel,
  emptyIcon,
  emptyText,
  plantilla,
  insumos,
  proveedores,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  textos,
  onGuardar,
  pedidos,
  onGuardarPedido,
}: {
  onBack?: () => void;
  backLabel: string;
  emptyIcon: ReactNode;
  emptyText: string;
  plantilla: string;
  // Catálogo del área — para ligar cada producto del texto con su proveedor.
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  textos: Record<string, string>;
  onGuardar: (fecha: string, texto: string) => void;
  // Cantidad a pedir por producto (nombre normalizado), por fecha.
  pedidos: Record<string, Record<string, number>>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
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
          const hasData = !!textos[dDate];
          return (
            <button key={d} className={`day-chip ${d === dayName ? "active" : ""}`} onClick={() => setDayName(d)}>
              {hasData ? <CircleDot size={9} /> : <Circle size={9} />}
              {DAY_SHORT[d]} <span className="day-chip-date">{formatDayNumber(dDate)}</span>
            </button>
          );
        })}
      </nav>
      <p className="active-day-date">{formatLongDayDate(fecha)}</p>

      {!plantilla ? (
        <Empty icon={emptyIcon} text={emptyText} />
      ) : (
        // key={fecha}: el formulario nace de lo guardado para ESA fecha.
        <ConteoTextoForm
          key={fecha}
          fecha={fecha}
          guardado={textos[fecha]}
          plantilla={plantilla}
          insumos={insumos}
          proveedores={proveedores}
          onGuardar={onGuardar}
          pedidoGuardado={pedidos[fecha]}
          onGuardarPedido={onGuardarPedido}
        />
      )}
    </div>
  );
}

// Conteo diario en texto: lo primero que se ve es la lista con los nombres
// y su presentación entre paréntesis, y el jefe de cocina/barra escribe la
// cantidad después de cada ":". Se guarda el texto tal cual, por fecha.
function ConteoTextoForm({
  fecha,
  guardado,
  plantilla,
  insumos,
  proveedores,
  onGuardar,
  pedidoGuardado,
  onGuardarPedido,
}: {
  fecha: string;
  guardado?: string;
  plantilla: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onGuardar: (fecha: string, texto: string) => void;
  pedidoGuardado?: Record<string, number>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
}) {
  const [texto, setTexto] = useState(guardado ?? plantilla);
  const [locked, setLocked] = useState(guardado !== undefined);
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);
  const [errores, setErrores] = useState<ErroresCaptura | null>(null);

  // No se guarda si a algún producto le falta la cantidad o trae algo que
  // no sea solo un número (la presentación ya va entre paréntesis).
  function guardar() {
    const lineas = leerConteoTexto(texto);
    const faltan = lineas.filter((l) => !l.valor).map((l) => l.etiqueta);
    const invalidas = lineas.filter((l) => l.valor && !esCantidadValida(l.valor)).map((l) => `${l.etiqueta}: "${l.valor}"`);
    if (faltan.length > 0 || invalidas.length > 0) {
      setErrores({ titulo: "Faltan productos por rellenar", faltan, invalidas });
      return;
    }
    onGuardar(fecha, texto);
    setLocked(true);
  }

  return (
    <>
      {locked && (
        <div className="conteo-locked-banner">
          <span>Este conteo ya está guardado y está bloqueado.</span>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(true)}>
            Editar
          </button>
        </div>
      )}
      <textarea
        className="text-input conteo-texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={Math.max(10, texto.split("\n").length + 2)}
        disabled={locked}
      />
      <button className="btn-primary" onClick={guardar} disabled={locked}>
        Guardar conteo
      </button>

      {locked && guardado !== undefined && (
        <ListaPorProveedor
          fecha={fecha}
          lineas={leerConteoTexto(guardado)}
          insumos={insumos}
          proveedores={proveedores}
          pedidoGuardado={pedidoGuardado}
          onGuardarPedido={onGuardarPedido}
        />
      )}

      {errores && <ErroresSheet errores={errores} onClose={() => setErrores(null)} />}

      {pidiendoConfirmacion && (
        <Sheet title="Editar conteo guardado" onClose={() => setPidiendoConfirmacion(false)}>
          <p className="hint">
            Este conteo de {formatLongDayDate(fecha)} ya se guardó. No deberías editarlo salvo que
            estés seguro de que el valor capturado está mal.
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

interface ErroresCaptura {
  titulo: string;
  faltan: string[];
  invalidas: string[];
}

// Mismo aviso para el conteo y para el pedido: lo vacío y lo que no es
// solo un número.
function ErroresSheet({ errores, onClose }: { errores: ErroresCaptura; onClose: () => void }) {
  const { titulo, faltan, invalidas } = errores;
  return (
    <Sheet title={invalidas.length > 0 ? "Revisa los datos" : titulo} onClose={onClose}>
      {faltan.length > 0 && (
        <>
          {invalidas.length > 0 && <p className="hint">{titulo}:</p>}
          <div className="conteo-errores">
            {faltan.map((t) => (
              <span key={t}>
                <TriangleAlert size={14} /> {t}
              </span>
            ))}
          </div>
        </>
      )}
      {invalidas.length > 0 && (
        <>
          <p className="hint">Solo se aceptan números — la presentación ya va entre paréntesis:</p>
          <div className="conteo-errores">
            {invalidas.map((t) => (
              <span key={t}>
                <TriangleAlert size={14} /> {t}
              </span>
            ))}
          </div>
        </>
      )}
      <p className="hint">Escribe solo la cantidad de cada uno (si no hay o no se pide, pon 0) para poder guardar.</p>
      <button className="btn-primary" onClick={onClose}>
        Volver a rellenar
      </button>
    </Sheet>
  );
}

// Lo guardado, separado por proveedor: cada producto del texto se busca por
// nombre en el catálogo del área y toma el proveedor que tenga asignado; lo
// que no está en el catálogo o no tiene proveedor cae en "Sin proveedor".
// Junto a la cantidad contada va un recuadro para la cantidad a pedir: vacío
// no deja guardar, y 0 significa que no se pide ese producto.
function ListaPorProveedor({
  fecha,
  lineas,
  insumos,
  proveedores,
  pedidoGuardado,
  onGuardarPedido,
}: {
  fecha: string;
  lineas: LineaConteoTexto[];
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  pedidoGuardado?: Record<string, number>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
}) {
  const [pedido, setPedido] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    lineas.forEach((l) => {
      const v = pedidoGuardado?.[normalizarNombre(l.nombre)];
      init[normalizarNombre(l.nombre)] = v !== undefined ? String(v) : "";
    });
    return init;
  });
  const [pedidoLocked, setPedidoLocked] = useState(pedidoGuardado !== undefined);
  const [errores, setErrores] = useState<ErroresCaptura | null>(null);

  const porNombre = new Map(insumos.map((i) => [normalizarNombre(i.nombre), i]));
  const grupos = new Map<string, { linea: LineaConteoTexto; enCatalogo: boolean }[]>();
  lineas.forEach((linea) => {
    const insumo = porNombre.get(normalizarNombre(linea.nombre));
    const key = insumo?.proveedorId && proveedores.some((p) => p.id === insumo.proveedorId) ? insumo.proveedorId : "sin";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push({ linea, enCatalogo: !!insumo });
  });
  const orden = [...proveedores.filter((p) => grupos.has(p.id)).map((p) => ({ key: p.id, nombre: p.nombre }))];
  if (grupos.has("sin")) orden.push({ key: "sin", nombre: "Sin proveedor" });

  function guardarPedido() {
    const faltan: string[] = [];
    const invalidas: string[] = [];
    const out: Record<string, number> = {};
    lineas.forEach((l) => {
      const v = (pedido[normalizarNombre(l.nombre)] || "").trim();
      if (!v) faltan.push(l.etiqueta);
      else if (!esCantidadValida(v)) invalidas.push(`${l.etiqueta}: "${v}"`);
      else out[normalizarNombre(l.nombre)] = Number(v.replace(",", "."));
    });
    if (faltan.length > 0 || invalidas.length > 0) {
      setErrores({ titulo: "Faltan campos por rellenar en el pedido", faltan, invalidas });
      return;
    }
    onGuardarPedido(fecha, out);
    setPedidoLocked(true);
  }

  return (
    <>
      <div className="conteo-colhead">
        <span>Conteo</span>
        <span>Pedir</span>
      </div>
      {orden.map((g) => (
        <div className="insumos-grupo" key={g.key}>
          <h3 className="insumos-grupo-titulo">{g.nombre}</h3>
          <div className="catalog-list">
            {grupos.get(g.key)!.map(({ linea, enCatalogo }) => {
              const key = normalizarNombre(linea.nombre);
              const valor = pedido[key] ?? "";
              return (
                <div key={linea.etiqueta} className="catalog-row conteo-row">
                  <div>
                    <strong>{linea.nombre}</strong>
                    {!enCatalogo && <span className="conteo-no-catalogo">No está en el catálogo</span>}
                  </div>
                  <span className="conteo-cantidad">
                    {linea.valor}
                    {linea.presentacion && <small> {linea.presentacion}</small>}
                  </span>
                  <NumInput
                    className={`num-input pedido-input ${valor.trim() && valor.trim() !== "0" ? "con-pedido" : ""}`}
                    value={valor}
                    onChange={(e) => setPedido((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder="—"
                    disabled={pedidoLocked}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {pedidoLocked ? (
        <div className="conteo-locked-banner">
          <span>Pedido guardado.</span>
          <button className="link-btn" onClick={() => setPedidoLocked(false)}>
            Editar pedido
          </button>
        </div>
      ) : (
        <button className="btn-primary" onClick={guardarPedido}>
          Guardar pedido
        </button>
      )}

      {errores && <ErroresSheet errores={errores} onClose={() => setErrores(null)} />}
    </>
  );
}
