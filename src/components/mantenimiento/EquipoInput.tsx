import { useMemo, useState } from "react";
import { formatLongDayDate, normalizarNombre } from "../../lib/dataModel";
import { PUNTAJE_ENCONTRADO, puntaje } from "../../lib/gastosBusqueda";
import type { MantenimientoEntry } from "../../lib/types";

type EquipoHistorial = { nombre: string; area: string; ultimaFecha: string | null };

export function EquipoInput({ value, area, registroId, registros, onChange }: {
  value: string;
  area: string;
  registroId: string;
  registros: MantenimientoEntry[];
  onChange: (value: string) => void;
}) {
  const [mostrar, setMostrar] = useState(true);
  const equipos = useMemo(() => {
    const porNombre = new Map<string, EquipoHistorial>();
    for (const r of registros) {
      if (r.id === registroId || normalizarNombre(r.area) !== normalizarNombre(area)) continue;
      const nombre = normalizarNombre(r.equipo);
      if (!nombre) continue;
      const fecha = r.estado === "pendiente" ? null : (r.fechaTerminacion || r.fecha);
      const anterior = porNombre.get(nombre);
      if (!anterior || (fecha && (!anterior.ultimaFecha || fecha > anterior.ultimaFecha))) {
        porNombre.set(nombre, { nombre: r.equipo, area: r.area, ultimaFecha: fecha });
      }
    }
    return [...porNombre.values()];
  }, [registros, registroId, area]);
  const texto = value.trim();
  const exacto = texto ? equipos.find((r) => normalizarNombre(r.nombre) === normalizarNombre(texto)) : undefined;
  const sugerencias = texto && !exacto
    ? equipos.filter((r) => normalizarNombre(r.nombre).includes(normalizarNombre(texto)) || puntaje(texto, r.nombre) >= PUNTAJE_ENCONTRADO)
      .sort((a, b) => puntaje(texto, b.nombre) - puntaje(texto, a.nombre) || (b.ultimaFecha || "").localeCompare(a.ultimaFecha || ""))
    : [];

  return (
    <>
      <label className="field">
        <span>Nombre del equipo</span>
        <input value={value} autoComplete="off" onChange={(e) => { setMostrar(true); onChange(e.target.value); }} />
      </label>
      {exacto && (
        <div className="mant-aviso" role="status">
          <strong>{exacto.area}</strong><br />
          {exacto.ultimaFecha ? `Último mantenimiento: ${formatLongDayDate(exacto.ultimaFecha)}` : "Sin mantenimientos terminados"}
        </div>
      )}
      {!exacto && texto && mostrar && (sugerencias.length > 0 ? (
        <>
          <p className="hint">Equipos encontrados en {area}:</p>
          <div className="menu-list mant-sugerencias">
            {sugerencias.map((r) => (
              <button key={normalizarNombre(r.nombre)} type="button" className="menu-item" onClick={() => { onChange(r.nombre); setMostrar(false); }}>
                <span className="menu-item-text"><strong>{r.nombre}</strong><span>{r.area} · {r.ultimaFecha ? `Último mantenimiento: ${formatLongDayDate(r.ultimaFecha)}` : "Sin mantenimientos terminados"}</span></span>
              </button>
            ))}
          </div>
          <p className="hint">Elige uno o escribe un equipo nuevo.</p>
        </>
      ) : <p className="hint">No se encontraron equipos con ese nombre en {area}. Puedes continuar para registrarlo.</p>)}
    </>
  );
}
