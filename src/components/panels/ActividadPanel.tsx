import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, History, LogIn, LogOut, Search, X } from "lucide-react";
import { Empty } from "../ui";
import { addDaysIso, formatAssignedDate, formatWeekRange, todayIso } from "../../lib/dataModel";
import { cargarBitacora, type RenglonBitacora } from "../../lib/bitacora";

// Negocio > Análisis > Actividad: la bitácora de la app ordenada para
// revisarla y estudiar el uso, en tres pestañas — Resumen (lo importante de
// la semana y alertas), Personas (quién usa qué y cuándo) e Historial (cada
// cambio, con búsqueda y chips). Solo lectura.

type Tab = "resumen" | "personas" | "historial";
type FiltroEspecial = "eliminaciones" | "madrugada" | "tarde" | null;

// Pantallas que se registran al abrirse — para avisar cuáles nadie abrió.
const PANTALLAS = [
  "Corte", "Dashboard", "Personal", "Horarios", "Nómina", "Propinas", "Tendencias", "Control de Bar",
  "Control de Cocina", "Control General", "Inventario", "Pedidos", "Control de gastos en efectivo",
  "Control de gastos en transferencia", "Conteo diario",
];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function lunesDe(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const dia = (d.getDay() + 6) % 7;
  return addDaysIso(iso, -dia);
}

function fechaLocal(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const horaLocal = (ts: string) => new Date(ts).getHours();
const seccionDe = (r: RenglonBitacora) => (r.tipo === "cambio" ? r.seccion || "Otros" : r.tipo === "vista" ? "Pantallas" : "Sesiones");
const eliminaciones = (r: RenglonBitacora) => (r.detalle || []).filter((c) => c.accion === "eliminó").length;
const esMadrugada = (r: RenglonBitacora) => r.tipo === "cambio" && horaLocal(r.creado_en) >= 2 && horaLocal(r.creado_en) < 6;
// Cambio a un corte/día más de un día después de su fecha.
const esTarde = (r: RenglonBitacora) => r.tipo === "cambio" && !!r.ref_fecha && fechaLocal(r.creado_en) > addDaysIso(r.ref_fecha, 1);

export function ActividadPanel({ onBack, ownerId }: { onBack: () => void; ownerId: string }) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [lunes, setLunes] = useState(() => lunesDe(todayIso()));
  const [estado, setEstado] = useState<{ cargando: boolean; error?: string; renglones: RenglonBitacora[] }>({ cargando: true, renglones: [] });
  // Filtros del Historial (también los ponen el Resumen y Personas).
  const [busqueda, setBusqueda] = useState("");
  const [chip, setChip] = useState("Todo");
  const [persona, setPersona] = useState<string | null>(null);
  const [especial, setEspecial] = useState<FiltroEspecial>(null);

  // Se carga la semana elegida y la anterior (para comparar).
  useEffect(() => {
    let cancelado = false;
    const desde = new Date(`${addDaysIso(lunes, -7)}T00:00:00`).toISOString();
    const hasta = new Date(`${addDaysIso(lunes, 7)}T00:00:00`).toISOString();
    cargarBitacora(ownerId, desde, hasta).then(({ data, error }) => {
      if (cancelado) return;
      if (error) {
        const faltaTabla = error.code === "42P01" || /bitacora/i.test(error.message);
        setEstado({
          cargando: false,
          renglones: [],
          error: faltaTabla
            ? "Falta activar la actividad: corre una vez en Supabase supabase/migration_007_bitacora.sql y luego supabase/migration_008_bitacora_actividad.sql."
            : "No se pudo cargar la actividad. Revisa tu conexión.",
        });
        return;
      }
      setEstado({ cargando: false, renglones: (data || []) as RenglonBitacora[] });
    });
    return () => {
      cancelado = true;
    };
  }, [ownerId, lunes]);

  const { semana, anterior } = useMemo(() => {
    const semana: RenglonBitacora[] = [];
    const anterior: RenglonBitacora[] = [];
    estado.renglones.forEach((r) => (fechaLocal(r.creado_en) >= lunes ? semana : anterior).push(r));
    return { semana, anterior };
  }, [estado.renglones, lunes]);

  function moverSemana(dias: number) {
    setEstado((s) => ({ ...s, cargando: true }));
    setLunes((l) => addDaysIso(l, dias));
  }

  function irAlHistorial(filtros: { especial?: FiltroEspecial; persona?: string | null; chip?: string }) {
    setEspecial(filtros.especial ?? null);
    setPersona(filtros.persona ?? null);
    setChip(filtros.chip ?? "Todo");
    setBusqueda("");
    setTab("historial");
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Actividad</h2>

      <div className="segmented">
        {(["resumen", "personas", "historial"] as Tab[]).map((t) => (
          <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "resumen" ? "Resumen" : t === "personas" ? "Personas" : "Historial"}
          </button>
        ))}
      </div>

      <div className="actividad-semana">
        <button className="icon-btn" onClick={() => moverSemana(-7)} aria-label="Semana anterior">
          <ChevronLeft size={18} />
        </button>
        <strong>{formatWeekRange(lunes)}</strong>
        <button className="icon-btn" onClick={() => moverSemana(7)} aria-label="Semana siguiente" disabled={lunes >= lunesDe(todayIso())}>
          <ChevronRight size={18} />
        </button>
      </div>

      {estado.cargando ? (
        <p className="hint">Cargando…</p>
      ) : estado.error ? (
        <div className="conteo-faltan-aviso">{estado.error}</div>
      ) : tab === "resumen" ? (
        <Resumen semana={semana} anterior={anterior} lunes={lunes} onVer={irAlHistorial} />
      ) : tab === "personas" ? (
        <Personas semana={semana} ownerId={ownerId} onVer={(p) => irAlHistorial({ persona: p })} />
      ) : (
        <Historial
          semana={semana}
          ownerId={ownerId}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          chip={chip}
          setChip={setChip}
          persona={persona}
          setPersona={setPersona}
          especial={especial}
          setEspecial={setEspecial}
        />
      )}
    </div>
  );
}

