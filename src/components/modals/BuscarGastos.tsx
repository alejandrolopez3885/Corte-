import { useState } from "react";
import { Check, Pencil, Plus, Search, X } from "lucide-react";
import { Field, NumInput } from "../ui";
import { ConceptoInput } from "../ConceptoInput";
import { GastoForm, type GastoFormValues } from "./GastoModal";
import { dateForDay, formatShortDayDate, money } from "../../lib/dataModel";
import { leerBusqueda, nombreParaNuevo, puntaje, PUNTAJE_ENCONTRADO, PUNTAJE_PARECIDO } from "../../lib/gastosBusqueda";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import { DAYS, DAY_SHORT, GASTO_CATEGORIAS } from "../../lib/types";
import type { DayName, EmpleadoEntry, Gasto, GastoCategoria, MeseroCatalogEntry, MonthData, WeekData } from "../../lib/types";

interface GastoEnDia {
  gasto: Gasto;
  dia: DayName;
}

// Búsqueda de tickets dentro de "Control de gastos en efectivo": con el
// ticket físico en la mano se escribe "coca jueves" (o solo el monto) y
// ahí mismo se confirma, corrige, mueve o agrega. Solo busca en la semana
// elegida. Desde aquí nunca se borra un gasto.
export function BuscarGastos({
  monthKey,
  weekIndex,
  month,
  week,
  onToggleEstado,
  onSetCategoria,
  onMoverGasto,
  onEditarGasto,
  onAgregarGasto,
  empleados,
  meseros,
  historial,
}: {
  monthKey: string;
  weekIndex: number;
  month: MonthData;
  week: WeekData;
  onToggleEstado: (monthKey: string, weekIndex: number, dayName: DayName, id: string) => void;
  onSetCategoria: (monthKey: string, weekIndex: number, dayName: DayName, id: string, categoria: GastoCategoria | "") => void;
  onMoverGasto: (monthKey: string, weekIndex: number, fromDay: DayName, toDay: DayName, id: string) => void;
  onEditarGasto: (monthKey: string, weekIndex: number, dayName: DayName, id: string, concepto: string, total: number) => void;
  onAgregarGasto: (monthKey: string, weekIndex: number, dayName: DayName, form: GastoFormValues) => void;
  empleados: EmpleadoEntry[];
  meseros: MeseroCatalogEntry[];
  historial: NombreHistorial[];
}) {
  const [texto, setTexto] = useState("");
  const [monto, setMonto] = useState("");
  const [editing, setEditing] = useState<{ id: string; concepto: string; total: string } | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [diaNuevo, setDiaNuevo] = useState<DayName | "">("");

  const fecha = (d: DayName) => `${DAY_SHORT[d]} ${formatShortDayDate(dateForDay(monthKey, weekIndex, month, d)).split(" ")[0]}`;
  const todos: GastoEnDia[] = DAYS.flatMap((dia) => week.days[dia].gastos.map((gasto) => ({ gasto, dia })));

  function limpiar() {
    setTexto("");
    setMonto("");
    setEditing(null);
    setAgregando(false);
    setDiaNuevo("");
  }

  const hayTexto = texto.trim().length > 0;
  const hayMonto = monto.trim().length > 0;

  function tarjeta(item: GastoEnDia, diaBuscado: DayName | null, atenuarIngresados: boolean) {
    const { gasto: g, dia } = item;
    const isEditing = editing?.id === g.id;
    const atenuado = atenuarIngresados && g.estado === "ingresado";
    const sugerirMover = diaBuscado && dia !== diaBuscado && g.estado === "pendiente";
    if (isEditing) {
      return (
        <div key={g.id} className="resultado-card">
          <div className="gasto-row-edit">
            <ConceptoInput
              value={editing.concepto}
              onChange={(v) => setEditing({ ...editing, concepto: v })}
              historial={historial}
              placeholder="Concepto"
            />
            <NumInput value={editing.total} onChange={(e) => setEditing({ ...editing, total: e.target.value })} placeholder="0.00" />
            <div className="gasto-row-edit-actions">
              <button type="button" className="link-btn" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!editing.concepto.trim() || !editing.total}
                onClick={() => {
                  onEditarGasto(monthKey, weekIndex, dia, g.id, editing.concepto.trim(), parseFloat(editing.total) || 0);
                  setEditing(null);
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={g.id} className={`resultado-card${atenuado ? " atenuado" : ""}`}>
        <div className="resultado-top">
          <span className="resultado-concepto">{g.concepto}</span>
          <span className="resultado-monto">{money(g.total)}</span>
        </div>
        <div className="resultado-meta">
          <span className="resultado-dia">{fecha(dia)}</span>
          <button
            type="button"
            className={`estado-chip ${g.estado}`}
            disabled={g.estado === "pendiente" && !g.categoria}
            onClick={() => {
              onToggleEstado(monthKey, weekIndex, dia, g.id);
              // Ya quedó revisado: lista para el siguiente ticket.
              if (g.estado === "pendiente") limpiar();
            }}
          >
            {g.estado === "pendiente" ? (
              "Confirmar"
            ) : (
              <>
                <Check size={13} /> Ingresado
              </>
            )}
          </button>
          {g.estado === "ingresado" && g.categoria && (
            <span className="categoria-badge">{GASTO_CATEGORIAS.find((c) => c.value === g.categoria)?.label}</span>
          )}
          <button
            type="button"
            className="icon-btn gasto-edit-btn"
            aria-label="Editar gasto"
            onClick={() => setEditing({ id: g.id, concepto: g.concepto, total: String(g.total) })}
          >
            <Pencil size={14} />
          </button>
        </div>
        {atenuado ? (
          <p className="hint gasto-row-hint">Ya ingresado: su ticket ya se subió, no es este.</p>
        ) : (
          <div className="gasto-row-controls">
            {g.estado === "pendiente" && (
              <select
                className="categoria-select"
                value={g.categoria || ""}
                onChange={(e) => onSetCategoria(monthKey, weekIndex, dia, g.id, e.target.value as GastoCategoria | "")}
              >
                <option value="">Sin categoría</option>
                {GASTO_CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
            {sugerirMover ? (
              <button
                type="button"
                className="btn-chico primario"
                onClick={() => {
                  onMoverGasto(monthKey, weekIndex, dia, diaBuscado, g.id);
                  limpiar();
                }}
              >
                Mover a {diaBuscado.toLowerCase()}
              </button>
            ) : (
              <select
                className="categoria-select"
                value=""
                onChange={(e) => {
                  const toDay = e.target.value as DayName;
                  if (toDay) {
                    onMoverGasto(monthKey, weekIndex, dia, toDay, g.id);
                    limpiar();
                  }
                }}
              >
                <option value="">Mover a...</option>
                {DAYS.filter((dn) => dn !== dia).map((dn) => (
                  <option key={dn} value={dn}>
                    {dn}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {sugerirMover && <p className="hint gasto-row-hint">Pendiente: puede ser el mismo ticket capturado en otro día.</p>}
        {!atenuado && g.estado === "pendiente" && !g.categoria && (
          <p className="hint gasto-row-hint">Elige una categoría para poder confirmarlo.</p>
        )}
        {!atenuado && g.meseroCutId && (
          <p className="hint gasto-row-hint">Restado del corte de {g.meseroNombre || "un mesero"} — si lo mueves o cambias el monto, su total se recalcula.</p>
        )}
      </div>
    );
  }

  // Formulario para agregar el gasto que no se encontró, con los mismos
  // campos que en Corte, el día ya puesto (si se escribió) y el nombre
  // escrito bien.
  function formularioNuevo(nombre: string, dia: DayName | null) {
    const diaFinal = dia || diaNuevo || null;
    return (
      <div className="agregar-form">
        <span className="agregar-form-titulo">
          <Plus size={14} /> Agregar gasto{dia ? ` — ${fecha(dia)}` : ""}
        </span>
        {!dia && (
          <Field label="Día">
            <select className="categoria-select" value={diaNuevo} onChange={(e) => setDiaNuevo(e.target.value as DayName | "")}>
              <option value="">Elige el día</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {fecha(d)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <GastoForm
          key={nombre}
          conceptoInicial={nombreParaNuevo(nombre, historial)}
          empleados={empleados}
          meseros={meseros}
          historial={historial}
          saveLabel="Agregar"
          bloqueado={!diaFinal}
          onCancel={() => setAgregando(false)}
          onSave={(form) => {
            if (!diaFinal) return;
            onAgregarGasto(monthKey, weekIndex, diaFinal, form);
            limpiar();
          }}
        />
      </div>
    );
  }

  function botonAgregar(dia: DayName | null) {
    return (
      <button type="button" className="agregar-dashed" onClick={() => setAgregando(true)}>
        <Plus size={14} /> Ninguno es — agregar nuevo gasto{dia ? ` el ${dia.toLowerCase()}` : ""}
      </button>
    );
  }

  function resultadosMonto() {
    const m = parseFloat(monto);
    if (isNaN(m)) return null;
    const iguales = todos.filter((x) => Math.abs(x.gasto.total - m) < 0.005);
    if (iguales.length) {
      return (
        <>
          <p className="buscar-res-head">
            {iguales.length} {iguales.length === 1 ? "gasto" : "gastos"} de {money(m)} esta semana
          </p>
          {iguales.map((x) => tarjeta(x, null, false))}
        </>
      );
    }
    const cercanos = [...new Set(todos.map((x) => x.gasto.total))]
      .sort((a, b) => Math.abs(a - m) - Math.abs(b - m))
      .slice(0, 3)
      .sort((a, b) => a - b);
    return (
      <div className="buscar-msg aviso">
        No hay gastos de {money(m)} esta semana.
        {cercanos.length > 0 && (
          <span className="buscar-cercanos">
            Los más cercanos:
            {cercanos.map((c) => (
              <button key={c} type="button" className="pill" onClick={() => setMonto(String(c))}>
                {money(c)}
              </button>
            ))}
          </span>
        )}
      </div>
    );
  }

  function resultadosTexto() {
    const leida = leerBusqueda(texto, monthKey, weekIndex, month);
    const { nombre, dia } = leida;
    const fueraDeSemana = leida.diaFuera !== null && (
      <p className="hint">El {leida.diaFuera} no cae en esta semana — se buscó en toda la semana.</p>
    );

    // Solo el día ("jueves"): todos los gastos de ese día.
    if (!nombre) {
      if (!dia) return fueraDeSemana || null;
      const delDia = todos.filter((x) => x.dia === dia);
      return (
        <>
          <p className="buscar-res-head">
            {delDia.length === 0 ? "Sin gastos" : `${delDia.length} ${delDia.length === 1 ? "gasto" : "gastos"}`} el {fecha(dia)}
          </p>
          {delDia.map((x) => tarjeta(x, null, false))}
          {agregando ? formularioNuevo("", dia) : botonAgregar(dia)}
        </>
      );
    }

    const conPuntaje = todos
      .map((x) => ({ ...x, p: puntaje(nombre, x.gasto.concepto) }))
      .sort((a, b) => b.p - a.p || DAYS.indexOf(a.dia) - DAYS.indexOf(b.dia));
    const fuertes = conPuntaje.filter((x) => x.p >= PUNTAJE_ENCONTRADO).sort((a, b) => DAYS.indexOf(a.dia) - DAYS.indexOf(b.dia));
    const parecidos = conPuntaje.filter((x) => x.p >= PUNTAJE_PARECIDO && x.p < PUNTAJE_ENCONTRADO).slice(0, 5);

    // El nombre más repetido entre los encontrados, para el total.
    const conteo = new Map<string, number>();
    fuertes.forEach((x) => conteo.set(x.gasto.concepto, (conteo.get(x.gasto.concepto) || 0) + 1));
    const nombreResumen = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const resumen = fuertes.length > 0 && (
      <div className="buscar-resumen">
        <span>{nombreResumen} esta semana</span>
        <strong>
          {fuertes.length} {fuertes.length === 1 ? "gasto" : "gastos"} · {money(fuertes.reduce((s, x) => s + x.gasto.total, 0))}
        </strong>
      </div>
    );

    if (dia) {
      const enDia = fuertes.filter((x) => x.dia === dia);
      if (enDia.length) {
        return (
          <>
            {fueraDeSemana}
            <div className="buscar-msg bien">
              {enDia.length === 1 ? "Encontrado" : `${enDia.length} encontrados`} el <strong>{fecha(dia)}</strong>.
            </div>
            {enDia.map((x) => tarjeta(x, dia, false))}
            {agregando ? formularioNuevo(nombre, dia) : botonAgregar(dia)}
            {resumen}
          </>
        );
      }
      const otros = fuertes.length ? fuertes : parecidos;
      if (otros.length) {
        return (
          <>
            {fueraDeSemana}
            <div className="buscar-msg aviso">
              No hay "{nombre}" el <strong>{fecha(dia)}</strong>.{" "}
              {fuertes.length
                ? `Hay ${fuertes.length} ${fuertes.length === 1 ? "parecido" : "parecidos"} esta semana:`
                : "¿Será alguno de estos?"}
            </div>
            {otros.map((x) => tarjeta(x, dia, true))}
            {agregando ? formularioNuevo(nombre, dia) : botonAgregar(dia)}
            {resumen}
          </>
        );
      }
      return (
        <>
          {fueraDeSemana}
          <div className="buscar-msg error">No se encontró ningún gasto parecido esta semana.</div>
          {formularioNuevo(nombre, dia)}
        </>
      );
    }

    if (fuertes.length) {
      return (
        <>
          {fueraDeSemana}
          <p className="buscar-res-head">
            {fuertes.length} {fuertes.length === 1 ? "encontrado" : "encontrados"} esta semana
          </p>
          {fuertes.map((x) => tarjeta(x, null, false))}
          {agregando ? formularioNuevo(nombre, null) : botonAgregar(null)}
          {resumen}
        </>
      );
    }
    if (parecidos.length) {
      return (
        <>
          {fueraDeSemana}
          <div className="buscar-msg aviso">No se encontró "{nombre}". ¿Será alguno de estos?</div>
          {parecidos.map((x) => tarjeta(x, null, false))}
          {agregando ? formularioNuevo(nombre, null) : botonAgregar(null)}
        </>
      );
    }
    return (
      <>
        {fueraDeSemana}
        <div className="buscar-msg error">No se encontró ningún gasto parecido esta semana.</div>
        {formularioNuevo(nombre, null)}
      </>
    );
  }

  const leida = hayTexto ? leerBusqueda(texto, monthKey, weekIndex, month) : null;

  return (
    <div className="buscar-gastos">
      <div className="buscar-caja">
        <div className="buscar-titulo">
          <span>
            <Search size={14} /> Buscar ticket
          </span>
          {(hayTexto || hayMonto) && (
            <button type="button" className="link-btn buscar-limpiar" onClick={limpiar}>
              <X size={13} /> Limpiar
            </button>
          )}
        </div>
        <div className="buscar-cuadros">
          <input
            className="text-input buscar-texto"
            value={texto}
            disabled={hayMonto}
            onChange={(e) => {
              setTexto(e.target.value);
              setEditing(null);
              setAgregando(false);
            }}
            placeholder="Nombre, proveedor, día…"
            autoComplete="off"
          />
          <NumInput
            className="num-input buscar-monto"
            value={monto}
            disabled={hayTexto}
            onChange={(e) => {
              setMonto(e.target.value);
              setEditing(null);
            }}
            placeholder="$ Monto"
          />
        </div>
        {leida && (leida.nombre || leida.dia) && (
          <div className="buscar-pills">
            {leida.nombre && <span className="pill">Nombre: {leida.nombre}</span>}
            {leida.dia && <span className="pill">Día: {fecha(leida.dia)}</span>}
          </div>
        )}
      </div>
      {hayMonto ? resultadosMonto() : hayTexto ? resultadosTexto() : null}
    </div>
  );
}
