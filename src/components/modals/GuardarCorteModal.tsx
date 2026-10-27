import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Sheet } from "../ui";
import { addDaysIso, money } from "../../lib/dataModel";
import { supabase } from "../../lib/supabaseClient";
import { LinkBancario, VerComprobante } from "./ComprobanteJohnster";
import { compararSemana, type DiaComparado, type EstadoGasto, type JohnsterDatos } from "../../lib/cuadrar";
import type { DayData, DayName, EmpleadoEntry } from "../../lib/types";

// Revisión con Johnster antes de cerrar: las mismas secciones y notas que
// Corte › ⚖︎ Cuadrar (las notas de "Dejar así" son las mismas).
const SECCIONES_J: { clave: "venta" | "tarjetas" | "transferencias" | "efectivo" | "gastos"; titulo: string }[] = [
  { clave: "venta", titulo: "Venta" },
  { clave: "tarjetas", titulo: "Tarjetas" },
  { clave: "transferencias", titulo: "Transferencias" },
  { clave: "efectivo", titulo: "Efectivo de ventas" },
  { clave: "gastos", titulo: "Gastos en efectivo" },
];
const ETIQUETA_J: Record<Exclude<EstadoGasto, "igual">, string> = { "solo-tu": "Solo tú", "solo-johnster": "Solo Johnster", "otro-dia": "Otro día", "otro-monto": "Otro monto" };
const nombreDiaJ = (fecha: string) => new Date(`${fecha}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long" });
const ayudaGasto = (g: DiaComparado["gastos"][number]) =>
  g.junto
    ? "Súbelo al bot como 1 solo gasto (junta los de la semana)"
    : g.estado === "solo-tu"
      ? "Súbelo al bot como gasto en efectivo"
      : g.estado === "solo-johnster"
        ? "¿Repetido en el bot? Si es tuyo, agrégalo a tu corte"
        : g.estado === "otro-monto"
          ? `Johnster tiene ${money(g.montoJohnster!)}: corrige el monto en uno de los dos`
          : g.fechaJohnster
            ? `En Johnster está el ${nombreDiaJ(g.fechaJohnster)}: corrige la fecha en uno de los dos`
            : `En tu app está el ${nombreDiaJ(g.fechaTuya!)}: corrige la fecha en uno de los dos`;

// Lo que no deja terminar el corte: gastos en Pendiente (falta subir su
// comprobante al bot y tocar Confirmar), gastos incompletos y cortes de
// mesero sin venta.
export function faltantesDelCorte(day: DayData): { titulo: string; detalle: string }[] {
  const out: { titulo: string; detalle: string }[] = [];
  if (day.meseros.length === 0) out.push({ titulo: "Meseros", detalle: "No hay ningún corte de mesero capturado." });
  day.meseros.forEach((m) => {
    if (!(m.venta > 0)) out.push({ titulo: `Mesero ${m.nombre}`, detalle: "No tiene venta capturada." });
  });
  day.gastos.forEach((g) => {
    const titulo = `${g.concepto.trim() || "Gasto sin concepto"} · ${money(g.total)}`;
    const falta = [!g.concepto.trim() && "el concepto", !(g.total > 0) && "el monto", !g.categoria && "la categoría"].filter(
      Boolean
    ) as string[];
    if (falta.length > 0) out.push({ titulo, detalle: `Le falta ${falta.join(" y ")}.` });
    else if (g.estado === "pendiente") out.push({ titulo, detalle: "Sigue en Pendiente: sube el comprobante al bot y toca Confirmar." });
  });
  return out;
}

// "Guardar corte": si falta algo, avisa qué y no deja terminar; si está
// completo, pide palomear cada total y el recordatorio del bot antes de
// guardarlo (ya guardado, el personal ya no lo puede editar).
export function GuardarCorteModal({
  day,
  totals,
  onGuardar,
  onClose,
  fecha,
  semana,
  empleados,
  notas,
  onNota,
  esDueno,
}: {
  day: DayData;
  totals: { tarjetas: number; transferencias: number; gastos: number; ventaTotal: number; ventaApps: number };
  onGuardar: () => void;
  onClose: () => void;
  // Revisión con Johnster: fecha del día, los 7 días de su semana (para
  // emparejar gastos y juntar los del domingo), notas de Cuadrar y si es el
  // dueño (puede guardar sin revisar en una emergencia).
  fecha: string;
  semana: { dia: DayName; fecha: string; day: DayData | undefined }[];
  empleados: EmpleadoEntry[];
  notas: Record<string, string>;
  onNota: (clave: string, nota: string | undefined) => void;
  esDueno: boolean;
}) {
  const faltan = faltantesDelCorte(day);
  const [rev, setRev] = useState<{ estado: "cargando" | "error" | "listo"; datos?: JohnsterDatos; error?: string }>({ estado: "cargando" });
  const [sinRevisar, setSinRevisar] = useState(false);
  const [escribiendo, setEscribiendo] = useState<{ clave: string; texto: string } | null>(null);
  const [viendo, setViendo] = useState<{ id: string; concepto: string; monto: number } | null>(null);
  async function revisar() {
    if (!semana.length) return setRev({ estado: "error", error: "No se encontró la semana de este día." });
    setRev({ estado: "cargando" });
    const { data, error } = await supabase.functions.invoke("johnster", {
      body: { accion: "semana", desde: addDaysIso(semana[0].fecha, -1), hasta: addDaysIso(semana[semana.length - 1].fecha, 1) },
    });
    let msg: string | null = null;
    if (error) {
      const ctx = (error as { context?: Response }).context;
      msg = (ctx && (await ctx.json().catch(() => null))?.error) || "No se pudo conectar con Johnster.";
    } else if (data?.error) msg = data.error;
    setRev(msg ? { estado: "error", error: msg } : { estado: "listo", datos: data as JohnsterDatos });
  }
  useEffect(() => {
    if (faltan.length === 0) revisar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const renglones = [
    { key: "tarjetas", texto: "Total de tarjetas", monto: totals.tarjetas },
    { key: "transferencias", texto: "Total de transferencias", monto: totals.transferencias },
    { key: "gastos", texto: "Total de gastos", monto: totals.gastos },
    { key: "venta", texto: "Total de venta", monto: totals.ventaTotal },
    { key: "apps", texto: "Total de apps", monto: totals.ventaApps },
  ];
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  // Con la revisión de Johnster, el "ya subí todo al bot" lo comprueba la
  // app; solo se palomea a mano si se guarda sin revisar.
  const revisadoEnBot = !sinRevisar && !!rev.datos?.ingresos.some((i) => i.fecha === fecha);
  const todos = renglones.every((r) => marcados.has(r.key)) && (marcados.has("bot") || revisadoEnBot);

  if (faltan.length > 0) {
    return (
      <Sheet title="Todavía no puedes terminar el corte" onClose={onClose}>
        <p className="hint">
          Completa esto y vuelve a tocar <strong>Guardar corte</strong>:
        </p>
        <div className="gc-faltan">
          {faltan.map((f, i) => (
            <div key={i} className="gc-falta">
              <strong>{f.titulo}</strong>
              {f.detalle}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={onClose}>
          Ir a completar
        </button>
      </Sheet>
    );
  }

  const emergencia = esDueno && (
    <button className="link-btn gc-volver" onClick={() => setSinRevisar(true)}>
      Guardar sin revisar Johnster (emergencia)
    </button>
  );
  const datos = rev.datos;
  const sinDia = !!datos && !datos.ingresos.some((i) => i.fecha === fecha);
  const comp = datos && !sinDia ? compararSemana(semana, datos, empleados).find((d) => d.fecha === fecha) : undefined;
  const pendientes = comp
    ? SECCIONES_J.filter((s) => {
        const dif = comp.renglones.some((r) => r.clave === s.clave) || (s.clave === "gastos" && comp.gastos.length > 0);
        return dif && notas[`${s.clave}:${fecha}`] === undefined;
      })
    : [];
  if (!sinRevisar && rev.estado !== "listo") {
    return (
      <Sheet title={rev.estado === "cargando" ? "Revisando con Johnster…" : "No se pudo revisar con Johnster"} onClose={onClose}>
        {rev.estado === "cargando" ? (
          <p className="hint">Puede tardar hasta un minuto si el bot estaba dormido.</p>
        ) : (
          <>
            <p className="gc-aviso">{rev.error}</p>
            <button className="btn-primary" onClick={revisar}>
              Revisar de nuevo ↻
            </button>
          </>
        )}
        {emergencia}
      </Sheet>
    );
  }
  if (!sinRevisar && sinDia) {
    return (
      <Sheet title="Todavía no se puede guardar" onClose={onClose}>
        <p className="gc-aviso">
          Johnster todavía no tiene el corte del <strong>{nombreDiaJ(fecha)} {Number(fecha.slice(8))}</strong>. Súbelo al bot (corte de Toteat) y
          luego toca <strong>Revisar de nuevo</strong>.
        </p>
        <button className="btn-primary" onClick={revisar}>
          Revisar de nuevo ↻
        </button>
        <button className="link-btn gc-volver" onClick={onClose}>
          Volver
        </button>
        {emergencia}
      </Sheet>
    );
  }
  if (!sinRevisar && comp && pendientes.length > 0) {
    return (
      <Sheet title="Falta cuadrar con Johnster" onClose={onClose}>
        <p className="hint">Corrige en tu corte o en el bot y toca Revisar de nuevo. No se puede guardar hasta que cuadre o se anote por qué.</p>
        {SECCIONES_J.map((s) => {
          const r = comp.renglones.find((x) => x.clave === s.clave);
          const dif = !!r || (s.clave === "gastos" && comp.gastos.length > 0);
          const clave = `${s.clave}:${fecha}`;
          const nota = notas[clave];
          if (!dif) return null;
          return (
            <div key={s.clave} className="gc-j">
              <h4>
                {s.titulo} <span className={nota !== undefined ? "anotado" : ""}>{nota !== undefined ? "anotado" : "no cuadra"}</span>
              </h4>
              {r && (
                <div className="gc-j-renglon">
                  <span>
                    Tú {money(r.tuyo)} · Johnster {money(r.johnster)}
                  </span>
                  <b>
                    {r.dif > 0 ? "+" : "−"}
                    {money(Math.abs(r.dif))}
                  </b>
                </div>
              )}
              {s.clave === "gastos" &&
                comp.gastos.map((g, i) => (
                  <div key={i} className="gc-j-gasto">
                    <span>
                      <i className={g.estado}>{ETIQUETA_J[g.estado as Exclude<EstadoGasto, "igual">]}</i>
                      {g.concepto}
                      <small>{ayudaGasto(g)}</small>
                    </span>
                    <span>{money(g.monto)}</span>
                  </div>
                ))}
              {nota !== undefined ? (
                <p className="gc-j-nota">
                  ✎ “{nota}”{" "}
                  <button className="link-btn" onClick={() => onNota(clave, undefined)}>
                    Quitar nota
                  </button>
                </p>
              ) : escribiendo?.clave === clave ? (
                <div className="gc-j-escribir">
                  <textarea className="text-input" rows={2} placeholder="¿Por qué se deja así?" value={escribiendo.texto} onChange={(e) => setEscribiendo({ clave, texto: e.target.value })} autoFocus />
                  <button
                    className="btn-primary"
                    disabled={!escribiendo.texto.trim()}
                    onClick={() => {
                      onNota(clave, escribiendo.texto.trim());
                      setEscribiendo(null);
                    }}
                  >
                    Guardar nota
                  </button>
                </div>
              ) : (
                <button className="link-btn" onClick={() => setEscribiendo({ clave, texto: "" })}>
                  ✎ Dejar así y anotar por qué
                </button>
              )}
            </div>
          );
        })}
        <button className="btn-primary" onClick={revisar}>
          Revisar de nuevo ↻
        </button>
        <button className="link-btn gc-volver" onClick={onClose}>
          Volver a corregir
        </button>
        {emergencia}
      </Sheet>
    );
  }

  // Comprobantes en el bot: el bancario de tarjetas y el de cada gasto en
  // efectivo del día (las transferencias no llevan).
  const ing = datos?.ingresos.find((i) => i.fecha === fecha);
  const gastosBot = (datos?.gastos || []).filter((g) => g.fecha === fecha);
  const sinComprobante = gastosBot.filter((g) => g.comprobante === false);
  const faltaBancario = !!ing && ing.tarjetas > 0 && ing.comprobanteBancario === false;
  const claveComp = `comprobantes:${fecha}`;
  if (!sinRevisar && (faltaBancario || sinComprobante.length > 0) && notas[claveComp] === undefined) {
    return (
      <Sheet title="Faltan comprobantes en el bot" onClose={onClose}>
        <p className="hint">Todo cuadra, pero falta subir esto al bot. Súbelo y toca Revisar de nuevo.</p>
        <div className="gc-j">
          {faltaBancario && (
            <div className="gc-j-gasto">
              <span>
                <i>Falta</i>Comprobante bancario de tarjetas<small>El cierre de la terminal de este día ({money(ing!.tarjetas)})</small>
              </span>
            </div>
          )}
          {sinComprobante.map((g) => (
            <div key={g.id} className="gc-j-gasto">
              <span>
                <i>Sin comprobante</i>
                {g.concepto}
                <small>Sube su ticket en el bot</small>
              </span>
              <span>{money(g.monto)}</span>
            </div>
          ))}
          {escribiendo?.clave === claveComp ? (
            <div className="gc-j-escribir">
              <textarea className="text-input" rows={2} placeholder="¿Por qué no hay comprobante?" value={escribiendo.texto} onChange={(e) => setEscribiendo({ clave: claveComp, texto: e.target.value })} autoFocus />
              <button
                className="btn-primary"
                disabled={!escribiendo.texto.trim()}
                onClick={() => {
                  onNota(claveComp, escribiendo.texto.trim());
                  setEscribiendo(null);
                }}
              >
                Guardar nota
              </button>
            </div>
          ) : (
            <button className="link-btn" onClick={() => setEscribiendo({ clave: claveComp, texto: "" })}>
              ✎ Dejar así y anotar por qué
            </button>
          )}
        </div>
        <button className="btn-primary" onClick={revisar}>
          Revisar de nuevo ↻
        </button>
        <button className="link-btn gc-volver" onClick={onClose}>
          Volver
        </button>
        {emergencia}
      </Sheet>
    );
  }

  return (
    <Sheet title="¿Seguro guardar el corte?" onClose={onClose}>
      {sinRevisar || !ing ? (
        <p className="gc-aviso">Se guardará sin revisar con Johnster. Cuádralo después en ⚖︎ Cuadrar.</p>
      ) : (
        <div className="gc-revision">
          <span className="gc-revision-titulo">Revisado en el bot</span>
          <div>✓ Hay corte del {nombreDiaJ(fecha)} en el bot</div>
          <div>
            ✓ Tarjetas coinciden: {money(totals.tarjetas)}
            {ing.tarjetaCredito ? (
              <small>
                {" "}
                (bot: débito {money(ing.tarjetaDebito || 0)} + crédito {money(ing.tarjetaCredito)})
              </small>
            ) : null}
          </div>
          {faltaBancario ? (
            <div className="anotado">✎ Falta el comprobante bancario (anotado)</div>
          ) : (
            <div>
              {ing.tarjetas > 0 ? "✓ Comprobante bancario subido " : "✓ Sin tarjetas este día"}
              {ing.tarjetas > 0 && <LinkBancario url={ing.comprobanteUrl} />}
            </div>
          )}
          {sinComprobante.length ? (
            <div className="anotado">
              ✎ {sinComprobante.length} de {gastosBot.length} {gastosBot.length === 1 ? "gasto" : "gastos"} sin comprobante (anotado)
            </div>
          ) : (
            <div>✓ {gastosBot.length} {gastosBot.length === 1 ? "gasto" : "gastos"} en efectivo en el bot, todos con comprobante</div>
          )}
          {(faltaBancario || sinComprobante.length > 0) && <small className="anotado">Nota: “{notas[claveComp]}”</small>}
          {gastosBot.length > 0 && (
            <div className="gc-tickets">
              {gastosBot.map((g) => (
                <div key={g.id}>
                  <span>{g.concepto}</span>
                  <span>{money(g.monto)}</span>
                  {g.comprobante ? (
                    <button className="vc-ver" onClick={() => setViendo({ id: g.id, concepto: g.concepto, monto: g.monto })}>
                      Ver
                    </button>
                  ) : (
                    <span className="anotado">Sin ticket</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div>✓ Venta, transferencias, efectivo y gastos cuadran</div>
        </div>
      )}
      <p className="hint">
        Revisa que cada total coincida y márcalo. Al guardar, el corte <strong>ya no se podrá editar</strong>.
      </p>
      <div className="gc-lista">
        {renglones.map((r) => (
          <label key={r.key} className="gc-check">
            <input type="checkbox" checked={marcados.has(r.key)} onChange={() => toggle(r.key)} />
            <span>{r.texto}</span>
            <strong>{money(r.monto)}</strong>
          </label>
        ))}
        {(sinRevisar || !ing) && <label className="gc-check gc-bot">
          <input type="checkbox" checked={marcados.has("bot")} onChange={() => toggle("bot")} />
          <span>
            Ya subí al bot los comprobantes de <strong>gastos</strong>, <strong>bancarios</strong> y{" "}
            <strong>transferencias</strong>, y la <strong>venta</strong>.
          </span>
        </label>}
      </div>
      <button className="btn-primary" disabled={!todos} onClick={onGuardar}>
        <Lock size={16} /> Sí, todo coincide — guardar corte
      </button>
      <button className="link-btn gc-volver" onClick={onClose}>
        Volver a revisar
      </button>
      {viendo && <VerComprobante {...viendo} onClose={() => setViendo(null)} />}
    </Sheet>
  );
}
