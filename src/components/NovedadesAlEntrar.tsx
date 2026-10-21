import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sparkles, X } from "lucide-react";
import { novedadesPendientes, registrarEntrada } from "../lib/novedades";
import type { Novedad, SeccionNovedad, VisualNovedad } from "../lib/novedades";
import { PERMISOS_DISPONIBLES } from "../lib/types";
import type { AppData, Profile } from "../lib/types";

function nombreSeccion(s: SeccionNovedad): string {
  return s === "corte" ? "Corte" : PERMISOS_DISPONIBLES.find((p) => p.value === s)?.label || s;
}

// Lo primero que ve una cuenta de equipo al entrar si hay algo nuevo en las
// secciones a las que tiene acceso (el dueño, en todas): una tarjeta por novedad con un dibujito
// de cómo se usa, "Siguiente" entre ellas y "Entendido" en la última. Se
// cierra en cualquier momento con la ✕ o tocando fuera, y ya no vuelve a
// salir. Antes de las novedades sale siempre una tarjeta de intro que
// explica qué son, para que nadie piense que abrió algo por error o que
// tiene que seleccionar algo. Ver lib/novedades.ts.
export function NovedadesAlEntrar({ profile, data, tieneCorte }: { profile: Profile; data: AppData; tieneCorte: boolean }) {
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [indice, setIndice] = useState(0);
  const [enIntro, setEnIntro] = useState(true);
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
  const botonCerrar = (
    <button type="button" className="icon-btn novedades-cerrar" onClick={cerrar} aria-label="Cerrar">
      <X size={18} />
    </button>
  );

  if (enIntro) {
    return (
      <div className="novedades-fondo" onClick={cerrar}>
        <div className="novedades-tarjeta" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Novedades">
          <div className="novedades-arriba">
            <span className="novedades-badge">Novedades · {novedades.length}</span>
            {botonCerrar}
          </div>
          <div className="nv-intro-icono">
            <Sparkles size={26} />
          </div>
          <h3 className="novedades-titulo nv-centro">Hay cosas nuevas en la app</h3>
          <p className="novedades-texto nv-centro">
            Cuando la app cambia, te lo explicamos con estas tarjetas la primera vez que entras. No se abrió nada por
            error.
          </p>
          <ol className="nv-intro-pasos">
            <li>
              <span className="nv-intro-num">1</span>
              <span>
                Cada tarjeta trae un <strong>dibujo de ejemplo</strong> de cómo se ve. Es solo para mirar:{" "}
                <strong>no hay que seleccionar nada</strong>.
              </span>
            </li>
            <li>
              <span className="nv-intro-num">2</span>
              <span>
                Lee y toca <strong>Siguiente</strong>. En la última, <strong>Entendido</strong>.
              </span>
            </li>
            <li>
              <span className="nv-intro-num">3</span>
              <span>Solo salen una vez. Después entras a la app como siempre.</span>
            </li>
          </ol>
          <button type="button" className="btn-primary" onClick={() => setEnIntro(false)}>
            Ver {novedades.length === 1 ? "la novedad" : "las novedades"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="novedades-fondo" onClick={cerrar}>
      <div className="novedades-tarjeta" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Novedades">
        <div className="novedades-arriba">
          <span className="novedades-badge">
            Novedad {indice + 1} de {novedades.length} · {nombreSeccion(n.seccion)}
          </span>
          {botonCerrar}
        </div>
        {/* Solo un dibujo de ejemplo: no responde a toques. */}
        <div className="novedades-visual nv-ejemplo-caja" aria-hidden="true">
          <span className="nv-ejemplo">Ejemplo · así se ve en la app</span>
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
        <p className="nv-pie">Solo es informativo — no tienes que hacer nada aquí.</p>
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
  if (tipo === "pedidosPegar") {
    return (
      <>
        <span className="nv-etiqueta">Lo que pegas</span>
        <div className="nv-campo">1 caja de francesa · 1 caja de francesa · 5kg carne molida</div>
        <div className="nv-lista">
          <div>
            <span>Papas a la francesa</span>
            <small>1 + 1 = 2 cajas</small>
          </div>
          <div>
            <span>Carne molida</span>
            <small>5 kg</small>
          </div>
        </div>
        <span className="nv-antes">Antes: sumar a mano y anotarlo en papel</span>
      </>
    );
  }
  if (tipo === "recetarioArea") {
    return (
      <>
        <span className="nv-etiqueta">Recetario de Cocina</span>
        <div className="nv-lista">
          <div>
            <span>Hamburguesa clásica</span>
            <small>Plato extendido</small>
          </div>
          <div>
            <span>Tacos de carne</span>
            <small>Plato extendido</small>
          </div>
        </div>
        <span className="nv-antes">Antes: salían también las bebidas de Bar</span>
      </>
    );
  }
  if (tipo === "conteoBar") {
    return (
      <>
        <span className="nv-etiqueta">Conteo diario de Bar</span>
        <div className="nv-campo nv-conteo">
          Agua natural Johnster (pz): <strong>24</strong>
          <br />
          XX Lager (pz): <strong>96</strong>
          <br />
          Tecate Light (pz): <strong>73</strong>
          <br />
          Indio (pz): _
        </div>
      </>
    );
  }
  if (tipo === "inventarioPasos") {
    return (
      <>
        <div className="inv-pasos">
          <div className="inv-paso hecho">
            <strong>
              <span className="inv-paso-num">✓</span>Jueves 22
            </strong>
            <small>Guardado</small>
          </div>
          <div className="inv-paso activo">
            <strong>
              <span className="inv-paso-num">2</span>Domingo 25
            </strong>
            <small>Sin guardar</small>
          </div>
        </div>
        <span className="nv-suma">El domingo se habilita al guardar el jueves.</span>
      </>
    );
  }
  if (tipo === "apertura") {
    return (
      <>
        <span className="nv-etiqueta">Corte de apertura · abre Jenny (X)</span>
        <div className="nv-lista">
          <div>
            <span>Apps</span>
            <small>$800</small>
          </div>
          <div>
            <span>Johnster</span>
            <small>$2,100</small>
          </div>
          <div>
            <span>Jenny</span>
            <small>$3,000</small>
          </div>
        </div>
        <div className="nv-boton">🔒 Guardar corte de apertura</div>
      </>
    );
  }
  if (tipo === "cierreTotal") {
    return (
      <>
        <span className="nv-etiqueta">Johnster · total del día del sistema</span>
        <div className="nv-campo">6,800</div>
        <span className="nv-suma">
          En la apertura <strong>$2,100</strong> · Este corte: <strong>$4,700</strong>
        </span>
      </>
    );
  }
  if (tipo === "efectivoEntregar") {
    return (
      <>
        <span className="nv-etiqueta">Efectivo del día</span>
        <div className="nv-lista">
          <div>
            <span>Resto del día</span>
            <small>$5,780</small>
          </div>
          <div>
            <span>+ Se dejó ayer (hielo)</span>
            <small>$1,500</small>
          </div>
        </div>
        <span className="nv-suma">
          Efectivo a entregar en la noche: <strong>$7,280</strong>
        </span>
      </>
    );
  }
  if (tipo === "guardarCorte") {
    return (
      <>
        <div className="nv-checks">
          <span>
            ☑ Total de tarjetas <strong>$14,380</strong>
          </span>
          <span>
            ☑ Total de gastos <strong>$1,135</strong>
          </span>
          <span>☑ Ya subí todo al bot</span>
        </div>
        <div className="nv-boton">🔒 Guardar corte</div>
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
