import { useEffect, useState } from "react";
import { normalizarNombre, todayIso, empleadoDelDueno } from "../lib/dataModel";
import { calcularRanking, meseroDeEmpleado, rangoRanking, type EncuestasMesero } from "../lib/ranking";
import { MINIMO_ENCUESTAS, calificaciones, encuestasParaRanking } from "../lib/encuestas";
import { cargarSemanas } from "../lib/puntos";
import { MisPuntos } from "./MisPuntos";
import type { AppData } from "../lib/types";

// Mi perfil del dueño cuando también tiene cortes como mesero: su ranking
// de esta semana, sus encuestas desde el inicio, sus Monedas Anubis y sus
// logros — igual que el personal.
export function meseroDelDueno(data: AppData, nombre: string): string | undefined {
  const porPersonal = meseroDeEmpleado(data, empleadoDelDueno(data));
  if (porPersonal) return porPersonal;
  const n = normalizarNombre(nombre);
  const opciones = data.meseros.filter((m) => !m.acumulado);
  return (opciones.find((m) => normalizarNombre(m.nombre) === n) || opciones.find((m) => normalizarNombre(m.nombre) === n.split(" ")[0]))?.id;
}

export function MiRankingDueno({ data, meseroId, onVerRanking }: { data: AppData; meseroId: string; onVerRanking: () => void }) {
  const { desde, hasta } = rangoRanking("semana");
  const [encSemana, setEncSemana] = useState<Map<string, EncuestasMesero>>(new Map());
  useEffect(() => {
    let vivo = true;
    encuestasParaRanking(desde, hasta).then((m) => vivo && setEncSemana(m));
    return () => {
      vivo = false;
    };
  }, [desde, hasta]);
  const ranking = calcularRanking(data, desde, hasta, encSemana);
  const yo = ranking.filas.find((f) => f.meseroId === meseroId);
  const [estrellas, setEstrellas] = useState<{ promedio: number; cantidad: number } | null>(null);
  const [ganadas, setGanadas] = useState(0);
  useEffect(() => {
    let vivo = true;
    calificaciones("2000-01-01", todayIso()).then((m) => vivo && setEstrellas(m.get(meseroId) || { promedio: 0, cantidad: 0 }));
    cargarSemanas(104).then((s) => vivo && setGanadas((s || []).filter((x) => x.resultados.some((r) => r.meseroId === meseroId && r.lugar === 1)).length));
    return () => {
      vivo = false;
    };
  }, [meseroId]);
  const conEstrellas = !!estrellas && estrellas.cantidad >= MINIMO_ENCUESTAS;
  const ancho = conEstrellas ? (Math.round(estrellas!.promedio * 2) / 2 / 5) * 100 : 0;

  return (
    <>
      <div className="puntos-seccion">
        <h4>🏆 Mi ranking</h4>
        <div className="perfil-publico-datos">
          <div>
            <b>{yo ? `${yo.lugar}º` : "—"}</b>
            <span>{yo ? `esta semana · de ${ranking.filas.length}` : "esta semana"}</span>
          </div>
          <div>
            <b>{yo ? yo.puntos : "—"}</b>
            <span>puntos esta semana</span>
          </div>
          <div>
            {conEstrellas ? (
              <b className="estrellas-calif" aria-label={`${estrellas!.promedio} de 5 estrellas`}>
                <span>★★★★★</span>
                <span className="llenas" style={{ width: `${ancho}%` }}>
                  ★★★★★
                </span>
              </b>
            ) : (
              <b>⭐ —</b>
            )}
            <span>
              {conEstrellas ? `${estrellas!.promedio.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ` : ""}
              {estrellas?.cantidad || 0} {estrellas?.cantidad === 1 ? "encuesta" : "encuestas"}
            </span>
          </div>
        </div>
        {!yo && <span className="hint">Esta semana todavía no tienes venta.</span>}
        <button type="button" className="link-btn mi-ranking-ver" onClick={onVerRanking}>
          {ganadas > 0 ? `🏆 Ganaste ${ganadas} ${ganadas === 1 ? "semana" : "semanas"} · ` : ""}Ver el ranking ›
        </button>
      </div>
      <MisPuntos meseroId={meseroId} />
    </>
  );
}
