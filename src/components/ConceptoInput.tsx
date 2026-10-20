import { useEffect, useMemo, useState } from "react";
import { corregirOrtografia, nombreConocido, sugerirNombres } from "../lib/gastosBusqueda";
import type { NombreHistorial } from "../lib/gastosBusqueda";

// Cuadro de texto para el concepto de un gasto: mientras se escribe
// sugiere los nombres del historial (el más usado arriba) y, si el nombre
// es nuevo, una corrección de ortografía. Nunca cambia el texto solo —
// siempre hay que tocar la sugerencia.
export function ConceptoInput({
  value,
  onChange,
  historial,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  historial: NombreHistorial[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [enfocado, setEnfocado] = useState(false);
  const [correccion, setCorreccion] = useState<{ para: string; texto: string } | null>(null);

  const sugerencias = useMemo(() => sugerirNombres(value, historial), [value, historial]);
  const conocido = useMemo(() => nombreConocido(value, historial), [value, historial]);
  const exacto = conocido !== null && conocido === value.trim();

  // La ortografía se revisa cuando se deja de escribir un momento, y solo
  // si el nombre todavía no existe en el historial.
  useEffect(() => {
    if (value.trim().length < 3 || conocido) return;
    let vigente = true;
    const t = setTimeout(() => {
      corregirOrtografia(value, historial).then((texto) => {
        if (vigente && texto) setCorreccion({ para: value, texto });
      });
    }, 900);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [value, conocido, historial]);

  const mostrarLista = enfocado && sugerencias.length > 0 && !exacto;
  // Si ya existe con otra forma de escribirse ("coca cola" → "Coca Cola").
  const formaConocida = conocido && !exacto ? conocido : null;
  const ortografia = !formaConocida && correccion?.para === value && correccion.texto !== value ? correccion.texto : null;

  return (
    <div className="concepto-input">
      <input
        className="text-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {mostrarLista && (
        <div className="concepto-sugerencias">
          {sugerencias.map((s) => (
            <button
              key={s.nombre}
              type="button"
              className="concepto-sugerencia"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s.nombre);
                setEnfocado(false);
              }}
            >
              <span>{s.nombre}</span>
              <small>
                usado {s.usos} {s.usos === 1 ? "vez" : "veces"}
              </small>
            </button>
          ))}
        </div>
      )}
      {!mostrarLista && (formaConocida || ortografia) && (
        <button type="button" className="concepto-correccion" onClick={() => onChange((formaConocida || ortografia) as string)}>
          ¿Quisiste decir <strong>{formaConocida || ortografia}</strong>? — tocar para usarlo
        </button>
      )}
    </div>
  );
}
