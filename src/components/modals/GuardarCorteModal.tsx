import { useState } from "react";
import { Lock } from "lucide-react";
import { Sheet } from "../ui";
import { money } from "../../lib/dataModel";
import type { DayData } from "../../lib/types";

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
}: {
  day: DayData;
  totals: { tarjetas: number; transferencias: number; gastos: number; ventaTotal: number; ventaApps: number };
  onGuardar: () => void;
  onClose: () => void;
}) {
  const faltan = faltantesDelCorte(day);
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
  const todos = renglones.every((r) => marcados.has(r.key)) && marcados.has("bot");

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

  return (
    <Sheet title="¿Seguro guardar el corte?" onClose={onClose}>
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
        <label className="gc-check gc-bot">
          <input type="checkbox" checked={marcados.has("bot")} onChange={() => toggle("bot")} />
          <span>
            Ya subí al bot los comprobantes de <strong>gastos</strong>, <strong>bancarios</strong> y{" "}
            <strong>transferencias</strong>, y la <strong>venta</strong>.
          </span>
        </label>
      </div>
      <button className="btn-primary" disabled={!todos} onClick={onGuardar}>
        <Lock size={16} /> Sí, todo coincide — guardar corte
      </button>
      <button className="link-btn gc-volver" onClick={onClose}>
        Volver a revisar
      </button>
    </Sheet>
  );
}
