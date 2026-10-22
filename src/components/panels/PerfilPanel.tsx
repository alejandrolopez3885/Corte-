import { useRef, useState } from "react";
import { ArrowLeft, Camera, Image as ImageIcon, Trash2 } from "lucide-react";
import { Avatar } from "../Avatar";
import { Field } from "../ui";
import { reducirFoto } from "../../lib/fotos";
import type { EmpleadoEntry } from "../../lib/types";

const MAX_DESCRIPCION = 200;

// Mi perfil (cuentas de equipo): su foto y una descripción corta, que puede
// cambiar; su nombre, puesto, área y secciones solo los ve (los asigna el
// dueño en Personal).
export function PerfilPanel({
  empleado,
  puesto,
  area,
  secciones,
  onGuardar,
  onBack,
}: {
  empleado: EmpleadoEntry;
  puesto?: string;
  area?: string;
  secciones: string[];
  onGuardar: (cambios: { foto?: string; descripcion?: string }) => void;
  onBack?: () => void;
}) {
  const [foto, setFoto] = useState(empleado.foto);
  const [descripcion, setDescripcion] = useState(empleado.descripcion || "");
  const [eligiendo, setEligiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const cambio = foto !== empleado.foto || descripcion.trim() !== (empleado.descripcion || "");

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    setEligiendo(false);
    if (!archivo) return;
    try {
      setFoto(await reducirFoto(archivo));
      setError(null);
      setGuardado(false);
    } catch {
      setError("No se pudo usar esa imagen. Prueba con otra.");
    }
  }

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> Inicio
        </button>
      )}
      <h2 className="page-title">Mi perfil</h2>

      <div className="perfil-foto">
        <button type="button" className="perfil-foto-btn" onClick={() => setEligiendo(true)} aria-label="Cambiar foto">
          <Avatar nombre={empleado.nombre} foto={foto} tamano={108} />
        </button>
        <button type="button" className="link-btn perfil-cambiar" onClick={() => setEligiendo(true)}>
          <Camera size={15} /> {foto ? "Cambiar foto" : "Agregar foto"}
        </button>
        {error && <p className="aviso-faltante">{error}</p>}
      </div>
      <input ref={camara} type="file" accept="image/*" capture="user" hidden onChange={elegir} />
      <input ref={galeria} type="file" accept="image/*" hidden onChange={elegir} />

      <div className="perfil-datos">
        <div className="perfil-dato">
          <span>Nombre</span>
          <strong>{empleado.nombre}</strong>
        </div>
        <div className="perfil-dato">
          <span>Puesto</span>
          <strong>{puesto ? `${puesto}${area ? ` · ${area}` : ""}` : "Sin puesto"}</strong>
        </div>
        {secciones.length > 0 && (
          <div className="perfil-dato">
            <span>Tus secciones</span>
            <div className="perfil-secciones">
              {secciones.map((s) => (
                <em key={s}>{s}</em>
              ))}
            </div>
          </div>
        )}
      </div>

      <Field label="Descripción">
        <textarea
          className="text-input perfil-descripcion"
          value={descripcion}
          maxLength={MAX_DESCRIPCION}
          rows={3}
          placeholder="Algo sobre ti, ej. lo que más te gusta preparar"
          onChange={(e) => {
            setDescripcion(e.target.value);
            setGuardado(false);
          }}
        />
      </Field>
      <span className="hint perfil-contador">
        {descripcion.length}/{MAX_DESCRIPCION}
      </span>

      <button
        className="btn-primary"
        disabled={!cambio}
        onClick={() => {
          onGuardar({ foto, descripcion });
          setGuardado(true);
        }}
      >
        {guardado && !cambio ? "Guardado ✓" : "Guardar"}
      </button>

      {eligiendo && (
        <div className="sheet-backdrop" onClick={() => setEligiendo(false)}>
          <div className="sheet perfil-opciones" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <button type="button" onClick={() => camara.current?.click()}>
              <Camera size={18} /> Tomar foto
            </button>
            <button type="button" onClick={() => galeria.current?.click()}>
              <ImageIcon size={18} /> Elegir de la galería
            </button>
            {foto && (
              <button
                type="button"
                className="quitar"
                onClick={() => {
                  setFoto(undefined);
                  setEligiendo(false);
                  setGuardado(false);
                }}
              >
                <Trash2 size={18} /> Quitar foto
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
