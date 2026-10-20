import { useEffect, useState } from "react";
import { ArrowLeft, History, LogIn, LogOut } from "lucide-react";
import { Empty, Field } from "../ui";
import { addDaysIso, formatAssignedDate, formatWeekRange, resolveWeekStartDate } from "../../lib/dataModel";
import { cargarBitacora, type RenglonBitacora } from "../../lib/bitacora";
import type { MonthData } from "../../lib/types";

// Negocio > Análisis > Historial de cambios: lo registrado en la bitácora
// en la semana elegida (por fecha del cambio), lo más reciente arriba, con
// filtros de sección y persona. Solo lectura.
export function BitacoraPanel({
  onBack,
  ownerId,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
}: {
  onBack: () => void;
  ownerId: string;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [seccion, setSeccion] = useState("todas");
  const [persona, setPersona] = useState("todas");
  const [estado, setEstado] = useState<{ cargando: boolean; error?: string; renglones: RenglonBitacora[] }>({
    cargando: true,
    renglones: [],
  });

  const month = months[monthKey] || null;
  const inicio = month ? resolveWeekStartDate(monthKey, weekIndex, month) : null;

  useEffect(() => {
    if (!inicio) return;
    let cancelado = false;
    // Rango en hora local: del lunes 00:00 al lunes siguiente 00:00.
    const desde = new Date(`${inicio}T00:00:00`).toISOString();
    const hasta = new Date(`${addDaysIso(inicio, 7)}T00:00:00`).toISOString();
    cargarBitacora(ownerId, desde, hasta).then(({ data, error }) => {
      if (cancelado) return;
      if (error) {
        const faltaTabla = error.code === "42P01" || /bitacora/i.test(error.message);
        setEstado({
          cargando: false,
          renglones: [],
          error: faltaTabla
            ? "Falta activar el historial: corre una vez en Supabase el archivo supabase/migration_007_bitacora.sql."
            : "No se pudo cargar el historial. Revisa tu conexión.",
        });
        return;
      }
      setEstado({ cargando: false, renglones: (data || []) as RenglonBitacora[] });
    });
    return () => {
      cancelado = true;
    };
  }, [ownerId, inicio]);

  if (monthKeys.length === 0 || !month || !inicio) {
    return (
      <div className="page-section">
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> Negocio
        </button>
        <h2 className="page-title">Historial de cambios</h2>
        <Empty icon={<History size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder elegir la semana." />
      </div>
    );
  }

  const secciones = [...new Set(estado.renglones.map((r) => (r.tipo === "cambio" ? r.seccion || "Otros" : "Sesiones")))].sort();
  const personas = [...new Set(estado.renglones.map((r) => r.actor_nombre || "—"))].sort();
  const visibles = estado.renglones.filter(
    (r) =>
      (seccion === "todas" || (r.tipo === "cambio" ? r.seccion || "Otros" : "Sesiones") === seccion) &&
      (persona === "todas" || (r.actor_nombre || "—") === persona)
  );

  // Agrupado por día (hora local) del cambio.
  const porDia = new Map<string, RenglonBitacora[]>();
  visibles.forEach((r) => {
    const d = new Date(r.creado_en);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!porDia.has(key)) porDia.set(key, []);
    porDia.get(key)!.push(r);
  });

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Historial de cambios</h2>

      <div className="field-row">
        <Field label="Mes">
          <select
            className="text-input"
            value={monthKey}
            onChange={(e) => {
              setMonthKey(e.target.value);
              setWeekIndex(0);
              setEstado((s) => ({ ...s, cargando: true }));
            }}
          >
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select
            className="text-input"
            value={weekIndex}
            onChange={(e) => {
              setWeekIndex(Number(e.target.value));
              setEstado((s) => ({ ...s, cargando: true }));
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {i + 1}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(inicio)}</p>
      <div className="field-row">
        <Field label="Sección">
          <select className="text-input" value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            <option value="todas">Todas</option>
            {secciones.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Persona">
          <select className="text-input" value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="todas">Todas</option>
            {personas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {estado.cargando ? (
        <p className="hint">Cargando…</p>
      ) : estado.error ? (
        <div className="conteo-faltan-aviso">{estado.error}</div>
      ) : visibles.length === 0 ? (
        <Empty icon={<History size={26} strokeWidth={1.3} />} text="No hay cambios registrados en esta semana." />
      ) : (
        [...porDia.entries()].map(([dia, renglones]) => (
          <div key={dia} className="bitacora-dia">
            <h3 className="bitacora-dia-titulo">{formatAssignedDate(dia)}</h3>
            {renglones.map((r) => (
              <Evento key={r.id} r={r} esDueno={r.actor_id === ownerId} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function Evento({ r, esDueno }: { r: RenglonBitacora; esDueno: boolean }) {
  const hora = new Date(r.creado_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const quien = `${r.actor_nombre || "—"}${esDueno ? " (dueño)" : ""}`;
  if (r.tipo !== "cambio") {
    return (
      <div className="bitacora-evento acceso">
        <div className="bitacora-evento-top">
          <span className="bitacora-quien">
            {r.tipo === "login" ? <LogIn size={14} /> : <LogOut size={14} />} {quien}
          </span>
          <span>{hora}</span>
        </div>
        <span className="bitacora-donde">{r.tipo === "login" ? "Inició sesión" : "Cerró sesión"}</span>
      </div>
    );
  }
  return (
    <div className="bitacora-evento">
      <div className="bitacora-evento-top">
        <span className="bitacora-quien">{quien}</span>
        <span>{hora}</span>
      </div>
      <span className="bitacora-donde">{r.donde}</span>
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
              <span className={`bitacora-tag ${c.accion === "agregó" ? "agrego" : "elimino"}`}>
                {c.accion === "agregó" ? "Agregó" : "Eliminó"}
              </span>
              <span>{c.texto}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
