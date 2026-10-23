import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { activarNotificaciones, apagarNotificaciones, estadoNotificaciones, mandarPrueba, refrescarSuscripcion, type EstadoNotif } from "../lib/notificaciones";
import { configDe, horaTexto } from "../lib/notificacionesLogica";
import { DAYS, type AppData, type ConfigNotificaciones, type ConteoTextoArea, type DayName } from "../lib/types";

// Mi perfil (dueño): notificaciones en este iPhone. Activar el dispositivo,
// qué avisos quiere, la hora límite de cada conteo por día, cada cuánto se
// repite y a qué hora llegan los gastos pendientes.
const HORAS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
// Para la hora límite del conteo: de la tarde a la madrugada siguiente.
const HORAS_CONTEO = [...HORAS.slice(36), ...HORAS.slice(0, 16)];
const REPETIR = [3, 6, 9, 12, 24];
const DIA_CORTO: Record<DayName, string> = { Lunes: "Lunes", Martes: "Martes", Miércoles: "Miércoles", Jueves: "Jueves", Viernes: "Viernes", Sábado: "Sábado", Domingo: "Domingo" };

export function NotificacionesDueno({ ownerId, data, onGuardar }: { ownerId: string; data: AppData; onGuardar: (config: ConfigNotificaciones) => void }) {
  const [estado, setEstado] = useState<EstadoNotif | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const config = configDe(data);

  useEffect(() => {
    estadoNotificaciones().then(setEstado);
    refrescarSuscripcion(ownerId);
  }, [ownerId]);

  const cambiar = (c: Partial<ConfigNotificaciones>) => onGuardar({ ...config, ...c });
  const cambiarHora = (area: ConteoTextoArea, dia: DayName, hora: string) =>
    cambiar({ horas: { ...config.horas, [area]: { ...config.horas[area], [dia]: hora } } });

  async function activar() {
    setOcupado(true);
    setAviso(null);
    try {
      const e = await activarNotificaciones(ownerId);
      setEstado(e);
      if (e === "bloqueadas") setAviso("El iPhone tiene bloqueadas las notificaciones de Cortes: actívalas en Ajustes › Notificaciones › Cortes.");
    } catch (e) {
      console.error(e);
      setAviso("No se pudieron activar. Revisa tu conexión e intenta de nuevo.");
    }
    setOcupado(false);
  }

  async function probar() {
    setOcupado(true);
    const n = await mandarPrueba();
    setAviso(n === null ? "No se pudo mandar la prueba. Revisa tu conexión." : n === 0 ? "No hay ningún dispositivo activado." : "Listo: debe llegarte en unos segundos.");
    setOcupado(false);
  }

  const interruptor = (clave: "conteoCocina" | "conteoBar" | "alGuardar" | "gastos", titulo: string, detalle: string) => (
    <label className="notif-fila">
      <span>
        <b>{titulo}</b>
        <small>{detalle}</small>
      </span>
      <input type="checkbox" className="notif-switch" checked={config[clave]} onChange={(e) => cambiar({ [clave]: e.target.checked })} />
    </label>
  );

  return (
    <div className="notif">
      <div className="notif-tarjeta">
        <h4>
          <Bell size={17} /> Notificaciones en este iPhone
        </h4>
        {estado === "instalar" && (
          <div className="notif-pasos">
            <b>Primero instala Cortes en tu pantalla de inicio:</b>
            <span>1. En Safari toca Compartir → "Agregar a pantalla de inicio".</span>
            <span>2. Abre Cortes desde ese ícono y vuelve aquí a Mi perfil.</span>
          </div>
        )}
        {estado === "sin-soporte" && <p className="hint">Este navegador no acepta notificaciones. Usa Cortes instalado en tu iPhone (iOS 16.4 o más nuevo).</p>}
        {(estado === "apagadas" || estado === "bloqueadas") && (
          <button type="button" className="btn-primary" disabled={ocupado} onClick={activar}>
            {ocupado ? "Activando…" : "Activar en este iPhone"}
          </button>
        )}
        {estado === "activas" && <div className="notif-ok">✓ Activadas en este iPhone</div>}

        {interruptor("conteoCocina", "Conteo de Cocina", "Si no se ha hecho a la hora límite")}
        {interruptor("conteoBar", "Conteo de Bar", "Si no se ha hecho a la hora límite")}
        {interruptor("alGuardar", "Al guardar un conteo", "Quién lo hizo y los productos en 0 o sin contar")}
        {interruptor("gastos", "Gastos pendientes", `Todos los días a las ${horaTexto(config.horaGastos)} si hay 1 o más`)}

        {estado === "activas" && (
          <div className="notif-botones">
            <button type="button" className="btn-secundario" disabled={ocupado} onClick={probar}>
              Mandar notificación de prueba
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={async () => {
                await apagarNotificaciones();
                setEstado(await estadoNotificaciones());
              }}
            >
              Apagar en este iPhone
            </button>
          </div>
        )}
        {aviso && <p className="puntos-aviso">{aviso}</p>}
      </div>

      <div className="notif-tarjeta">
        <h4>Hora límite de cada conteo</h4>
        <div className="notif-horas">
          <span />
          <span>Cocina</span>
          <span>Bar</span>
          {DAYS.map((dia) => (
            <div key={dia} className="notif-horas-fila">
              <b>{DIA_CORTO[dia]}</b>
              {(["cocina", "bar"] as ConteoTextoArea[]).map((area) => (
                <select key={area} className="text-input" value={config.horas[area][dia]} onChange={(e) => cambiarHora(area, dia, e.target.value)}>
                  {HORAS_CONTEO.map((h) => (
                    <option key={h} value={h}>
                      {horaTexto(h)}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          ))}
        </div>
        <label className="notif-campo">
          <span>Si sigue sin hacerse, repetir cada</span>
          <select className="text-input" value={config.repetirHoras} onChange={(e) => cambiar({ repetirHoras: Number(e.target.value) })}>
            {REPETIR.map((h) => (
              <option key={h} value={h}>
                {h} horas
              </option>
            ))}
          </select>
        </label>
        <label className="notif-campo">
          <span>Gastos pendientes a las</span>
          <select className="text-input" value={config.horaGastos} onChange={(e) => cambiar({ horaGastos: e.target.value })}>
            {HORAS.filter((h) => h >= "06:00" && h <= "22:00").map((h) => (
              <option key={h} value={h}>
                {horaTexto(h)}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">
          La hora límite es del conteo de ese día: de 12:00 am a 7:30 am es ya la madrugada siguiente (1:00 am del viernes = sábado a la 1:00 am). Se revisa cada 5 minutos, aunque la app esté cerrada.
        </p>
      </div>
    </div>
  );
}
