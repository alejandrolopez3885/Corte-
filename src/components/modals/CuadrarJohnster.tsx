import { useEffect, useState } from "react";
import { Field, Sheet } from "../ui";
import { supabase } from "../../lib/supabaseClient";
import { compararSemana, type DiaComparado, type EstadoGasto, type JohnsterDatos } from "../../lib/cuadrar";
import type { DayData, DayName } from "../../lib/types";

// Corte › ⚖︎ Cuadrar: la semana contra Johnster Bot. Solo los días con
// diferencias, cada uno con su botón para ir a corregir ese día.
// Ver lib/cuadrar.ts y supabase/functions/johnster.

const pesos = (n: number) => `$${Math.abs(n).toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;
const conSigno = (n: number) => `${n > 0 ? "+" : "−"}${pesos(n)}`;
const DIA_CORTO: Record<DayName, string> = {
  Lunes: "lunes", Martes: "martes", Miércoles: "miércoles", Jueves: "jueves", Viernes: "viernes", Sábado: "sábado", Domingo: "domingo",
};
const nombreDia = (fecha: string) => new Date(`${fecha}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long" });
const ETIQUETA: Record<Exclude<EstadoGasto, "igual">, string> = {
  "solo-tu": "Solo tú",
  "solo-johnster": "Solo Johnster",
  "otro-dia": "Otro día",
  "otro-monto": "Otro monto",
};

function hace(iso: string | null) {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
}

export function CuadrarJohnster({
  titulo,
  dias,
  onIrADia,
  onClose,
}: {
  titulo: string;
  dias: { dia: DayName; fecha: string; day: DayData | undefined }[];
  onIrADia: (dia: DayName) => void;
  onClose: () => void;
}) {
  const [datos, setDatos] = useState<JohnsterDatos | null | undefined>(undefined);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");

  async function cargar() {
    const { data } = await supabase.from("johnster_datos").select("sucursal, ingresos, gastos, actualizado_en, error").maybeSingle();
    setDatos((data as JohnsterDatos | null) ?? null);
  }
  useEffect(() => {
    cargar();
  }, []);

  async function llamar(body: object) {
    setActualizando(true);
    setError(null);
    const { data, error: e } = await supabase.functions.invoke("johnster", { body });
    let msg: string | null = null;
    if (e) {
      // El mensaje de la función viene en la respuesta.
      const ctx = (e as { context?: Response }).context;
      msg = (ctx && (await ctx.json().catch(() => null))?.error) || "No se pudo conectar con Johnster. Intenta de nuevo.";
    } else if (data?.error) msg = data.error;
    setError(msg);
    if (!msg) {
      setConectando(false);
      setPassword("");
    }
    await cargar();
    setActualizando(false);
  }

  const conectado = !!datos?.actualizado_en;
  const formulario = (
    <div className="cj-conectar">
      <p className="hint">
        Escribe tu usuario y contraseña de Johnster Bot. Se guardan en Supabase (Vault), no en la app, y solo se usan para traer los datos de
        tu sucursal cada mañana.
      </p>
      <Field label="Usuario">
        <input className="text-input" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" autoComplete="username" />
      </Field>
      <Field label="Contraseña">
        <input className="text-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </Field>
      {error && <p className="cj-error">{error}</p>}
      <button className="btn-primary" disabled={actualizando || !usuario.trim() || !password} onClick={() => llamar({ accion: "conectar", usuario, password })}>
        {actualizando ? "Conectando… (puede tardar hasta un minuto)" : "Conectar con Johnster"}
      </button>
      {conectado && (
        <button className="link-btn" onClick={() => setConectando(false)}>
          Cancelar
        </button>
      )}
    </div>
  );

  let cuerpo;
  if (datos === undefined) cuerpo = <p className="hint">Cargando…</p>;
  else if (!conectado || conectando) cuerpo = formulario;
  else {
    const comparados = compararSemana(dias, datos);
    const conJohnster = comparados.filter((d) => !d.sinJohnster || d.renglones.length);
    const conDif = comparados.filter((d) => d.renglones.length || d.gastos.length);
    const ventaOk = conJohnster.every((d) => !d.renglones.some((r) => r.clave === "venta" || r.clave === "tarjetas"));
    const sinDatos = comparados.filter((d) => d.sinJohnster && !d.sinCorte);
    const nTransf = comparados.filter((d) => d.renglones.some((r) => r.clave === "transferencias")).length;
    const nGastos = comparados.filter((d) => d.renglones.some((r) => r.clave === "gastos")).length;
    cuerpo = (
      <>
        <div className="cj-sync">
          <span>{datos.sucursal || "Johnster"}</span>
          <button className="link-btn" disabled={actualizando} onClick={() => llamar({})}>
            {actualizando ? "Actualizando…" : `Actualizado ${hace(datos.actualizado_en)} ↻`}
          </button>
        </div>
        {(error || datos.error) && <p className="cj-error">No se pudo actualizar: {error || datos.error}</p>}
        {conJohnster.length === 0 ? (
          <p className="hint">Johnster todavía no tiene datos de esta semana.</p>
        ) : (
          <div className={`cj-resumen ${conDif.length ? "" : "todo"}`}>
            {ventaOk ? "✓ Venta y tarjetas cuadran." : "Hay días con diferencias en venta o tarjetas."}
            <br />
            {conDif.length
              ? `Diferencias en ${conDif.length} ${conDif.length === 1 ? "día" : "días"}${nTransf ? ` · transferencias (${nTransf})` : ""}${nGastos ? ` · gastos en efectivo (${nGastos})` : ""}.`
              : "¡Todo cuadra esta semana!"}
          </div>
        )}
        {conDif.map((d) => (
          <TarjetaDia
            key={d.fecha}
            d={d}
            onIr={() => {
              onIrADia(d.dia);
              onClose();
            }}
          />
        ))}
        {sinDatos.length > 0 && conJohnster.length > 0 && (
          <p className="hint">Johnster todavía no tiene: {sinDatos.map((d) => DIA_CORTO[d.dia]).join(", ")}.</p>
        )}
        <p className="hint">
          Diferencia = Johnster − tu corte. En venta, tarjetas, transferencias y efectivo, $5 o menos cuenta como que cuadra. Solo compara: no
          cambia nada ni en tu app ni en Johnster.
        </p>
        <button className="link-btn" onClick={() => setConectando(true)}>
          Cambiar usuario de Johnster
        </button>
      </>
    );
  }

  return (
    <Sheet title="Cuadrar con Johnster" onClose={onClose}>
      <p className="hint cj-sub">{titulo}</p>
      {cuerpo}
    </Sheet>
  );
}

