import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronLeft } from "lucide-react";

// El regreso y el nombre de cada pantalla van en la barra de arriba, junto
// al logo. Cada pantalla pone su <TituloPagina> donde antes iba su
// "← Inicio" y su título, y este lo dibuja en la ranura de la barra
// (<RanuraTitulo>). Si no hay barra (p. ej. en una prueba), se dibuja ahí
// mismo como antes. Los nombres largos pasan completos a un segundo
// renglón: nunca se cortan palabras.

const Ctx = createContext<{ nodo: HTMLElement | null; setNodo: (n: HTMLElement | null) => void } | null>(null);

export function BarraTituloProvider({ children }: { children: ReactNode }) {
  const [nodo, setNodo] = useState<HTMLElement | null>(null);
  return <Ctx.Provider value={{ nodo, setNodo }}>{children}</Ctx.Provider>;
}

// En la barra, junto al logo. "respaldo" (el mes, el área) se ve solo
// mientras la pantalla no ponga su propio título.
export function RanuraTitulo({ respaldo }: { respaldo?: ReactNode }) {
  const ctx = useContext(Ctx);
  return (
    <>
      <div className="barra-titulo" ref={ctx?.setNodo} />
      {respaldo && <span className="barra-respaldo">{respaldo}</span>}
    </>
  );
}

export function TituloPagina({
  titulo,
  subtitulo,
  onBack,
  backLabel,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  const ctx = useContext(Ctx);
  if (!ctx?.nodo) {
    return (
      <>
        {onBack && (
          <button className="link-btn back-link" onClick={onBack}>
            <ArrowLeft size={15} /> {backLabel || "Regresar"}
          </button>
        )}
        <h2 className="page-title">{titulo}</h2>
      </>
    );
  }
  const largo = typeof titulo === "string" && titulo.length > 18;
  return createPortal(
    <>
      {onBack && (
        <button type="button" className="barra-atras" onClick={onBack} aria-label={backLabel ? `Regresar a ${backLabel}` : "Regresar"}>
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="barra-textos">
        <h1 className={`barra-nombre ${largo ? "largo" : ""}`}>{titulo}</h1>
        {subtitulo && <span className="barra-sub">{subtitulo}</span>}
      </div>
    </>,
    ctx.nodo
  );
}
