import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { novedadesPendientes, registrarEntrada } from "../lib/novedades";
import type { Novedad, VisualNovedad } from "../lib/novedades";
import type { AppData, Profile } from "../lib/types";

// Lo primero que ve una cuenta de equipo al entrar si hay algo nuevo en las
// secciones a las que tiene acceso (el dueño, en todas): una tarjeta por novedad con un dibujito
// de cómo se usa, "Siguiente" entre ellas y "Entendido" en la última. Se
// cierra en cualquier momento con la ✕ o tocando fuera, y ya no vuelve a
// salir. Ver lib/novedades.ts.
export function NovedadesAlEntrar({ profile, data, tieneCorte }: { profile: Profile; data: AppData; tieneCorte: boolean }) {
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [indice, setIndice] = useState(0);
  const revisado = useRef(false);

  useEffect(() => {
    if (revisado.current) return;
    revisado.current = true;
    novedadesPendientes(profile, data, tieneCorte).then((lista) => {
      if (lista.length > 0) setNovedades(lista);
      // Sin novedades, de una vez queda que entró; con novedades, hasta
      // que las cierre (si se sale antes, le vuelven a salir).
      else registrarEntrada(profile, tieneCorte);
    });
  }, [profile, data, tieneCorte]);

  if (novedades.length === 0) return null;

  function cerrar() {
    registrarEntrada(profile, tieneCorte, novedades);
    setNovedades([]);
  }

  const n = novedades[indice];
  const ultima = indice === novedades.length - 1;

  return (
    <div className="novedades-fondo" onClick={cerrar}>
      <div className="novedades-tarjeta" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Novedades">
        <div className="novedades-arriba">
          <span className="novedades-badge">
            Novedad{novedades.length > 1 ? ` · ${indice + 1} de ${novedades.length}` : ""}
          </span>
          <button type="button" className="icon-btn novedades-cerrar" onClick={cerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="novedades-visual">
          <Visual tipo={n.visual} />
        </div>
        <h3 className="novedades-titulo">{n.titulo}</h3>
        <p className="novedades-texto">{conNegritas(n.texto)}</p>
        {novedades.length > 1 && (
          <div className="novedades-puntos">
            {novedades.map((x, i) => (
              <button
                key={x.id}
                type="button"
                className={i === indice ? "activo" : ""}
                aria-label={`Ver novedad ${i + 1}`}
                onClick={() => setIndice(i)}
              />
            ))}
          </div>
        )}
        <button type="button" className="btn-primary" onClick={() => (ultima ? cerrar() : setIndice(indice + 1))}>
          {ultima ? "Entendido" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}

function conNegritas(texto: string): ReactNode[] {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte));
}

// Dibujitos de cada novedad: una versión mini y fija de cómo se ve en la app.
function Visual({ tipo }: { tipo: VisualNovedad }) {
  if (tipo === "sumar") {
    return (
      <>
        <span className="nv-etiqueta">Tarjetas</span>
        <div className="nv-fila">
          <div className="nv-campo">300+450+125</div>
          <div className="nv-mas">+</div>
        </div>
        <span className="nv-suma">
          = <strong>$875.00</strong> · 3 montos
        </span>
        <span className="nv-antes">Antes: sumar aparte y escribir el total</span>
      </>
    );
  }
  if (tipo === "autocompletar") {
    return (
      <>
        <span className="nv-etiqueta">Concepto del gasto</span>
        <div className="nv-campo">coca</div>
        <div className="nv-lista">
          <div>
            <span>Coca Cola</span>
            <small>usado 42 veces</small>
          </div>
          <div>
            <span>Coca Cola 3L</span>
            <small>usado 9 veces</small>
          </div>
        </div>
      </>
    );
  }
  if (tipo === "faltan") {
    return (
      <>
        <span className="nv-etiqueta">Faltan por contar</span>
        <div className="nv-lista">
          <div>
            <span>☑ Zanahoria</span>
            <small>no hay → 0</small>
          </div>
          <div>
            <span>☑ Cilantro</span>
            <small>no hay → 0</small>
          </div>
        </div>
        <span className="nv-suma">
          Zanahoria <strong>0 kg</strong> · Pedir <strong>5 kg</strong>
        </span>
      </>
    );
  }
  return (
    <>
      <span className="nv-etiqueta">Categoría</span>
      <div className="nv-campo nv-falta">Sin categoría ▾</div>
      <span className="nv-error">Elige una categoría para guardar el gasto</span>
      <div className="nv-chips">
        <span>Operación</span>
        <span>Mantenimiento</span>
        <span className="nuevo">Servicio · nuevo</span>
        <span>Otro</span>
      </div>
    </>
  );
}
