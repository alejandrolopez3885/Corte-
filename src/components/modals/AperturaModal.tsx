import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Sheet, Field, NumInput, SumInput } from "../ui";
import { ConceptoInput } from "../ConceptoInput";
import { money, normalizarNombre, round2, sumFromText, uid } from "../../lib/dataModel";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import type { EmpleadoEntry, MeseroCatalogEntry } from "../../lib/types";

// Corte de apertura (turno 1): en una sola pantalla, lo que llevan hasta
// este momento las apps, el usuario de para llevar ("Johnster") y el usuario
// de quien abrió — sin propina. Al guardarlo queda bloqueado para el
// personal; al cierre se captura el total del día y la app resta esto.

export interface BloqueApertura {
  meseroId: string;
  nombre: string;
  venta: number;
  tarjetas: number;
  tarjetasDesglose?: number[];
  transferencia: number;
  transferDesglose?: number[];
  gastos: { concepto: string; monto: number }[];
}

export interface AperturaValues {
  abrio?: { empleadoId?: string; nombre: string };
  usuarioSistemaId?: string;
  ventaApps: number;
  bloques: BloqueApertura[];
}

interface Bloque {
  meseroId: string;
  venta: string;
  tarjetas: string;
  tarjetasDesglose?: number[];
  transfer: string;
  transferDesglose?: number[];
  gastos: { id: string; concepto: string; monto: string }[];
}

const vacio = (meseroId: string): Bloque => ({ meseroId, venta: "", tarjetas: "", transfer: "", gastos: [] });

