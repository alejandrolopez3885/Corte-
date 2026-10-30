import { useEffect, useMemo, useState } from "react";
import { useAlRecargar } from "../JalarParaActualizar";
import { Field } from "../ui";
import { MarcoAsistente } from "./asistente";
import { VerComprobante, type Comprobante } from "./ComprobanteJohnster";
import { supabase } from "../../lib/supabaseClient";
import { adelantosEnSuDia, cierreSemana, compararSemana, type DiaComparado, type EstadoGasto, type JohnsterDatos, type Renglon } from "../../lib/cuadrar";
import type { CuadreSemana, DayData, DayName, EmpleadoEntry } from "../../lib/types";

// Corte › ⚖︎ Cuadrar: la semana contra Johnster Bot, paso a paso. Orden:
// Ventas → Tarjetas → Transferencias → Efectivo de ventas → Gastos en
// efectivo → Resumen. Cada sección empieza con los 7 días de un vistazo y
// luego una pantalla por cada día que no cuadra: no se avanza hasta que
// cuadre (corrigiendo en el corte o en Johnster y "Revisar de nuevo") o se
// deje así con una nota. El avance se guarda en la semana (WeekData.cuadre)
// y al confirmar queda el sello. Ver lib/cuadrar.ts y supabase/functions/johnster.

type Seccion = "venta" | "tarjetas" | "transferencias" | "efectivo" | "gastos";
const SECCIONES: { clave: Seccion; titulo: string; pregunta: string; ayuda: string; nombre: string; frase: string }[] = [
  { clave: "venta", titulo: "Ventas", pregunta: "¿Cuadran las ventas?", ayuda: "Venta total de cada día (meseros + apps) contra Johnster.", nombre: "venta", frase: "no cuadra la venta" },
  { clave: "tarjetas", titulo: "Tarjetas", pregunta: "¿Cuadran las tarjetas?", ayuda: "Débito y crédito de cada día contra Johnster.", nombre: "tarjetas", frase: "no cuadran las tarjetas" },
  { clave: "transferencias", titulo: "Transferencias", pregunta: "¿Cuadran las transferencias?", ayuda: "Transferencias de cada día contra Johnster.", nombre: "transferencias", frase: "no cuadran las transferencias" },
  {
    clave: "efectivo",
    titulo: "Efectivo de ventas",
    pregunta: "¿Cuadra el efectivo de ventas?",
    ayuda: "Venta en sala − tarjetas − transferencias. Si ya corregiste tarjetas y transferencias, normalmente ya cuadra.",
    nombre: "efectivo de ventas",
    frase: "no cuadra el efectivo de ventas",
  },
  { clave: "gastos", titulo: "Gastos en efectivo", pregunta: "¿Cuadran los gastos en efectivo?", ayuda: "Total de gastos en efectivo de cada día contra Johnster.", nombre: "gastos en efectivo", frase: "no cuadran los gastos en efectivo" },
];

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

const renglonDe = (d: DiaComparado, s: Seccion) => d.renglones.find((r) => r.clave === s);
const tieneDif = (d: DiaComparado, s: Seccion) => !!renglonDe(d, s) || (s === "gastos" && d.gastos.length > 0);

