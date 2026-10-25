import { money } from "../lib/dataModel";
import type { Pronostico } from "../lib/pronostico";

const nombreDia: Record<string, string> = { Lunes: "lunes", Martes: "martes", Miércoles: "miércoles", Jueves: "jueves", Viernes: "viernes", Sábado: "sábado", Domingo: "domingo" };
const plural: Record<string, string> = { Lunes: "lunes", Martes: "martes", Miércoles: "miércoles", Jueves: "jueves", Viernes: "viernes", Sábado: "sábados", Domingo: "domingos" };

// Desglose del pronóstico de venta de un día: cuánto se espera, el rango,
// de dónde sale (día típico) y qué lo ajusta; si ya pasó, contra lo real.
export function PronosticoDetalle({ p, real }: { p: Pronostico; real?: number }) {
  const diff = real && p.esperado ? Math.round(((real - p.esperado) / p.esperado) * 100) : null;
  return (
    <div className="pron-detalle">
      <div className="pron-cab">
        <span>Venta esperada</span>
        <b>{money(p.esperado)}</b>
        <small>
          entre {money(p.bajo)} y {money(p.alto)}
        </small>
      </div>
      <div className="pron-fila">
        <span>
          Un {nombreDia[p.dia]} normal
          <small>
            la venta de en medio de los últimos {p.diasTipicos} {plural[p.dia]} sin nada especial
          </small>
        </span>
        <b>{money(p.tipico)}</b>
      </div>
      {p.ajustes.map((a) => (
        <div key={a.clave} className="pron-fila">
          <span>
            {a.texto}
            <small>
              {a.casos} {a.casos === 1 ? "día" : "días"} con esto antes{a.casos < 3 ? " · pocos datos" : ""}
            </small>
          </span>
          <b className={a.pct < 0 ? "menos" : "mas"}>
            {a.pct > 0 ? "+" : ""}
            {a.pct}%
          </b>
        </div>
      ))}
      {p.sinDatos.map((s) => (
        <div key={s} className="pron-fila sin">
          <span>
            {s}
            <small>todavía no hay días así para medirlo</small>
          </span>
          <b>—</b>
        </div>
      ))}
      {real ? (
        <div className={`pron-real ${diff! >= 0 ? "arriba" : "abajo"}`}>
          Vendiste {money(real)} · {diff! >= 0 ? "+" : ""}
          {diff}% contra lo esperado
        </div>
      ) : null}
    </div>
  );
}
