import type { Receta } from "./types";

// Cargar varias recetas de una vez (Recetario > "Cargar varias"): lee un
// texto con este formato, una receta tras otra:
//
//   # Margarita
//   Vaso: Copa margarita, escarchada con sal
//   Ingredientes:
//   2 oz Tequila blanco
//   1 oz Triple sec
//   Utensilios: Coctelera, Jigger
//   Preparación:
//   Escarchar la copa con sal.
//   Agitar con hielo y colar.
//   Notas: Rodaja de limón
//
// Cada receta empieza con "#". Las secciones pueden ir en el mismo renglón
// ("Vaso: ...") o en los renglones de abajo, hasta la siguiente sección; las
// que no se pongan quedan vacías. No importan mayúsculas ni acentos en los
// nombres de las secciones.

export type RecetaLeida = Omit<Receta, "id" | "area">;

type Campo = "vaso" | "ingredientes" | "utensilios" | "preparacion" | "notas";

const SECCIONES: Record<string, Campo> = {
  vaso: "vaso",
  presentacion: "vaso",
  ingredientes: "ingredientes",
  ingrediente: "ingredientes",
  utensilios: "utensilios",
  utensilio: "utensilios",
  preparacion: "preparacion",
  pasos: "preparacion",
  metodo: "preparacion",
  notas: "notas",
  nota: "notas",
  decoracion: "notas",
};

const sinAcentos = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export const EJEMPLO_RECETAS = `# Margarita
Vaso: Copa margarita, escarchada con sal
Ingredientes:
2 oz Tequila blanco
1 oz Triple sec
1 oz Jugo de limón
Utensilios: Coctelera, Jigger, Colador
Preparación:
Escarchar la copa con sal.
Agitar todo con hielo 10 segundos.
Colar a la copa.
Notas: Rodaja de limón

# Mojito
Vaso: Vaso highball
Ingredientes:
2 oz Ron blanco
8 hojas Hierbabuena
Preparación:
Machacar la hierbabuena.
Agregar hielo y ron.`;

export function leerRecetas(texto: string): RecetaLeida[] {
  const recetas: RecetaLeida[] = [];
  let actual: (RecetaLeida & { _lineas: Record<Campo, string[]> }) | null = null;
  let campo: Campo | null = null;

  const cerrar = () => {
    if (!actual) return;
    const { _lineas, ...resto } = actual;
    recetas.push({
      ...resto,
      vaso: _lineas.vaso.join(" ").trim(),
      ingredientes: _lineas.ingredientes.join("\n"),
      utensilios: _lineas.utensilios.join(", "),
      preparacion: _lineas.preparacion.join("\n"),
      notas: _lineas.notas.join(" ").trim(),
    });
  };

  for (const crudo of texto.split(/\r?\n/)) {
    const linea = crudo.trim();
    if (!linea) continue;
    if (linea.startsWith("#")) {
      cerrar();
      const nombre = linea.replace(/^#+/, "").trim();
      actual = nombre
        ? {
            nombre,
            vaso: "",
            ingredientes: "",
            utensilios: "",
            preparacion: "",
            notas: "",
            _lineas: { vaso: [], ingredientes: [], utensilios: [], preparacion: [], notas: [] },
          }
        : null;
      campo = null;
      continue;
    }
    if (!actual) continue;
    // "Sección:" sola o "Sección: valor" en el mismo renglón.
    const m = linea.match(/^([^:]{2,20}):\s*(.*)$/);
    const seccion = m ? SECCIONES[sinAcentos(m[1])] : undefined;
    if (seccion) {
      campo = seccion;
      if (m![2]) actual._lineas[seccion].push(m![2].trim());
      continue;
    }
    // Sin sección todavía: se toma como preparación, para no perder nada.
    actual._lineas[campo || "preparacion"].push(linea.replace(/^[-•*]\s*/, ""));
  }
  cerrar();
  return recetas;
}