export function AperturaModal({
  onClose,
  onGuardar,
  catalog,
  empleados,
  abren,
  historial,
  dejadoAyer,
  fondo,
}: {
  onClose: () => void;
  onGuardar: (v: AperturaValues) => void;
  catalog: MeseroCatalogEntry[];
  empleados: EmpleadoEntry[];
  // Quién tiene X (abre) o Z (dobla) ese día en el horario.
  abren: { empleadoId: string; nombre: string; marca: string }[];
  historial: NombreHistorial[];
  // Efectivo que se dejó en el restaurante el día anterior.
  dejadoAyer?: { monto: number; nota?: string };
  // Fondo manejado en el turno 1 (desde el 25/10/2026): lo gastado con él y
  // lo que queda, que se entrega al dueño junto con la apertura.
  fondo?: { gastos: number; queda: number };
}) {
  const paraLlevar = catalog.find((c) => c.acumulado);
  const usuarioDe = (empleadoId: string) => {
    const e = empleados.find((x) => x.id === empleadoId);
    if (!e) return "";
    if (e.usuarioSistemaId && catalog.some((c) => c.id === e.usuarioSistemaId)) return e.usuarioSistemaId;
    // Mismo nombre, o el del sistema es su primer nombre ("Jenny" → "Jenny Pérez").
    const n = normalizarNombre(e.nombre);
    const opciones = catalog.filter((c) => !c.acumulado);
    return (
      opciones.find((c) => normalizarNombre(c.nombre) === n)?.id ||
      opciones.find((c) => n.split(" ")[0] === normalizarNombre(c.nombre))?.id ||
      ""
    );
  };

  const [abrioId, setAbrioId] = useState(abren.length === 1 ? abren[0].empleadoId : "");
  const [usuarioId, setUsuarioId] = useState(abren.length === 1 ? usuarioDe(abren[0].empleadoId) : "");
  const [apps, setApps] = useState("");
  const [llevar, setLlevar] = useState<Bloque>(vacio(paraLlevar?.id || ""));
  const [persona, setPersona] = useState<Bloque>(vacio(""));
  const [intento, setIntento] = useState(false);

  const nombreAbrio = empleados.find((e) => e.id === abrioId)?.nombre || abren.find((a) => a.empleadoId === abrioId)?.nombre;
  const usuario = catalog.find((c) => c.id === usuarioId);
  const usuarioLlevar = catalog.find((c) => c.id === llevar.meseroId);
  const otrosEmpleados = empleados.filter((e) => !abren.some((a) => a.empleadoId === e.id));
  const falta = !abrioId || !usuarioId || !llevar.meseroId || usuarioId === llevar.meseroId;

  // Se actualiza sobre el valor más reciente: los campos de suma avisan el
  // total y sus partes por separado y no se deben pisar.
  function bloqueUI(titulo: string, b: Bloque, setter: (f: (prev: Bloque) => Bloque) => void) {
    const set = (cambio: Partial<Bloque>) => setter((prev) => ({ ...prev, ...cambio }));
    const gastosSum = b.gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
    const efectivo = round2((parseFloat(b.venta) || 0) - sumFromText(b.tarjetas) - sumFromText(b.transfer) - gastosSum);
    return (
      <div className="apertura-bloque">
        <div className="apertura-bloque-titulo">
          <strong>{titulo}</strong>
          <span>sin propina</span>
        </div>
        <div className="field-row">
          <Field label="Venta hasta ahora">
            <NumInput value={b.venta} onChange={(e) => set({ venta: e.target.value })} placeholder="0.00" />
          </Field>
          <Field label="Tarjetas">
            <SumInput value={b.tarjetas} onChange={(v) => set({ tarjetas: v })} onPartes={(p) => set({ tarjetasDesglose: p })} placeholder="0.00" sumar />
          </Field>
        </div>
        <Field label="Transferencias">
          <SumInput value={b.transfer} onChange={(v) => set({ transfer: v })} onPartes={(p) => set({ transferDesglose: p })} placeholder="0.00" sumar />
        </Field>
        {b.gastos.map((g) => (
          <div key={g.id} className="gasto-row">
            <Field label="Gasto">
              <ConceptoInput
                value={g.concepto}
                onChange={(v) => setter((prev) => ({ ...prev, gastos: prev.gastos.map((x) => (x.id === g.id ? { ...x, concepto: v } : x)) }))}
                historial={historial}
                placeholder="Ej. hielo"
              />
            </Field>
            <Field label="Monto">
              <NumInput
                value={g.monto}
                onChange={(e) => {
                  const monto = e.target.value;
                  setter((prev) => ({ ...prev, gastos: prev.gastos.map((x) => (x.id === g.id ? { ...x, monto } : x)) }));
                }}
                placeholder="0.00"
              />
            </Field>
            <button type="button" className="icon-btn" onClick={() => setter((prev) => ({ ...prev, gastos: prev.gastos.filter((x) => x.id !== g.id) }))}>
              <X size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => setter((prev) => ({ ...prev, gastos: [...prev.gastos, { id: uid(), concepto: "", monto: "" }] }))}>
          <Plus size={13} /> Agregar gasto
        </button>
        <div className="apertura-efectivo">
          <span>Entrega en efectivo</span>
          <strong>{money(efectivo)}</strong>
        </div>
      </div>
    );
  }

  const efectivoDe = (b: Bloque) =>
    round2((parseFloat(b.venta) || 0) - sumFromText(b.tarjetas) - sumFromText(b.transfer) - b.gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0));
  const efectivoVentas = round2(efectivoDe(llevar) + efectivoDe(persona));

  const aValores = (b: Bloque, nombre: string): BloqueApertura => ({
    meseroId: b.meseroId,
    nombre,
    venta: parseFloat(b.venta) || 0,
    tarjetas: sumFromText(b.tarjetas),
    tarjetasDesglose: b.tarjetasDesglose,
    transferencia: sumFromText(b.transfer),
    transferDesglose: b.transferDesglose,
    gastos: b.gastos.filter((g) => g.concepto.trim() && g.monto).map((g) => ({ concepto: g.concepto.trim(), monto: parseFloat(g.monto) || 0 })),
  });

  return (
    <Sheet title="Corte de apertura" onClose={onClose}>
      <p className="hint">
        Lo que llevan hasta este momento las apps, {paraLlevar?.nombre || "el usuario de para llevar"} y quien abrió. Al guardarlo
        queda bloqueado; al cierre se escribe el total del día y la app resta esto.
      </p>
      {fondo && dejadoAyer && (
        <div className="apertura-bloque">
          <div className="apertura-bloque-titulo">
            <strong>Fondo</strong>
            <span>aparte de las ventas</span>
          </div>
          <div className="apertura-efectivo">
            <span>Se dejó ayer{dejadoAyer.nota ? ` (${dejadoAyer.nota})` : ""}</span>
            <span>{money(dejadoAyer.monto)}</span>
          </div>
          <div className="apertura-efectivo">
            <span>− Gastos pagados con el fondo</span>
            <span>−{money(fondo.gastos)}</span>
          </div>
          <div className="apertura-efectivo">
            <span>Queda (se entrega al dueño)</span>
            <strong>{money(fondo.queda)}</strong>
          </div>
          <p className="hint">Si algo se pagó con el fondo y no está, regístralo en Gastos con "Con el fondo que se dejó ayer".</p>
        </div>
      )}
      {!fondo && dejadoAyer && dejadoAyer.monto > 0 && (
        <p className="aviso-dejado">
          Ayer se dejaron <strong>{money(dejadoAyer.monto)}</strong>
          {dejadoAyer.nota ? ` (${dejadoAyer.nota})` : ""}. Si un gasto se pagó con ese dinero, regístralo en Gastos del día, no
          aquí.
        </p>
      )}
      <Field label="¿Quién abrió?">
        <select
          className="text-input"
          value={abrioId}
          onChange={(e) => {
            setAbrioId(e.target.value);
            setUsuarioId(usuarioDe(e.target.value));
          }}
        >
          <option value="">Selecciona quién abrió</option>
          {abren.map((a) => (
            <option key={a.empleadoId} value={a.empleadoId}>
              {a.nombre} · {a.marca === "X" ? "abre" : "dobla"} ({a.marca} en el horario)
            </option>
          ))}
          {otrosEmpleados.length > 0 && (
            <optgroup label="Otra persona">
              {otrosEmpleados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>
      {abren.length === 0 && <p className="hint">Nadie tiene X ni Z ese día en el horario: elige a mano quién abrió.</p>}
      <Field label="Su usuario en el sistema">
        <select className="text-input" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
          <option value="">Selecciona su usuario</option>
          {catalog
            .filter((c) => !c.acumulado)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </select>
      </Field>
      {!paraLlevar && (
        <Field label="Usuario de para llevar">
          <select className="text-input" value={llevar.meseroId} onChange={(e) => setLlevar({ ...llevar, meseroId: e.target.value })}>
            <option value="">Selecciona el usuario de para llevar</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="apertura-bloque">
        <div className="apertura-bloque-titulo">
          <strong>Apps</strong>
          <span>hasta ahora</span>
        </div>
        <Field label="Venta de apps">
          <NumInput value={apps} onChange={(e) => setApps(e.target.value)} placeholder="0.00" />
        </Field>
      </div>
      {bloqueUI(usuarioLlevar?.nombre || "Para llevar", llevar, setLlevar)}
      {bloqueUI(usuario?.nombre || nombreAbrio || "Quien abrió", persona, setPersona)}
      {fondo && (
        <div className="apertura-bloque">
          <div className="apertura-efectivo">
            <span>Efectivo de las ventas</span>
            <span>{money(efectivoVentas)}</span>
          </div>
          <div className="apertura-efectivo">
            <span>+ Fondo que queda</span>
            <span>{money(fondo.queda)}</span>
          </div>
          <div className="apertura-efectivo">
            <span>Se entrega al dueño</span>
            <strong>{money(round2(efectivoVentas + fondo.queda))}</strong>
          </div>
        </div>
      )}

      {intento && falta && (
        <p className="aviso-faltante">
          {!abrioId
            ? "Elige quién abrió."
            : !usuarioId
              ? "Elige su usuario en el sistema."
              : !llevar.meseroId
                ? "Elige el usuario de para llevar."
                : "El usuario de quien abrió no puede ser el de para llevar."}
        </p>
      )}
      <button
        className="btn-primary"
        onClick={() => {
          if (falta) {
            setIntento(true);
            return;
          }
          onGuardar({
            abrio: nombreAbrio ? { empleadoId: abrioId, nombre: nombreAbrio } : undefined,
            usuarioSistemaId: usuarioId,
            ventaApps: parseFloat(apps) || 0,
            bloques: [aValores(llevar, usuarioLlevar?.nombre || "Para llevar"), aValores({ ...persona, meseroId: usuarioId }, usuario?.nombre || "")],
          });
        }}
      >
        Guardar corte de apertura
      </button>
    </Sheet>
  );
}
