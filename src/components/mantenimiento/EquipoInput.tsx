import { useMemo, useState } from "react";
import { formatLongDayDate, normalizarNombre } from "../../lib/dataModel";
import { PUNTAJE_ENCONTRADO, puntaje } from "../../lib/gastosBusqueda";
import type { MantenimientoEntry } from "../../lib/types";

export function EquipoInput({ value, area, registroId, registros, onChange }: {
  value: string;
  area: string;
  registroId: string;
  registros: MantenimientoEntry[];
  onChange: (value: string) => void;
}) {
  const [mostrar, setMostrar] = useState(true);
  const equipos = useMemo(() => {
    const porNombre = new Map<string, MantenimientoEntry>();
    for (const r of registros) {
      if (r.id === registroId || normalizarNombre(r.area) !== normalizarNombre(area)) continue;
      const nombre = normalizarNombre(r.equipo);
      if (!nombre) continue;
      const anterior = porNombre.get(nombre);
      if (!anterior || r.fecha > anterior.fecha) porNombre.set(nombre, r);
    }
    return [...porNombre.values()];
  }, [registros, registroId, area]);
  const texto = value.trim();
  const exacto = texto ? equipos.find((r) => normalizarNombre(r.equipo) === normalizarNombre(texto)) : undefined;
  const sugerencias = texto && !exacto
    ? equipos.filter((r) => normalizarNombre(r.equipo).includes(normalizarNombre(texto)) || puntaje(texto, r.equipo) >= PUNTAJE_ENCONTRADO)
      .sort((a, b) => puntaje(texto, b.equipo) - puntaje(texto, a.equipo) || b.fecha.localeCompare(a.fecha))
    : [];

  return (
    <>
      <label className="field">
        <span>Nombre del equipo</span>
        <input value={value} autoComplete="off" onChange={(e) => { setMostrar(true); onChange(e.target.value); }} />
      </label>
      {exacto && (
        <div className="mant-aviso" role="status">
          <strong>Último mantenimiento · {exacto.area}</strong><br />
          {formatLongDayDate(exacto.fecha)}
        </div>
      )}
      {!exacto && texto && mostrar && (sugerencias.length > 0 ? (
        <>
          <p className="hint">Equipos encontrados en {area}:</p>
          <div className="menu-list mant-sugerencias">
            {sugerencias.map((r) => (
              <button key={normalizarNombre(r.equipo)} type="button" className="menu-item" onClick={() => { onChange(r.equipo); setMostrar(false); }}>
                <span className="menu-item-text"><strong>{r.equipo}</strong><span>{r.area} · Último mantenimiento: {formatLongDayDate(r.fecha)}</span></span>
              </button>
            ))}
          </div>
          <p className="hint">Elige uno o escribe un equipo nuevo.</p>
        </>
      ) : <p className="hint">No se encontraron equipos con ese nombre en {area}. Puedes continuar para registrarlo.</p>)}
    </>
  );
}