export function CuadrarJohnster({
  titulo,
  dias,
  cuadre,
  empleados,
  onGuardarCuadre,
  onIrADia,
  onMoverGasto,
  onSincronizar,
  onClose,
}: {
  titulo: string;
  dias: { dia: DayName; fecha: string; day: DayData | undefined }[];
  cuadre: CuadreSemana | undefined;
  empleados: EmpleadoEntry[];
  onGuardarCuadre: (c: CuadreSemana | undefined) => void;
  onIrADia: (dia: DayName) => void;
  // "Otro día": pasa tu gasto a la fecha en que está en Johnster.
  onMoverGasto: (desde: string, hasta: string, gastoId: string) => void;
  // Con los datos del bot se actualiza el estado de los gastos de la semana.
  onSincronizar?: (j: JohnsterDatos) => void;
  onClose: () => void;
}) {
  const [datos, setDatos] = useState<JohnsterDatos | null | undefined>(undefined);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [paso, setPaso] = useState("inicio");
  const [escribiendoNota, setEscribiendoNota] = useState<string | null>(null);
  const [viendoBancario, setViendoBancario] = useState<Comprobante | null>(null);

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
  useAlRecargar(() => conectado && llamar({}));
  useEffect(() => {
    if (datos?.actualizado_en) onSincronizar?.(datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);
  const comparados = useMemo(() => (datos && conectado ? compararSemana(dias, datos, empleados) : []), [datos, conectado, dias, empleados]);
  // Cierre de la semana (antes de los gastos): lo que se sube junto a Johnster.
  const cierre = useMemo(() => cierreSemana(dias, empleados, adelantosEnSuDia(dias, datos, empleados)), [dias, empleados, datos]);
  const hayCierre = cierre.adelantos.length > 0 || cierre.comidas.length > 0;
  const notas = cuadre?.notas || {};
  const vistos = cuadre?.vistos || [];

  // Los pasos: cada sección (vistazo) + sus días con diferencia (o que ya
  // salieron antes, para que el avance no brinque al corregir) + resumen.
  const pasos = useMemo(() => {
    const lista: string[] = [];
    SECCIONES.forEach((s) => {
      if (s.clave === "gastos" && hayCierre) lista.push("cierre");
      lista.push(s.clave);
      comparados.forEach((d) => {
        const clave = `${s.clave}:${d.fecha}`;
        if (tieneDif(d, s.clave) || vistos.includes(clave) || notas[clave] !== undefined) lista.push(clave);
      });
    });
    lista.push("resumen");
    return lista;
  }, [comparados, vistos, notas, hayCierre]);
  const resuelto = (clave: string) => {
    const [s, fecha] = clave.split(":") as [Seccion, string | undefined];
    if (!fecha) return true;
    const d = comparados.find((x) => x.fecha === fecha);
    return !d || !tieneDif(d, s) || notas[clave] !== undefined;
  };
  const pendientes = pasos.filter((p) => p.includes(":") && !resuelto(p));
  // Firma de lo comparado: si cambia después de confirmar, hay que volver a cuadrar.
  const firma = useMemo(
    () =>
      JSON.stringify(comparados.map((d) => [d.fecha, d.todos.map((r) => [r.clave, r.tuyo, r.johnster]), d.gastos.map((g) => [g.estado, g.monto])])),
    [comparados]
  );

  const indice = Math.max(0, pasos.indexOf(paso));
  const porcentaje = paso === "inicio" ? cuadre?.porcentaje || 0 : Math.round((indice / Math.max(1, pasos.length - 1)) * 100);
  function ir(destino: string) {
    setPaso(destino);
    setEscribiendoNota(null);
    if (destino === "inicio") return;
    const nuevosVistos = destino.includes(":") && !vistos.includes(destino) ? [...vistos, destino] : vistos;
    const pct = Math.round((pasos.indexOf(destino) / Math.max(1, pasos.length - 1)) * 100);
    onGuardarCuadre({ ...cuadre, actual: destino, porcentaje: pct, vistos: nuevosVistos });
  }
  function guardarNota(clave: string, nota: string | undefined) {
    const n = { ...notas };
    if (nota === undefined) delete n[clave];
    else n[clave] = nota;
    onGuardarCuadre({ ...cuadre, notas: n });
    setEscribiendoNota(null);
  }

  // ---------- Pantallas ----------
  let pregunta: React.ReactNode = null;
  let cuerpo: React.ReactNode = null;
  let pie: React.ReactNode = null;
  let avance = titulo;

  const btnAtras = (
    <button type="button" className="ca-boton secundario" onClick={() => ir(indice > 0 ? pasos[indice - 1] : "inicio")}>
      Atrás
    </button>
  );
  const btnSiguiente = (habilitado: boolean) => (
    <button type="button" className="ca-boton" disabled={!habilitado} onClick={() => ir(pasos[indice + 1])}>
      Siguiente
    </button>
  );
  const sync = datos && conectado && (
    <div className="cj-sync">
      <span>{datos.sucursal || "Johnster"}</span>
      <button className="link-btn" disabled={actualizando} onClick={() => llamar({})}>
        {actualizando ? "Trayendo datos de Johnster…" : `Johnster actualizado ${hace(datos.actualizado_en)} ↻`}
      </button>
    </div>
  );
  const errorSync = (error || datos?.error) && <p className="cj-error">No se pudo actualizar: {error || datos?.error}</p>;

  if (datos === undefined) {
    cuerpo = <p className="ca-ayuda">Cargando…</p>;
  } else if (!conectado || conectando) {
    pregunta = "Conectar con Johnster";
    cuerpo = (
      <div className="cj-conectar">
        <p className="ca-ayuda">
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
      </div>
    );
    pie = (
      <>
        {conectado && (
          <button type="button" className="ca-boton secundario" onClick={() => setConectando(false)}>
            Cancelar
          </button>
        )}
        <button className="ca-boton" disabled={actualizando || !usuario.trim() || !password} onClick={() => llamar({ accion: "conectar", usuario, password })}>
          {actualizando ? "Conectando… (hasta 1 min)" : "Conectar"}
        </button>
      </>
    );
  } else if (paso === "inicio") {
    const sinNada = comparados.every((d) => d.sinJohnster && !d.todos.length);
    const confirmadoVigente = cuadre?.confirmado && cuadre.confirmado.firma === firma;
    const cambio = cuadre?.confirmado && cuadre.confirmado.firma !== firma;
    const fechaSello = cuadre?.confirmado && new Date(cuadre.confirmado.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    pregunta = confirmadoVigente ? "✓ Semana cuadrada" : cuadre?.actual ? `Vas en ${cuadre.porcentaje || 0}%` : "Cuadrar la semana con Johnster";
    cuerpo = (
      <>
        {sync}
        {errorSync}
        {confirmadoVigente && <p className="cj-sello">✓ Cuadrada con Johnster el {fechaSello}.</p>}
        {cambio && <p className="cj-error">⚠ Algo cambió desde que la cuadraste el {fechaSello}. Hay que volver a cuadrar.</p>}
        {!confirmadoVigente && cuadre?.actual && cuadre.actual !== "resumen" && (
          <p className="ca-ayuda">
            Te quedaste en <b>{tituloPaso(cuadre.actual)}</b>. Lo que ya respondiste se guardó.
          </p>
        )}
        {sinNada ? (
          <p className="ca-ayuda">Johnster todavía no tiene datos de esta semana.</p>
        ) : (
          <div className="cj-secciones">
            {SECCIONES.map((s) => {
              const dif = comparados.filter((d) => tieneDif(d, s.clave));
              const faltan = dif.filter((d) => !resuelto(`${s.clave}:${d.fecha}`));
              return (
                <div key={s.clave} className="cj-seccion">
                  <span className={`cj-num ${faltan.length ? "r" : "v"}`}>{faltan.length || "✓"}</span>
                  <span>
                    {s.titulo}
                    <small>
                      {faltan.length
                        ? `${faltan.length} ${faltan.length === 1 ? "día" : "días"} por revisar`
                        : dif.length
                          ? "Revisado (con nota)"
                          : "Cuadran todos los días"}
                    </small>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <button className="link-btn" onClick={() => setConectando(true)}>
          Cambiar usuario de Johnster
        </button>
      </>
    );
    pie = sinNada ? null : cambio ? (
      <button className="ca-boton" onClick={() => {
        onGuardarCuadre({ ...cuadre, confirmado: undefined, actual: pasos[0], porcentaje: 0 });
        setPaso(pasos[0]);
      }}>
        Volver a cuadrar
      </button>
    ) : confirmadoVigente ? (
      <button className="ca-boton" onClick={() => ir("resumen")}>
        Ver resumen
      </button>
    ) : (
      <button className="ca-boton" onClick={() => ir(cuadre?.actual && pasos.includes(cuadre.actual) ? cuadre.actual : pasos[0])}>
        {cuadre?.actual ? "Continuar donde me quedé" : "Empezar"}
      </button>
    );
  } else if (paso === "resumen") {
    avance = `Paso ${pasos.length} de ${pasos.length}`;
    pregunta = pendientes.length ? "Todavía falta cuadrar" : "¿Todo cuadra con Johnster?";
    const conNota = Object.entries(notas).filter(([k]) => pasos.includes(k) && k.includes(":"));
    cuerpo = (
      <>
        {sync}
        <div className="cj-secciones">
          {SECCIONES.map((s) => {
            const dif = comparados.filter((d) => tieneDif(d, s.clave));
            const faltan = dif.filter((d) => !resuelto(`${s.clave}:${d.fecha}`));
            const conJ = comparados.filter((d) => !d.sinJohnster).length;
            return (
              <button key={s.clave} type="button" className="cj-seccion" onClick={() => faltan.length && ir(`${s.clave}:${faltan[0].fecha}`)}>
                <span className={`cj-num ${faltan.length ? "r" : "v"}`}>{faltan.length || "✓"}</span>
                <span>
                  {s.titulo}
                  <small>
                    {faltan.length
                      ? `Falta: ${faltan.map((d) => DIA_CORTO[d.dia]).join(", ")} ›`
                      : s.clave === "gastos"
                        ? `${comparados.reduce((t, d) => t + d.iguales, 0)} gastos iguales${dif.length ? ` · ${dif.length} con nota` : ""}`
                        : `${conJ - dif.length} de ${conJ} días cuadran${dif.length ? ` · ${dif.length} con nota` : ""}`}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
        {conNota.map(([k, nota]) => (
          <p key={k} className="cj-nota">
            ✎ {tituloPaso(k)}: “{nota}”
          </p>
        ))}
        {!pendientes.length && (
          <p className="cj-sello">
            Al confirmar, la semana queda <b>✓ Cuadrada con Johnster</b>. Si después cambia algo, al entrar a Cuadrar te avisa que hay que volver a
            cuadrar.
          </p>
        )}
      </>
    );
    pie = (
      <>
        {btnAtras}
        <button
          className="ca-boton"
          disabled={pendientes.length > 0 || !!(cuadre?.confirmado && cuadre.confirmado.firma === firma)}
          onClick={() => {
            onGuardarCuadre({ ...cuadre, actual: "resumen", porcentaje: 100, confirmado: { fecha: new Date().toISOString(), firma } });
            onClose();
          }}
        >
          {cuadre?.confirmado && cuadre.confirmado.firma === firma ? "✓ Cuadrada" : "Confirmar: la semana cuadra"}
        </button>
      </>
    );
  } else if (paso === "cierre") {
    avance = `Cierre de la semana · paso ${indice + 1} de ${pasos.length}`;
    pregunta = "Antes de los gastos: cierre de la semana";
    const dom = dias[dias.length - 1];
    cuerpo = (
      <>
        <p className="ca-ayuda">No se mueve nada en tu corte ni en la nómina: solo te dice cómo subirlos a Johnster.</p>
        {cierre.adelantos.map((a) => (
          <div key={a.nombre} className="cj-cierre">
            <h4>Adelantos de {a.nombre} → 1 gasto el domingo</h4>
            {a.items.map((x, i) => (
              <div key={i} className="cj-fila">
                <span>
                  {nombreDia(x.fecha)} {Number(x.fecha.slice(8))}
                </span>
                <span>{pesos(x.monto)}</span>
              </div>
            ))}
            <div className="cj-fila total">
              <span>{a.concepto}</span>
              <span>{pesos(a.total)}</span>
            </div>
            <p className="cj-sube">
              Súbelo al bot el <b>{DIA_CORTO[dom.dia]} {Number(dom.fecha.slice(8))}</b> como “Otro · Nómina”, en efectivo.
            </p>
          </div>
        ))}
        {cierre.comidas.map((c) => {
          const rebajan = c.items.filter((x) => x.rebaja > 0);
          return (
            <div key={c.nombre} className="cj-cierre">
              <h4>
                Comidas de {c.nombre} · {c.porSemana} gratis de {pesos(c.valor)}
              </h4>
              {c.items.map((x, i) => (
                <div key={i} className="cj-fila">
                  <span>
                    {nombreDia(x.fecha).slice(0, 3)} {Number(x.fecha.slice(8))} · {pesos(x.monto)}
                  </span>
                  {x.rebaja === 0 ? (
                    <span className="gratis">Gratis</span>
                  ) : x.gratis > 0 ? (
                    <span className="rebaja">
                      {pesos(x.gratis)} gratis · se rebaja {pesos(x.rebaja)}
                    </span>
                  ) : (
                    <span className="rebaja">Se rebaja {pesos(x.rebaja)}</span>
                  )}
                </div>
              ))}
              <p className="cj-sube">
                {c.totalGratis > 0 && (
                  <>
                    Sube el <b>{DIA_CORTO[dom.dia]}</b> 1 gasto “Comida empleado” de <b>{pesos(c.totalGratis)}</b> (no se rebaja)
                  </>
                )}
                {c.totalGratis > 0 && rebajan.length > 0 && " y "}
                {rebajan.length > 0 && <>{rebajan.length === 1 ? "el que se rebaja en su día" : "los que se rebajan cada uno en su día"} como “Otro · Nómina”</>}.
              </p>
            </div>
          );
        })}
      </>
    );
    pie = (
      <>
        {btnAtras}
        <button type="button" className="ca-boton" onClick={() => ir(pasos[indice + 1])}>
          Entendido, seguir
        </button>
      </>
    );
  } else if (!paso.includes(":")) {
    // Vistazo de una sección: los 7 días.
    const s = SECCIONES.find((x) => x.clave === paso)!;
    avance = `${s.titulo} · paso ${indice + 1} de ${pasos.length}`;
    pregunta = s.pregunta;
    const dif = comparados.filter((d) => tieneDif(d, s.clave));
    cuerpo = (
      <>
        <p className="ca-ayuda">{s.ayuda}</p>
        <div className="cj-lista">
          {comparados.map((d) => {
            const r = d.todos.find((x) => x.clave === s.clave);
            const mal = tieneDif(d, s.clave);
            return (
              <div key={d.fecha}>
                <span>
                  {d.dia.slice(0, 3)} {Number(d.fecha.slice(8))}
                </span>
                {!r ? (
                  <b className="sin">Johnster no tiene este día</b>
                ) : mal ? (
                  <b className="df">
                    {pesos(r.tuyo)} vs {pesos(r.johnster)}
                    {notas[`${s.clave}:${d.fecha}`] !== undefined ? " ✎" : ""}
                  </b>
                ) : (
                  <b className="ok">{pesos(r.tuyo)} ✓</b>
                )}
              </div>
            );
          })}
        </div>
        {dif.length === 0 ? (
          <p className="cj-ok">✓ {s.titulo === "Ventas" ? "Las ventas cuadran" : `${s.titulo} cuadran`} todos los días</p>
        ) : (
          <p className="ca-ayuda">
            {dif.length} {dif.length === 1 ? "día no cuadra" : "días no cuadran"}: vamos uno por uno.
          </p>
        )}
      </>
    );
    pie = (
      <>
        {btnAtras}
        {btnSiguiente(true)}
      </>
    );
  } else {
    // Un día de una sección.
    const [sc, fecha] = paso.split(":") as [Seccion, string];
    const s = SECCIONES.find((x) => x.clave === sc)!;
    const d = comparados.find((x) => x.fecha === fecha);
    const r: Renglon | undefined = d && (renglonDe(d, sc) || d.todos.find((x) => x.clave === sc));
    const cuadraYa = !!d && !tieneDif(d, sc);
    const nota = notas[paso];
    avance = `${s.titulo} · paso ${indice + 1} de ${pasos.length}`;
    pregunta = d ? `${d.dia} ${Number(fecha.slice(8))}: ${cuadraYa ? "ya cuadra" : s.frase}` : s.titulo;
    cuerpo = d && (
      <>
        {r && (
          <div className="cj-cmp">
            <div>
              <small>Tu corte</small>
              <b>{pesos(r.tuyo)}</b>
            </div>
            <div>
              <small>Johnster</small>
              <b>{pesos(r.johnster)}</b>
            </div>
            <div className={cuadraYa ? "ok" : "df"}>
              <small>Diferencia</small>
              <b>{Math.abs(r.dif) < 0.01 ? "✓" : conSigno(r.dif)}</b>
            </div>
          </div>
        )}
        {sc === "tarjetas" && (() => {
          const ing = datos?.ingresos.find((x) => x.fecha === fecha);
          return ing?.comprobanteBancario ? (
            <p className="cj-bancario">
              Comprobante bancario del día{" "}
              <button
                type="button"
                className="vc-ver"
                onClick={() => setViendoBancario({ pedido: { fecha }, titulo: "Comprobante bancario de tarjetas", monto: ing.tarjetas, drive: ing.comprobanteUrl })}
              >
                Ver
              </button>
            </p>
          ) : null;
        })()}
        {cuadraYa ? (
          <p className="cj-ok">✓ Ya cuadra. Sigue con el siguiente paso.</p>
        ) : (
          <>
            {sc !== "gastos" && r && (
              <p className="ca-ayuda">
                {r.dif > 0 ? `Johnster tiene ${pesos(r.dif)} más que tu corte` : `Tu corte tiene ${pesos(r.dif)} más que Johnster`} en{" "}
                {s.nombre}. Corrige donde esté mal y luego revisa de nuevo.
              </p>
            )}
            {sc === "gastos" && <ListaGastos d={d} dias={dias} onMover={onMoverGasto} />}
          </>
        )}
        {sync}
        {errorSync}
        {!cuadraYa && (
          <div className="cj-acciones">
            <button
              type="button"
              className="ca-opcion"
              onClick={() => {
                onIrADia(d.dia);
                onClose();
              }}
            >
              <span>
                Corregir en mi corte del {DIA_CORTO[d.dia]} ›<small className="ca-sub">Te lleva al día; al volver a Cuadrar sigues aquí.</small>
              </span>
            </button>
            <button type="button" className="ca-opcion" disabled={actualizando} onClick={() => llamar({})}>
              <span>
                {actualizando ? "Trayendo datos de Johnster…" : "Ya lo corregí en Johnster · Revisar de nuevo ↻"}
                <small className="ca-sub">Vuelve a traer los datos del bot.</small>
              </span>
            </button>
            {nota !== undefined ? (
              <p className="cj-nota">
                ✎ Se dejó así: “{nota}”{" "}
                <button className="link-btn" onClick={() => guardarNota(paso, undefined)}>
                  Quitar nota
                </button>
              </p>
            ) : escribiendoNota !== null ? (
              <div className="cj-escribir">
                <textarea className="text-input" rows={2} placeholder="¿Por qué se deja así? Ej. ticket redondeado" value={escribiendoNota} onChange={(e) => setEscribiendoNota(e.target.value)} autoFocus />
                <button className="btn-primary" disabled={!escribiendoNota.trim()} onClick={() => guardarNota(paso, escribiendoNota.trim())}>
                  Guardar nota
                </button>
              </div>
            ) : (
              <button className="link-btn cj-dejar" onClick={() => setEscribiendoNota("")}>
                Dejar así y anotar por qué
              </button>
            )}
          </div>
        )}
      </>
    );
    pie = (
      <>
        {btnAtras}
        {btnSiguiente(resuelto(paso))}
      </>
    );
  }

  function tituloPaso(clave: string) {
    const [sc, fecha] = clave.split(":");
    const s = SECCIONES.find((x) => x.clave === sc);
    if (clave === "cierre") return "Cierre de la semana";
    return fecha ? `${s?.titulo} · ${nombreDia(fecha)} ${Number(fecha.slice(8))}` : s?.titulo || clave;
  }

  return (
    <MarcoAsistente titulo="Cuadrar con Johnster" avance={avance} porcentaje={porcentaje} clavePaso={paso} onClose={onClose} pie={pie}>
      {pregunta && <h2 className="ca-pregunta">{pregunta}</h2>}
      {cuerpo}
      {viendoBancario && <VerComprobante {...viendoBancario} onClose={() => setViendoBancario(null)} />}
    </MarcoAsistente>
  );
}

function ListaGastos({
  d,
  dias,
  onMover,
}: {
  d: DiaComparado;
  dias: { fecha: string; day: DayData | undefined }[];
  onMover: (desde: string, hasta: string, gastoId: string) => void;
}) {
  const [viendo, setViendo] = useState<Comprobante | null>(null);
  // Solo cambia la fecha en tu corte (Johnster no se toca). Si el gasto era
  // del corte de un mesero, sale de ese corte.
  const mover = (g: DiaComparado["gastos"][number]) => {
    if (g.estado !== "otro-dia" || !g.gastoId) return null;
    const desde = g.fechaJohnster ? d.fecha : g.fechaTuya!;
    const hasta = g.fechaJohnster || d.fecha;
    // Solo dentro de la semana: una semana ya cerrada no se toca.
    if (!dias.some((x) => x.fecha === desde) || !dias.some((x) => x.fecha === hasta)) return null;
    const mesero = dias.find((x) => x.fecha === desde)?.day?.gastos.find((x) => x.id === g.gastoId)?.meseroNombre;
    return { desde, hasta, gastoId: g.gastoId, mesero };
  };
  const ayuda = (g: DiaComparado["gastos"][number]) =>
    g.estado === "solo-tu"
      ? "Súbelo al bot como gasto en efectivo"
      : g.estado === "solo-johnster"
        ? "¿Repetido en el bot? Si es tuyo, agrégalo a tu corte"
        : g.estado === "otro-monto"
          ? `Tú ${pesos(g.monto)} · Johnster ${pesos(g.montoJohnster!)}: corrige el monto en uno de los dos`
          : g.fechaJohnster
            ? `En Johnster está el ${nombreDia(g.fechaJohnster)}: corrige la fecha en uno de los dos`
            : `En tu app está el ${nombreDia(g.fechaTuya!)}: corrige la fecha en uno de los dos`;
  return (
    <div className="cj-gastos">
      {d.gastos.map((g, i) => (
        <div key={i} className="cj-gasto">
          <span>
            <i className={g.estado}>{ETIQUETA[g.estado as Exclude<EstadoGasto, "igual">]}</i>
            {g.junto && <i className="junto">Junto</i>}
            {g.concepto}
            <small>
              {g.junto
                ? `${g.junto.map((x) => `${nombreDia(x.fecha).slice(0, 3)} ${pesos(x.monto)}`).join(" · ")} · súbelo al bot como 1 solo gasto`
                : ayuda(g)}
            </small>
          </span>
          <b>
            {pesos(g.monto)}
            {g.ticketId && (
              <button type="button" className="vc-ver" onClick={() => setViendo({ pedido: { id: g.ticketId! }, titulo: g.concepto, monto: g.montoJohnster ?? g.monto })}>
                Ver ticket
              </button>
            )}
          </b>
          {(() => {
            const m = mover(g);
            return (
              m && (
                <button type="button" className="cj-mover" onClick={() => onMover(m.desde, m.hasta, m.gastoId)}>
                  Cambiar a {nombreDia(m.hasta)} {Number(m.hasta.slice(8))} en mi corte
                  {m.mesero && <small>Se quita del corte de {m.mesero} del {nombreDia(m.desde)}: le sube su efectivo a entregar</small>}
                </button>
              )
            );
          })()}
        </div>
      ))}
      {viendo && <VerComprobante {...viendo} onClose={() => setViendo(null)} />}
    </div>
  );
}
