import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// "Jalar hacia abajo para actualizar" en toda la app (la app instalada no
// trae el del navegador): si lo que se está viendo ya está hasta arriba —
// la página o una pantalla completa con su propio scroll — y se jala hacia
// abajo, al soltar se vuelven a cargar los datos. Las pantallas que traen
// datos aparte (Johnster) escuchan el evento "recargar-datos".
export const EVENTO_RECARGAR = "recargar-datos";
const UMBRAL = 70;

function contenedorConScroll(el: Element | null): Element | null {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const st = getComputedStyle(n);
    if ((st.overflowY === "auto" || st.overflowY === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

export function JalarParaActualizar({ onRecargar }: { onRecargar: () => Promise<void> }) {
  const [jalon, setJalon] = useState(0);
  const [cargando, setCargando] = useState(false);
  const inicio = useRef<{ y: number; x: number } | null>(null);
  const activo = useRef(false);
  const ultimo = useRef(0);
  const ocupado = useRef(false);

  useEffect(() => {
    function arriba(target: EventTarget | null) {
      const el = target instanceof Element ? target : null;
      // Campos de texto y tablas que se deslizan de lado no cuentan.
      if (el?.closest("textarea, input, select, [data-sin-jalar]")) return false;
      const c = contenedorConScroll(el);
      return c ? c.scrollTop <= 0 : (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;
    }
    function empieza(e: TouchEvent) {
      if (ocupado.current || e.touches.length !== 1 || !arriba(e.target)) return;
      inicio.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
      activo.current = false;
    }
    function mueve(e: TouchEvent) {
      if (!inicio.current) return;
      const dy = e.touches[0].clientY - inicio.current.y;
      const dx = Math.abs(e.touches[0].clientX - inicio.current.x);
      if (!activo.current) {
        if (dy < 8 || dx > dy) {
          if (dy < 0 || dx > dy) inicio.current = null;
          return;
        }
        activo.current = true;
      }
      const v = Math.min(120, dy * 0.5);
      ultimo.current = v;
      setJalon(v);
    }
    function suelta() {
      if (!inicio.current) return;
      inicio.current = null;
      const listo = activo.current && ultimo.current >= UMBRAL;
      activo.current = false;
      ultimo.current = 0;
      setJalon(0);
      if (!listo) return;
      ocupado.current = true;
      setCargando(true);
      window.dispatchEvent(new Event(EVENTO_RECARGAR));
      const minimo = new Promise((r) => setTimeout(r, 700));
      Promise.all([onRecargar().catch(() => {}), minimo]).finally(() => {
        ocupado.current = false;
        setCargando(false);
      });
    }
    document.addEventListener("touchstart", empieza, { passive: true });
    document.addEventListener("touchmove", mueve, { passive: true });
    document.addEventListener("touchend", suelta);
    document.addEventListener("touchcancel", suelta);
    return () => {
      document.removeEventListener("touchstart", empieza);
      document.removeEventListener("touchmove", mueve);
      document.removeEventListener("touchend", suelta);
      document.removeEventListener("touchcancel", suelta);
    };
  }, [onRecargar]);

  if (!jalon && !cargando) return null;
  const listo = jalon >= UMBRAL;
  return (
    <div className="jalar" style={{ transform: `translate(-50%, ${cargando ? 18 : jalon - 30}px)` }} role="status">
      <RefreshCw size={16} className={cargando ? "girando" : ""} style={cargando ? undefined : { transform: `rotate(${jalon * 3}deg)` }} />
      <span>{cargando ? "Actualizando…" : listo ? "Suelta para actualizar" : "Jala para actualizar"}</span>
    </div>
  );
}

// Para las pantallas con datos propios: corre fn cuando se jala para actualizar.
export function useAlRecargar(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = () => ref.current();
    window.addEventListener(EVENTO_RECARGAR, h);
    return () => window.removeEventListener(EVENTO_RECARGAR, h);
  }, []);
}

// Para las secciones que cargan datos aparte: un número que cambia cada vez
// que se jala para actualizar; ponerlo en las dependencias de su carga.
export function useTickRecargar() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener(EVENTO_RECARGAR, h);
    return () => window.removeEventListener(EVENTO_RECARGAR, h);
  }, []);
  return tick;
}