function TarjetaDia({ d, onIr }: { d: DiaComparado; onIr: () => void }) {
  const n = d.renglones.length || 1;
  return (
    <div className="cj-dia">
      <h4>
        {d.dia} {Number(d.fecha.slice(8))}
        <span>
          {n} {n === 1 ? "diferencia" : "diferencias"}
        </span>
      </h4>
      {d.sinJohnster && <p className="hint">Johnster no tiene ingresos de este día.</p>}
      {d.renglones.map((r) => (
        <div key={r.clave}>
          <div className="cj-renglon">
            <span>
              {r.titulo}
              <small>
                Tú {pesos(r.tuyo)} · Johnster {pesos(r.johnster)}
              </small>
            </span>
            <b>{conSigno(r.dif)}</b>
          </div>
          {r.clave === "gastos" && <ListaGastos d={d} />}
        </div>
      ))}
      {d.gastos.length > 0 && !d.renglones.some((r) => r.clave === "gastos") && (
        <div>
          <div className="cj-renglon">
            <span>
              Gastos en efectivo<small>El total cuadra, pero no gasto por gasto</small>
            </span>
          </div>
          <ListaGastos d={d} />
        </div>
      )}
      <button className="cj-ir" onClick={onIr}>
        Ir al corte del {DIA_CORTO[d.dia]} ›
      </button>
    </div>
  );
}

function ListaGastos({ d }: { d: DiaComparado }) {
  return (
    <>
      {d.gastos.map((g, i) => (
              <div key={i} className="cj-gasto">
                <span>
                  <i className={g.estado}>{ETIQUETA[g.estado as Exclude<EstadoGasto, "igual">]}</i>
                  {g.concepto}
                  {g.estado === "otro-dia" && (
                    <small>{g.fechaJohnster ? ` · en Johnster el ${nombreDia(g.fechaJohnster)}` : ` · en tu app el ${nombreDia(g.fechaTuya!)}`}</small>
                  )}
                  {g.estado === "otro-monto" && <small> · Johnster {pesos(g.montoJohnster!)}</small>}
                </span>
                <span>{pesos(g.monto)}</span>
              </div>
      ))}
    </>
  );
}
