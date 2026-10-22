import { useState } from "react";
import { Field } from "./ui";
import {
  BANCOS,
  conEspacios,
  guardarMisDatosPago,
  revisarNumero,
  soloDigitos,
  tapado,
  tipoNumero,
  useMisDatosPago,
} from "../lib/datosPago";
import type { Profile } from "../lib/types";

// Mi perfil > Datos para tu pago (cuentas de equipo): banco, número de
// tarjeta o CLABE y a nombre de quién, con la casilla de que son correctos.
// Ya guardados se ven tapados; solo el dueño los ve completos.
export function DatosPagoSeccion({ profile, nombre }: { profile: Profile; nombre: string }) {
  const { datos, setDatos, estado } = useMisDatosPago(profile.id);
  const [editando, setEditando] = useState(false);
  const [banco, setBanco] = useState("");
  const [numero, setNumero] = useState("");
  const [titular, setTitular] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (estado === "cargando") return null;
  if (estado === "sin-tabla") {
    return (
      <div className="pago-seccion">
        <h3>Datos para tu pago</h3>
        <p className="hint">Esta sección todavía no está activa. Pídele al dueño que la active.</p>
      </div>
    );
  }

  const abrir = () => {
    setBanco(datos?.banco || "");
    setNumero(datos ? conEspacios(datos.numero) : "");
    setTitular(datos?.titular || nombre);
    setConfirmo(false);
    setIntento(false);
    setError(null);
    setEditando(true);
  };

  if (!editando && datos) {
    const fecha = new Date(datos.confirmado_en).toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "");
    return (
      <div className="pago-seccion">
        <h3>Datos para tu pago</h3>
        <div className="pago-resumen">
          <div>
            <strong>
              {datos.banco} · {tapado(datos.numero)}
            </strong>
            <small>
              {tipoNumero(datos.numero)} · confirmado el {fecha}
            </small>
          </div>
          <button type="button" className="link-btn" onClick={abrir}>
            Cambiar
          </button>
        </div>
        <p className="hint">Si cambias de banco o de tarjeta, actualízalo aquí antes del día de pago.</p>
      </div>
    );
  }

  if (!editando) {
    return (
      <div className="pago-seccion">
        <h3>Datos para tu pago</h3>
        <p className="hint">Para que te depositen tu nómina. Solo los ve el dueño.</p>
        <button type="button" className="btn-secundario" onClick={abrir}>
          Agregar mis datos de pago
        </button>
      </div>
    );
  }

  const errorNumero = revisarNumero(numero);
  const digitos = soloDigitos(numero).length;
  const falta = !banco ? "Elige tu banco." : errorNumero || (!titular.trim() ? "Escribe a nombre de quién está." : !confirmo ? "Confirma que tus datos son correctos." : null);

  return (
    <div className="pago-seccion">
      <h3>Datos para tu pago</h3>
      <p className="hint">Para que te depositen tu nómina. Solo los ve el dueño. Nunca se pide tu NIP, CVV ni fecha de vencimiento.</p>
      <Field label="Banco">
        <select className="text-input" value={banco} onChange={(e) => setBanco(e.target.value)}>
          <option value="">Elige tu banco</option>
          {BANCOS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Número de tarjeta o CLABE">
        <div className="pago-numero">
          <input
            className="text-input"
            inputMode="numeric"
            autoComplete="off"
            value={numero}
            placeholder="16 dígitos (tarjeta) o 18 (CLABE)"
            onChange={(e) => setNumero(conEspacios(soloDigitos(e.target.value).slice(0, 18)))}
          />
          {digitos > 0 && <span className={errorNumero ? "mal" : "bien"}>{errorNumero ? `${digitos} dígitos` : `✓ ${tipoNumero(soloDigitos(numero))}`}</span>}
        </div>
      </Field>
      {digitos >= 16 && errorNumero && <p className="aviso-faltante">{errorNumero}</p>}
      <Field label="A nombre de">
        <input className="text-input" value={titular} onChange={(e) => setTitular(e.target.value)} placeholder="Como aparece en tu banco" />
      </Field>
      <label className="pago-confirmo">
        <input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
        <span>Confirmo que estos datos son correctos y son míos</span>
      </label>
      {intento && falta && !(falta === errorNumero && digitos >= 16) && <p className="aviso-faltante">{falta}</p>}
      {error && <p className="aviso-faltante">{error}</p>}
      <button
        className="btn-primary"
        disabled={guardando}
        onClick={async () => {
          setIntento(true);
          if (falta) return;
          setGuardando(true);
          const r = await guardarMisDatosPago(profile, datos, { banco, numero, titular });
          setGuardando(false);
          if (r.error) return setError(r.error);
          setDatos(r.datos || null);
          setEditando(false);
        }}
      >
        {guardando ? "Guardando…" : "Guardar datos de pago"}
      </button>
      {datos && (
        <button type="button" className="link-btn" onClick={() => setEditando(false)}>
          Cancelar
        </button>
      )}
    </div>
  );
}
