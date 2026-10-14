import { useState, type ReactNode } from "react";
import { ArrowLeft, Circle, CircleDot, TriangleAlert } from "lucide-react";
import { Empty, Field, Sheet } from "../ui";
import {
  dateForDay,
  formatDayNumber,
  formatLongDayDate,
  formatWeekRange,
  mostRecentDayInWeek,
  resolveWeekStartDate,
} from "../../lib/dataModel";
import { DAYS, DAY_SHORT } from "../../lib/types";
import type { DayName, MonthData } from "../../lib/types";

export function ConteoDiarioPanel({
  onBack,
  backLabel,
  emptyIcon,
  emptyText,
  plantilla,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  textos,
  onGuardar,
}: {
  onBack?: () => void;
  backLabel: string;
  emptyIcon: ReactNode;
  emptyText: string;
  plantilla: string;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  textos: Record<string, string>;
  onGuardar: (fecha: string, texto: string) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [dayName, setDayName] = useState<DayName>(() =>
    months[initialMonthKey] ? mostRecentDayInWeek(initialMonthKey, initialWeekIndex, months[initialMonthKey]) : "Lunes"
  );

  const month = months[monthKey] || null;
  const weekStartDate = month ? resolveWeekStartDate(monthKey, weekIndex, month) : null;
  const fecha = month ? dateForDay(monthKey, weekIndex, month, dayName) : null;

  if (monthKeys.length === 0 || !month || !fecha || !weekStartDate) {
    return (
      <div className="page-section">
        {onBack && (
          <button className="link-btn back-link" onClick={onBack}>
            <ArrowLeft size={15} /> {backLabel}
          </button>
        )}
        <h2 className="page-title">Conteo diario</h2>
        <Empty icon={emptyIcon} text="Primero crea un mes en Corte para poder llevar el conteo diario." />
      </div>
    );
  }

  function irASemana(mk: string, wi: number) {
    setMonthKey(mk);
    setWeekIndex(wi);
    setDayName(mostRecentDayInWeek(mk, wi, months[mk]));
  }

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <h2 className="page-title">Conteo diario</h2>

      <div className="field-row">
        <Field label="Mes">
          <select className="text-input" value={monthKey} onChange={(e) => irASemana(e.target.value, 0)}>
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select className="text-input" value={weekIndex} onChange={(e) => irASemana(monthKey, Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {i + 1}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

      <nav className="day-scroll">
        {DAYS.map((d) => {
          const dDate = dateForDay(monthKey, weekIndex, month, d);
          const hasData = !!textos[dDate];
          return (
            <button key={d} className={`day-chip ${d === dayName ? "active" : ""}`} onClick={() => setDayName(d)}>
              {hasData ? <CircleDot size={9} /> : <Circle size={9} />}
              {DAY_SHORT[d]} <span className="day-chip-date">{formatDayNumber(dDate)}</span>
            </button>
          );
        })}
      </nav>
      <p className="active-day-date">{formatLongDayDate(fecha)}</p>

      {!plantilla ? (
        <Empty icon={emptyIcon} text={emptyText} />
      ) : (
        // key={fecha}: el formulario nace de lo guardado para ESA fecha.
        <ConteoTextoForm key={fecha} fecha={fecha} guardado={textos[fecha]} plantilla={plantilla} onGuardar={onGuardar} />
      )}
    </div>
  );
}

// Conteo diario en texto: lo primero que se ve es la lista con los nombres
// y su presentación entre paréntesis, y el jefe de cocina/barra escribe la
// cantidad después de cada ":". Se guarda el texto tal cual, por fecha.
function ConteoTextoForm({
  fecha,
  guardado,
  plantilla,
  onGuardar,
}: {
  fecha: string;
  guardado?: string;
  plantilla: string;
  onGuardar: (fecha: string, texto: string) => void;
}) {
  const [texto, setTexto] = useState(guardado ?? plantilla);
  const [locked, setLocked] = useState(guardado !== undefined);
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);

  function guardar() {
    onGuardar(fecha, texto);
    setLocked(true);
  }

  return (
    <>
      {locked && (
        <div className="conteo-locked-banner">
          <span>Este conteo ya está guardado y está bloqueado.</span>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(true)}>
            Editar
          </button>
        </div>
      )}
      <textarea
        className="text-input conteo-texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={Math.max(10, texto.split("\n").length + 2)}
        disabled={locked}
      />
      <button className="btn-primary" onClick={guardar} disabled={locked}>
        Guardar conteo
      </button>

      {pidiendoConfirmacion && (
        <Sheet title="Editar conteo guardado" onClose={() => setPidiendoConfirmacion(false)}>
          <p className="hint">
            Este conteo de {formatLongDayDate(fecha)} ya se guardó. No deberías editarlo salvo que
            estés seguro de que el valor capturado está mal.
          </p>
          <button
            className="btn-warn"
            onClick={() => {
              setLocked(false);
              setPidiendoConfirmacion(false);
            }}
          >
            <TriangleAlert size={16} /> Sí, necesito editarlo
          </button>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(false)}>
            Cancelar
          </button>
        </Sheet>
      )}
    </>
  );
}