function Resumen({
  semana,
  anterior,
  lunes,
  onVer,
}: {
  semana: RenglonBitacora[];
  anterior: RenglonBitacora[];
  lunes: string;
  onVer: (f: { especial?: FiltroEspecial; chip?: string }) => void;
}) {
  const cambios = semana.filter((r) => r.tipo === "cambio");
  const cambiosAntes = anterior.filter((r) => r.tipo === "cambio").length;
  const personas = new Set(semana.map((r) => r.actor_id)).size;
  const sesiones = semana.filter((r) => r.tipo === "login").length;
  const variacion = cambiosAntes > 0 ? Math.round(((cambios.length - cambiosAntes) / cambiosAntes) * 100) : null;

  const nEliminaciones = cambios.reduce((s, r) => s + eliminaciones(r), 0);
  const nMadrugada = cambios.filter(esMadrugada).length;
  const nTarde = cambios.filter(esTarde).length;

  const dias = Array.from({ length: 7 }, (_, i) => addDaysIso(lunes, i));
  const porDia = dias.map((d) => cambios.filter((r) => fechaLocal(r.creado_en) === d).length);
  const maxDia = Math.max(1, ...porDia);

  const contar = (rs: RenglonBitacora[], clave: (r: RenglonBitacora) => string) => {
    const m = new Map<string, number>();
    rs.forEach((r) => m.set(clave(r), (m.get(clave(r)) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const vistas = semana.filter((r) => r.tipo === "vista");
  const masAbiertas = contar(vistas, (r) => r.seccion || "—");
  const sinAbrir = vistas.length > 0 ? PANTALLAS.filter((p) => !masAbiertas.some(([s]) => s === p)) : [];
  const masCambios = contar(cambios, (r) => r.seccion || "Otros");

  return (
    <>
      <div className="actividad-kpis">
        <div className="actividad-kpi">
          <strong>{cambios.length}</strong>
          <span>cambios</span>
          {variacion !== null && (
            <small className={variacion > 0 ? "sube" : variacion < 0 ? "baja" : ""}>
              {variacion > 0 ? "▲" : variacion < 0 ? "▼" : "="} {Math.abs(variacion)}% vs. anterior
            </small>
          )}
        </div>
        <div className="actividad-kpi">
          <strong>{personas}</strong>
          <span>personas activas</span>
        </div>
        <div className="actividad-kpi">
          <strong>{sesiones}</strong>
          <span>inicios de sesión</span>
        </div>
      </div>

      <div className="actividad-card">
        <h4>Para revisar</h4>
        {nEliminaciones + nMadrugada + nTarde === 0 ? (
          <span className="hint">Nada fuera de lo normal esta semana.</span>
        ) : (
          <>
            {nEliminaciones > 0 && (
              <button className="actividad-alerta grave" onClick={() => onVer({ especial: "eliminaciones" })}>
                {nEliminaciones} {nEliminaciones === 1 ? "cosa eliminada" : "cosas eliminadas"} <span>Ver ›</span>
              </button>
            )}
            {nMadrugada > 0 && (
              <button className="actividad-alerta" onClick={() => onVer({ especial: "madrugada" })}>
                {nMadrugada} {nMadrugada === 1 ? "cambio" : "cambios"} entre 2 y 6 a.m. <span>Ver ›</span>
              </button>
            )}
            {nTarde > 0 && (
              <button className="actividad-alerta" onClick={() => onVer({ especial: "tarde" })}>
                {nTarde} {nTarde === 1 ? "cambio" : "cambios"} a cortes o conteos de días anteriores <span>Ver ›</span>
              </button>
            )}
          </>
        )}
      </div>

      <div className="actividad-card">
        <h4>Cambios por día</h4>
        <div className="actividad-barras" role="img" aria-label={`Cambios por día: ${porDia.join(", ")}`}>
          {porDia.map((n, i) => (
            <div key={dias[i]} className="actividad-barra" title={`${formatAssignedDate(dias[i])}: ${n} cambios`}>
              <span>{n > 0 ? n : ""}</span>
              <i style={{ height: `${(n / maxDia) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="actividad-barras-dias">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      </div>

      <Ranking titulo="Pantallas más abiertas" filas={masAbiertas} vacio="Todavía no hay pantallas registradas esta semana." />
      {sinAbrir.length > 0 && (
        <div className="actividad-card">
          <h4>Nadie abrió esta semana</h4>
          <span className="hint">{sinAbrir.join(", ")}</span>
        </div>
      )}
      <Ranking titulo="Secciones con más cambios" filas={masCambios} vacio="Sin cambios esta semana." onClick={(s) => onVer({ chip: s })} />
    </>
  );
}

function Ranking({
  titulo,
  filas,
  vacio,
  onClick,
}: {
  titulo: string;
  filas: [string, number][];
  vacio: string;
  onClick?: (s: string) => void;
}) {
  const max = Math.max(1, ...filas.map(([, n]) => n));
  return (
    <div className="actividad-card">
      <h4>{titulo}</h4>
      {filas.length === 0 ? (
        <span className="hint">{vacio}</span>
      ) : (
        filas.slice(0, 8).map(([s, n]) => (
          <button key={s} className="actividad-ranking" onClick={onClick ? () => onClick(s) : undefined} disabled={!onClick}>
            <span>{s}</span>
            <i style={{ width: `${(n / max) * 100}%` }} />
            <strong>{n}</strong>
          </button>
        ))
      )}
    </div>
  );
}

function Personas({ semana, ownerId, onVer }: { semana: RenglonBitacora[]; ownerId: string; onVer: (persona: string) => void }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const porPersona = new Map<string, RenglonBitacora[]>();
  semana.forEach((r) => {
    const k = r.actor_nombre || "—";
    if (!porPersona.has(k)) porPersona.set(k, []);
    porPersona.get(k)!.push(r);
  });
  const lista = [...porPersona.entries()].sort((a, b) => (b[1][0]?.creado_en || "").localeCompare(a[1][0]?.creado_en || ""));
  if (lista.length === 0) return <Empty icon={<History size={26} strokeWidth={1.3} />} text="Nadie usó la app esta semana." />;
  const hoy = todayIso();

  return (
    <>
      {lista.map(([nombre, rs]) => {
        const ultimo = rs[0];
        const cambios = rs.filter((r) => r.tipo === "cambio");
        const secciones = [...new Set(rs.filter((r) => r.tipo !== "login" && r.tipo !== "logout").map((r) => r.seccion || "Otros"))].slice(0, 3);
        const horas = Array.from({ length: 24 }, (_, h) => rs.filter((r) => horaLocal(r.creado_en) === h).length);
        const maxH = Math.max(1, ...horas);
        const fechaUlt = fechaLocal(ultimo.creado_en);
        const hora = new Date(ultimo.creado_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
        const reciente = fechaUlt >= addDaysIso(hoy, -1);
        const esDueno = rs.some((r) => r.actor_id === ownerId);
        return (
          <div key={nombre} className="actividad-persona">
            <button className="actividad-persona-top" onClick={() => setAbierta(abierta === nombre ? null : nombre)}>
              <span className="actividad-avatar">{nombre.charAt(0).toUpperCase()}</span>
              <span className="actividad-persona-info">
                <strong>
                  {nombre}
                  {esDueno ? " (dueño)" : ""}
                </strong>
                <span>
                  <i className={`actividad-punto ${reciente ? "on" : ""}`} />
                  Último uso: {fechaUlt === hoy ? "hoy" : fechaUlt === addDaysIso(hoy, -1) ? "ayer" : formatAssignedDate(fechaUlt)} {hora}
                </span>
                <span>
                  {cambios.length} {cambios.length === 1 ? "cambio" : "cambios"}
                  {secciones.length > 0 ? ` · ${secciones.join(", ")}` : ""}
                </span>
              </span>
              <ChevronRight size={16} className={abierta === nombre ? "girado" : ""} />
            </button>
            {abierta === nombre && (
              <div className="actividad-persona-detalle">
                <span className="hint">A qué horas usa la app (0–23 h)</span>
                <div className="actividad-horas" role="img" aria-label="Actividad por hora">
                  {horas.map((n, h) => (
                    <i key={h} title={`${h}:00 — ${n}`} style={{ height: `${(n / maxH) * 100}%` }} />
                  ))}
                </div>
                <div className="actividad-horas-eje">
                  <span>0</span>
                  <span>6</span>
                  <span>12</span>
                  <span>18</span>
                  <span>23</span>
                </div>
                <span className="hint">
                  {plural(rs.filter((r) => r.tipo === "login").length, "inicio de sesión", "inicios de sesión")} ·{" "}
                  {plural(rs.filter((r) => r.tipo === "vista").length, "pantalla abierta", "pantallas abiertas")}
                </span>
                <button className="link-btn" onClick={() => onVer(nombre)}>
                  Ver su historial ›
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function Historial({
  semana,
  ownerId,
  busqueda,
  setBusqueda,
  chip,
  setChip,
  persona,
  setPersona,
  especial,
  setEspecial,
}: {
  semana: RenglonBitacora[];
  ownerId: string;
  busqueda: string;
  setBusqueda: (s: string) => void;
  chip: string;
  setChip: (s: string) => void;
  persona: string | null;
  setPersona: (s: string | null) => void;
  especial: FiltroEspecial;
  setEspecial: (f: FiltroEspecial) => void;
}) {
  // Las pantallas abiertas solo se ven con su chip, para no llenar el historial.
  const secciones = [...new Set(semana.filter((r) => r.tipo === "cambio").map(seccionDe))].sort();
  const chips = ["Todo", ...secciones, "Sesiones", "Pantallas"];
  const q = busqueda.trim().toLowerCase();
  const visibles = semana.filter((r) => {
    if (chip === "Todo" ? r.tipo === "vista" : seccionDe(r) !== chip) return false;
    if (persona && (r.actor_nombre || "—") !== persona) return false;
    if (especial === "eliminaciones" && eliminaciones(r) === 0) return false;
    if (especial === "madrugada" && !esMadrugada(r)) return false;
    if (especial === "tarde" && !esTarde(r)) return false;
    if (q) {
      const texto = [r.actor_nombre, r.donde, r.seccion, ...(r.detalle || []).flatMap((c) => [c.campo, c.antes, c.despues, c.texto])]
        .join(" ")
        .toLowerCase();
      if (!texto.includes(q)) return false;
    }
    return true;
  });
  const porDia = new Map<string, RenglonBitacora[]>();
  visibles.forEach((r) => {
    const d = fechaLocal(r.creado_en);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d)!.push(r);
  });
  const etiquetaEspecial = { eliminaciones: "Solo eliminaciones", madrugada: "Entre 2 y 6 a.m.", tarde: "Cambios a días anteriores" };

  return (
    <>
      <label className="actividad-busqueda">
        <Search size={16} />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar: “Hielo”, “Juan”, “Pollo”…" />
      </label>
      <div className="actividad-chips">
        {chips.map((c) => (
          <button key={c} className={chip === c ? "on" : ""} onClick={() => setChip(c)}>
            {c}
          </button>
        ))}
        <button className={especial === "eliminaciones" ? "on" : ""} onClick={() => setEspecial(especial === "eliminaciones" ? null : "eliminaciones")}>
          Solo eliminaciones
        </button>
      </div>
      {(persona || (especial && especial !== "eliminaciones")) && (
        <div className="actividad-chips">
          {persona && (
            <button className="on quitar" onClick={() => setPersona(null)}>
              {persona} <X size={12} />
            </button>
          )}
          {especial && especial !== "eliminaciones" && (
            <button className="on quitar" onClick={() => setEspecial(null)}>
              {etiquetaEspecial[especial]} <X size={12} />
            </button>
          )}
        </div>
      )}

      {visibles.length === 0 ? (
        <Empty icon={<History size={26} strokeWidth={1.3} />} text="No hay nada con estos filtros." />
      ) : (
        [...porDia.entries()].map(([dia, rs]) => (
          <div key={dia} className="bitacora-dia">
            <h3 className="bitacora-dia-titulo">{formatAssignedDate(dia)}</h3>
            {rs.map((r) => (
              <Renglon key={r.id} r={r} esDueno={r.actor_id === ownerId} />
            ))}
          </div>
        ))
      )}
    </>
  );
}

function Renglon({ r, esDueno }: { r: RenglonBitacora; esDueno: boolean }) {
  const hora = new Date(r.creado_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const quien = `${r.actor_nombre || "—"}${esDueno ? " (dueño)" : ""}`;
  if (r.tipo !== "cambio") {
    return (
      <div className="bitacora-evento acceso">
        <div className="bitacora-evento-top">
          <span className="bitacora-quien">
            {r.tipo === "login" ? <LogIn size={14} /> : r.tipo === "logout" ? <LogOut size={14} /> : null} {quien}
          </span>
          <span>{hora}</span>
        </div>
        <span className="bitacora-donde">
          {r.tipo === "login" ? "Inició sesión" : r.tipo === "logout" ? "Cerró sesión" : `Abrió ${r.seccion}`}
        </span>
      </div>
    );
  }
  return (
    <div className="bitacora-evento">
      <div className="bitacora-evento-top">
        <span className="bitacora-quien">{quien}</span>
        <span>
          {hora} · {r.donde}
        </span>
      </div>
      {(r.detalle || []).map((c, i) => (
        <div key={i} className="bitacora-cambio">
          {c.accion === "cambió" ? (
            <>
              {c.campo && <span>{c.campo}:</span>}
              <span className="bitacora-antes">{c.antes}</span>
              <span>→</span>
              <span className="bitacora-despues">{c.despues}</span>
            </>
          ) : (
            <>
              <span className={`bitacora-tag ${c.accion === "agregó" ? "agrego" : "elimino"}`}>{c.accion === "agregó" ? "Agregó" : "Eliminó"}</span>
              <span>{c.texto}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
