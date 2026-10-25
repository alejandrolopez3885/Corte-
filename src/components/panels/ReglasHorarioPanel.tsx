import { useMemo, useState } from "react";
import { Field, Sheet, Toggle } from "../ui";
import { TituloPagina } from "../BarraTitulo";
import { iniciales } from "../modals/asistente";
import { mondayOnOrBefore, todayIso } from "../../lib/dataModel";
import { miles, pronosticoDesdeLunes } from "../../lib/pronostico";
import { normalizarValor, reglasDelArea, textoDescanso, textoFijos, SEMANAS_DE_HISTORIA } from "../../lib/reglasHorario";
import { DAYS, DAY_SHORT, HORARIO_AREAS_FIJAS } from "../../lib/types";
import type { DayName, EmpleadoEntry, HorarioMonthData, MonthData, PuestoEntry, ReglaPersona, ReglasArea } from "../../lib/types";

// Horarios › Reglas del personal (paso 4 del horario automático): cuántos
// trabajan cada día, apertura, dobles y lo que puede hacer cada persona.
// Lo que no se ha guardado viene de los últimos horarios (lib/reglasHorario.ts).
export function ReglasHorarioPanel({
  onBack,
  months,
  horarios,
  empleados,
  puestos,
  guardadas,
  soloAreaId,
  verPronostico,
  onSave,
}: {
  onBack: () => void;
  months: Record<string, MonthData>;
  horarios: Record<string, HorarioMonthData>;
  empleados: EmpleadoEntry[];
  puestos?: PuestoEntry[];
  guardadas?: Record<string, ReglasArea>;
  soloAreaId?: string;
  verPronostico: boolean;
  onSave: (cambios: Record<string, ReglasArea>) => void;
}) {
  const areas = HORARIO_AREAS_FIJAS.filter((a) => !soloAreaId || a.id === soloAreaId);
  const iniciales0 = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, reglasDelArea(a.id, guardadas?.[a.id], horarios, months, new Set(empleados.filter((e) => e.inactivo).map((e) => e.id)))])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guardadas, horarios, months, soloAreaId, empleados]
  );
  const [areaId, setAreaId] = useState<string>(areas[0].id);
  const [borrador, setBorrador] = useState<Record<string, ReglasArea>>(() =>
    Object.fromEntries(Object.entries(iniciales0).map(([k, v]) => [k, v.reglas]))
  );
  const [guardado, setGuardado] = useState(false);
  const [diaMinimo, setDiaMinimo] = useState<DayName | null>(null);
  const [persona, setPersona] = useState<string | null>(null);

  const hoy = todayIso();
  const pron = useMemo(
    () => (verPronostico ? pronosticoDesdeLunes(months, mondayOnOrBefore(hoy), hoy) : []),
    [verPronostico, months, hoy]
  );

  const area = areas.find((a) => a.id === areaId)!;
  const r = borrador[areaId];
  const filas = iniciales0[areaId].filas;
  const cambiadas = Object.keys(borrador).filter((k) => JSON.stringify(borrador[k]) !== JSON.stringify(guardadas?.[k]));

  function cambiar(c: Partial<ReglasArea>) {
    setBorrador((b) => ({ ...b, [areaId]: { ...b[areaId], ...c } }));
    setGuardado(false);
  }
  function cambiarPersona(id: string, regla: ReglaPersona) {
    cambiar({ personas: { ...r.personas, [id]: regla } });
  }
  const puestoDe = (id: string) => {
    const e = empleados.find((x) => x.id === id);
    return puestos?.find((p) => p.id === e?.puestoId)?.nombre;
  };

  return (
    <div className="page-section">
      <TituloPagina titulo="Reglas del personal" onBack={onBack} backLabel="Horarios" />
      <p className="hint">
        El horario sugerido va a respetar estas reglas. Ya vienen llenas con lo que se hizo en los últimos {SEMANAS_DE_HISTORIA} horarios: solo
        corrige lo que no esté bien.
      </p>

      {areas.length > 1 && (
        <div className="segmented">
          {areas.map((a) => (
            <button key={a.id} className={a.id === areaId ? "active" : ""} onClick={() => setAreaId(a.id)}>
              {a.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="rg-card">
        <h3>¿Cuántos trabajan cada día?</h3>
        <p className="hint">Mínimo de personas en {area.nombre.toLowerCase()}. Toca un día para cambiarlo.</p>
        <div className="rg-dias">
          {DAYS.map((d) => {
            const p = pron.find((x) => x.dia === d)?.pronostico;
            return (
              <button key={d} type="button" className={`rg-num ${r.minimo[d] > Math.min(...DAYS.map((x) => r.minimo[x])) ? "fuerte" : ""}`} onClick={() => setDiaMinimo(d)}>
                <b>{DAY_SHORT[d]}</b>
                <strong>{r.minimo[d]}</strong>
                {p && <small>~{miles(p.esperado)}</small>}
              </button>
            );
          })}
        </div>
        <div className="rg-fila">
          <span>
            Subir gente si se espera más venta
            <small>
              +1 en {area.nombre.toLowerCase()} por cada {pesos(r.ventaPorPersona)} arriba de lo normal (p. ej. música en vivo)
            </small>
          </span>
          <Toggle checked={r.subirConVenta} onChange={(v) => cambiar({ subirConVenta: v })} label="" />
        </div>
        {r.subirConVenta && (
          <div className="rg-fila">
            <span>Venta por persona extra</span>
            <Paso valor={pesos(r.ventaPorPersona)} menos={() => cambiar({ ventaPorPersona: Math.max(1000, r.ventaPorPersona - 500) })} mas={() => cambiar({ ventaPorPersona: r.ventaPorPersona + 500 })} />
          </div>
        )}
      </div>

      <div className="rg-card">
        <h3>Apertura y dobles</h3>
        <div className="rg-fila">
          <span>Cada día alguien abre (X o Z)</span>
          <Toggle checked={r.alguienAbre} onChange={(v) => cambiar({ alguienAbre: v })} label="" />
        </div>
        <div className="rg-fila">
          <span>Máximo de dobles (Z) por persona a la semana</span>
          <Paso valor={String(r.maxDobles)} menos={() => cambiar({ maxDobles: Math.max(0, r.maxDobles - 1) })} mas={() => cambiar({ maxDobles: Math.min(7, r.maxDobles + 1) })} />
        </div>
        <div className="rg-fila">
          <span>No doblar dos días seguidos</span>
          <Toggle checked={r.noDoblarSeguido !== false} onChange={(v) => cambiar({ noDoblarSeguido: v })} label="" />
        </div>
        <div className="rg-fila">
          <span>
            Cada día alguien que haga corte
            <small>
              {filas.some((f) => r.personas[f.empleadoId]?.haceCorte)
                ? filas.filter((f) => r.personas[f.empleadoId]?.haceCorte).map((f) => f.nombre).join(" o ")
                : "Marca en su ficha quién hace corte"}
            </small>
          </span>
          <Toggle checked={r.alguienCorte !== false} onChange={(v) => cambiar({ alguienCorte: v })} label="" />
        </div>
        <div className="rg-fila">
          <span>Descanso: 1 día por semana a tiempo completo</span>
          <Toggle checked={r.descansoSemanal} onChange={(v) => cambiar({ descansoSemanal: v })} label="" />
        </div>
      </div>

      <div className="rg-card">
        <h3>Cada persona</h3>
        {filas.length === 0 ? (
          <p className="hint">Aún no hay nadie en los horarios de {area.nombre.toLowerCase()}. Cuando se capture un horario, aparecen aquí.</p>
        ) : (
          <p className="hint">Toca a alguien para cambiar sus reglas.</p>
        )}
        {filas.map((f) => {
          const g = r.personas[f.empleadoId];
          const puesto = puestoDe(f.empleadoId);
          return (
            <button key={f.empleadoId} type="button" className="rg-persona" onClick={() => setPersona(f.empleadoId)}>
              <span className="rg-av">{iniciales(f.nombre)}</span>
              <span className="rg-persona-t">
                <strong>{f.nombre}</strong>
                {puesto && <span className="hint"> · {puesto}</span>}
                <span className="rg-chips">
                  {g.modo === "fijos" ? (
                    <>
                      {g.haceCorte && <i className="si">Corte</i>}
                      <i className="fijo">{textoFijos(g.fijos)}</i>
                    </>
                  ) : (
                    <>
                      {g.haceCorte && <i className="si">Corte</i>}
                      <i className={g.puedeAbrir ? "si" : "no"}>
                        {g.puedeAbrir ? (g.maxAperturas ? `Abre máx. ${g.maxAperturas}` : "Abre") : "No abre"}
                      </i>
                      <i className={g.puedeCerrar ? "si" : "no"}>{g.puedeCerrar ? "Cierra" : "No cierra"}</i>
                      <i className={g.puedeDoblar ? "si" : "no"}>{g.puedeDoblar ? "Dobla" : "No dobla"}</i>
                      <i>{textoDescanso(g.descanso)}</i>
                    </>
                  )}
                </span>
              </span>
              <span className="rg-ver">›</span>
            </button>
          );
        })}
      </div>

      <button
        className="btn-primary"
        disabled={guardado}
        onClick={() => {
          const cambios = Object.fromEntries((cambiadas.length ? cambiadas : Object.keys(borrador)).map((k) => [k, borrador[k]]));
          onSave(cambios);
          setGuardado(true);
        }}
      >
        {guardado ? "✓ Reglas guardadas" : "Guardar reglas"}
      </button>

      {diaMinimo && (
        <Sheet title={`${diaMinimo} · mínimo en ${area.nombre.toLowerCase()}`} onClose={() => setDiaMinimo(null)}>
          <div className="rg-paso-grande">
            <Paso
              valor={String(r.minimo[diaMinimo])}
              menos={() => cambiar({ minimo: { ...r.minimo, [diaMinimo]: Math.max(0, r.minimo[diaMinimo] - 1) } })}
              mas={() => cambiar({ minimo: { ...r.minimo, [diaMinimo]: Math.min(20, r.minimo[diaMinimo] + 1) } })}
            />
          </div>
          <button className="btn-primary" onClick={() => setDiaMinimo(null)}>
            Listo
          </button>
        </Sheet>
      )}

      {persona && (
        <PersonaSheet
          nombre={filas.find((f) => f.empleadoId === persona)?.nombre || ""}
          subtitulo={[puestoDe(persona), area.nombre].filter(Boolean).join(" · ")}
          regla={r.personas[persona]}
          onChange={(regla) => cambiarPersona(persona, regla)}
          onClose={() => setPersona(null)}
        />
      )}
    </div>
  );
}

const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`;

function Paso({ valor, menos, mas }: { valor: string; menos: () => void; mas: () => void }) {
  return (
    <span className="rg-paso">
      <button type="button" onClick={menos} aria-label="Menos">
        −
      </button>
      <b>{valor}</b>
      <button type="button" onClick={mas} aria-label="Más">
        +
      </button>
    </span>
  );
}

const VALORES_FIJOS = ["X", "Z", "O"];

function PersonaSheet({
  nombre,
  subtitulo,
  regla,
  onChange,
  onClose,
}: {
  nombre: string;
  subtitulo: string;
  regla: ReglaPersona;
  onChange: (r: ReglaPersona) => void;
  onClose: () => void;
}) {
  const [diaFijo, setDiaFijo] = useState<DayName | null>(null);
  const [hora, setHora] = useState("");
  const fijos = regla.fijos || {};
  const ponerFijo = (d: DayName, v: string) => {
    const n = { ...fijos };
    if (v) n[d] = normalizarValor(v);
    else delete n[d];
    onChange({ ...regla, fijos: n });
    setDiaFijo(null);
  };

  return (
    <Sheet title={nombre} onClose={onClose}>
      {subtitulo && <p className="hint rg-sub">{subtitulo}</p>}
      <p className="rg-lbl">¿Cómo trabaja?</p>
      <div className="rg-seg">
        <button type="button" className={regla.modo === "completo" ? "on" : ""} onClick={() => onChange({ ...regla, modo: "completo" })}>
          Tiempo completo
        </button>
        <button type="button" className={regla.modo === "fijos" ? "on" : ""} onClick={() => onChange({ ...regla, modo: "fijos", fijos })}>
          Solo días fijos
        </button>
      </div>

      {regla.modo === "fijos" && (
        <>
          <p className="rg-lbl">Sus días fijos</p>
          <p className="hint">Toca un día para poner X, Z, O, una hora especial o dejarlo vacío.</p>
          <div className="rg-fijos">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={fijos[d] ? "v" : ""}
                onClick={() => {
                  setDiaFijo(d);
                  setHora(fijos[d] && !VALORES_FIJOS.includes(fijos[d]!) ? fijos[d]! : "");
                }}
              >
                <b>{DAY_SHORT[d]}</b>
                {fijos[d] || "–"}
              </button>
            ))}
          </div>
          {diaFijo && (
            <div className="rg-fijo-editor">
              <p className="rg-lbl">{diaFijo}</p>
              <div className="rg-seg">
                {VALORES_FIJOS.map((v) => (
                  <button key={v} type="button" className={fijos[diaFijo] === v ? "on" : ""} onClick={() => ponerFijo(diaFijo, v)}>
                    {v}
                  </button>
                ))}
                <button type="button" onClick={() => ponerFijo(diaFijo, "")}>
                  Vacío
                </button>
              </div>
              <Field label="O una hora especial (pm)">
                <div className="rg-hora">
                  <input className="text-input" value={hora} onChange={(e) => setHora(e.target.value)} placeholder="Ej. 6:30" />
                  <button type="button" className="btn-primary" disabled={!hora.trim()} onClick={() => ponerFijo(diaFijo, hora)}>
                    Poner
                  </button>
                </div>
              </Field>
            </div>
          )}
        </>
      )}

      <p className="rg-lbl">Qué puede hacer</p>
      <div className="rg-card rg-card-sheet">
        <div className="rg-fila">
          <span>Puede abrir (X)</span>
          <Toggle checked={regla.puedeAbrir} onChange={(v) => onChange({ ...regla, puedeAbrir: v })} label="" />
        </div>
        {regla.puedeAbrir && regla.modo === "completo" && (
          <div className="rg-fila">
            <span>Máximo de días que abre a la semana</span>
            <Paso
              valor={regla.maxAperturas ? String(regla.maxAperturas) : "Sin límite"}
              menos={() => onChange({ ...regla, maxAperturas: Math.max(1, (regla.maxAperturas ?? 7) - 1) })}
              mas={() => onChange({ ...regla, maxAperturas: (regla.maxAperturas ?? 7) >= 6 ? undefined : (regla.maxAperturas ?? 7) + 1 })}
            />
          </div>
        )}
        <div className="rg-fila">
          <span>Puede cerrar (O)</span>
          <Toggle checked={regla.puedeCerrar} onChange={(v) => onChange({ ...regla, puedeCerrar: v })} label="" />
        </div>
        <div className="rg-fila">
          <span>Puede doblar (Z)</span>
          <Toggle checked={regla.puedeDoblar} onChange={(v) => onChange({ ...regla, puedeDoblar: v })} label="" />
        </div>
        <div className="rg-fila">
          <span>Puede hacer corte</span>
          <Toggle checked={!!regla.haceCorte} onChange={(v) => onChange({ ...regla, haceCorte: v || undefined })} label="" />
        </div>
      </div>

      <p className="rg-lbl">{regla.modo === "fijos" ? "Días que no puede" : "Descanso preferido"}</p>
      <div className="rg-dsel">
        {DAYS.map((d) => {
          const on = regla.modo === "fijos" ? !fijos[d] : !!regla.descanso?.includes(d);
          return (
            <button
              key={d}
              type="button"
              className={on ? "on" : ""}
              onClick={() => {
                if (regla.modo === "fijos") {
                  if (on) {
                    setDiaFijo(d);
                    setHora("");
                  } else ponerFijo(d, "");
                } else {
                  const actual = regla.descanso || [];
                  onChange({ ...regla, descanso: on ? actual.filter((x) => x !== d) : DAYS.filter((x) => x === d || actual.includes(x)) });
                }
              }}
            >
              {DAY_SHORT[d]}
            </button>
          );
        })}
      </div>
      <p className="hint">
        {regla.modo === "fijos"
          ? "Son los días sin valor fijo. Toca uno para darle un día fijo."
          : "Sin ninguno marcado, su descanso es flexible."}
      </p>
      <button className="btn-primary" onClick={onClose}>
        Listo
      </button>
    </Sheet>
  );
}
