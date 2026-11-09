import { useRef, useState } from "react";
import { Check, Delete, Search, X } from "lucide-react";
import { sugerirInsumos } from "../lib/inventarioNotas";
import type { InsumoEntry } from "../lib/types";

// Inventario: buscador para anotar el producto que se va viendo, en
// cualquier forma de contar. Al elegir uno se abre un teclado numérico en
// pantalla (no el del celular) para la cantidad; si ese producto ya se contó
// ese día, pregunta si se suma a lo contado o se corrige.

export type AccionConteo = "nuevo" | "sumar" | "corregir";

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

export function BuscadorInventario({
  productos,
  contado,
  detalle,
  onGuardar,
}: {
  productos: InsumoEntry[];
  // Lo ya contado de ese producto en este inventario (null = no se ha contado).
  contado: (i: InsumoEntry) => number | null;
  // Debajo del nombre (proveedor o área).
  detalle: (i: InsumoEntry) => string;
  onGuardar: (i: InsumoEntry, cantidad: number, accion: AccionConteo) => void;
}) {
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState<InsumoEntry | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const avisoTimer = useRef<number | undefined>(undefined);
  const sugerencias = sugerirInsumos(texto, productos);
  const unidad = (i: InsumoEntry) => (i.unidad === "pieza" ? "pz" : i.unidad);

  function guardar(i: InsumoEntry, cantidad: number, accion: AccionConteo) {
    onGuardar(i, cantidad, accion);
    const antes = contado(i);
    const total = accion === "sumar" && antes !== null ? antes + cantidad : cantidad;
    setElegido(null);
    setTexto("");
    setAviso(`${i.nombre} · ${fmt(total)} ${unidad(i)}${accion === "sumar" ? " (sumado)" : accion === "corregir" ? " (corregido)" : ""}`);
    window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 3000);
    window.setTimeout(() => campo.current?.focus(), 50);
  }

  return (
    <div className="ib">
      <label className="ib-campo">
        <Search size={18} aria-hidden />
        <input
          ref={campo}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Buscar producto para anotarlo…"
          aria-label="Buscar producto para anotarlo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && sugerencias[0]) setElegido(sugerencias[0]);
          }}
        />
        {texto && (
          <button type="button" className="ib-limpiar" aria-label="Borrar búsqueda" onClick={() => setTexto("")}>
            <X size={16} />
          </button>
        )}
      </label>
      {texto.trim() && (
        <div className="ib-lista" role="listbox" aria-label="Productos encontrados">
          {sugerencias.length === 0 ? (
            <p className="ib-nada">No hay productos de este día con ese nombre.</p>
          ) : (
            sugerencias.map((i) => {
              const c = contado(i);
              return (
                <button key={i.id} type="button" role="option" aria-selected={false} className="ib-item" onClick={() => setElegido(i)}>
                  <span>
                    <b>{i.nombre}</b>
                    <small>{detalle(i)}</small>
                  </span>
                  {c !== null ? (
                    <em className="ib-contado">
                      <Check size={13} aria-hidden /> {fmt(c)} {unidad(i)}
                    </em>
                  ) : (
                    <em className="ib-falta">Sin contar</em>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
      {aviso && (
        <div className="ib-aviso" role="status">
          <Check size={15} aria-hidden /> {aviso}
        </div>
      )}
      {elegido && (
        <TecladoCantidad
          producto={elegido}
          unidad={unidad(elegido)}
          detalle={detalle(elegido)}
          antes={contado(elegido)}
          onClose={() => setElegido(null)}
          onGuardar={(n, accion) => guardar(elegido, n, accion)}
        />
      )}
    </div>
  );
}

function TecladoCantidad({
  producto,
  unidad,
  detalle,
  antes,
  onClose,
  onGuardar,
}: {
  producto: InsumoEntry;
  unidad: string;
  detalle: string;
  antes: number | null;
  onClose: () => void;
  onGuardar: (cantidad: number, accion: AccionConteo) => void;
}) {
  const [valor, setValor] = useState("");
  const [preguntando, setPreguntando] = useState(false);
  const n = Number(valor || "0");
  const tecla = (t: string) =>
    setValor((v) => {
      if (t === "." && v.includes(".")) return v;
      if (t === "." && v === "") return "0.";
      if (v === "0" && t !== ".") return t;
      return (v + t).slice(0, 8);
    });
  const listo = valor !== "" && valor !== "0." && !Number.isNaN(n);
  const guardar = (cantidad: number) => (antes !== null ? (setValor(fmt(cantidad)), setPreguntando(true)) : onGuardar(cantidad, "nuevo"));

  return (
    <div className="ib-fondo" onClick={onClose}>
      <div className="ib-teclado" role="dialog" aria-label={`Cantidad de ${producto.nombre}`} onClick={(e) => e.stopPropagation()}>
        <div className="ib-cabeza">
          <div>
            <strong>{producto.nombre}</strong>
            <small>
              {detalle}
              {antes !== null && ` · ya contado: ${fmt(antes)} ${unidad}`}
            </small>
          </div>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {preguntando && antes !== null ? (
          <div className="ib-pregunta">
            <p>
              Ya contaste <b>{fmt(antes)} {unidad}</b> de {producto.nombre} hoy. ¿Qué hago con <b>{fmt(n)} {unidad}</b>?
            </p>
            <button type="button" className="ib-opcion" onClick={() => onGuardar(n, "sumar")}>
              <span>
                Sumarlo a lo ya contado
                <small>Queda en {fmt(antes + n)} {unidad}</small>
              </span>
            </button>
            <button type="button" className="ib-opcion" onClick={() => onGuardar(n, "corregir")}>
              <span>
                Corregir la cantidad
                <small>Queda en {fmt(n)} {unidad}</small>
              </span>
            </button>
            <button type="button" className="link-btn emp-btn-cancelar" onClick={() => setPreguntando(false)}>
              Volver al teclado
            </button>
          </div>
        ) : (
          <>
            <div className="ib-pantalla" aria-live="polite">
              <span>{valor || "0"}</span>
              <b>{unidad}</b>
            </div>
            <div className="ib-teclas">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((t) => (
                <button key={t} type="button" className="ib-tecla" onClick={() => tecla(t)}>
                  {t}
                </button>
              ))}
              <button type="button" className="ib-tecla borrar" aria-label="Borrar" onClick={() => setValor((v) => v.slice(0, -1))}>
                <Delete size={24} />
              </button>
            </div>
            <div className="ib-acciones">
              <button type="button" className="ib-nohay" onClick={() => guardar(0)}>
                No hay · 0
              </button>
              <button type="button" className="ca-boton" disabled={!listo} onClick={() => guardar(n)}>
                Guardar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
