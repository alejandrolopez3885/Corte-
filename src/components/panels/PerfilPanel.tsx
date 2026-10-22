import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Trash2 } from "lucide-react";
import { Avatar } from "../Avatar";
import { Field } from "../ui";
import { reducirFoto } from "../../lib/fotos";
import { TituloPagina } from "../BarraTitulo";

const MAX_DESCRIPCION = 200;

export interface CambiosPerfil {
  foto?: string;
  descripcion?: string;
  nombre?: string;
}

// Mi perfil. Personal: su foto y una descripción corta, que puede cambiar;
// su nombre, puesto, área y secciones solo los ve (los asigna el dueño en
// Personal). Dueño: además puede cambiar su nombre.
export function PerfilPanel({
  nombre: nombreInicial,
  nombreEditable = false,
  foto: fotoInicial,
  descripcion: descripcionInicial,
  puesto,
  area,
  secciones,
  etiquetaCuenta,
  onGuardar,
  onBack,
  backLabel = "Inicio",
  children,
}: {
  nombre: string;
  nombreEditable?: boolean;
  foto?: string;
  descripcion?: string;
  puesto?: string;
  area?: string;
  secciones: string[];
  etiquetaCuenta?: string;
  onGuardar: (cambios: CambiosPerfil) => void;
  onBack?: () => void;
  backLabel?: string;
  // Secciones extra al final (Datos para tu pago).
  children?: React.ReactNode;
}) {
  const [foto, setFoto] = useState(fotoInicial);
  const [descripcion, setDescripcion] = useState(descripcionInicial || "");
  const [nombre, setNombre] = useState(nombreInicial);
  const [eligiendo, setEligiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const cambio = foto !== fotoInicial || descripcion.trim() !== (descripcionInicial || "") || (nombreEditable && nombre.trim() !== nombreInicial);

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
      <TituloPagina titulo="Mi perfil" onBack={onBack} backLabel={backLabel} />

      <div className="perfil-foto">
        <button type="button" className="perfil-foto-btn" onClick={() => setEligiendo(true)} aria-label="Cambiar foto">
          <Avatar nombre={nombre} foto={foto} tamano={108} />
        </button>
        <button type="button" className="link-btn perfil-cambiar" onClick={() => setEligiendo(true)}>
          <Camera size={15} /> {foto ? "Cambiar foto" : "Agregar foto"}
        </button>
        {error && <p className="aviso-faltante">{error}</p>}
      </div>
      <input ref={camara} type="file" accept="image/*" capture="user" hidden onChange={elegir} />
      <input ref={galeria} type="file" accept="image/*" hidden onChange={elegir} />

      {nombreEditable && (
        <Field label="Nombre">
          <input
            className="text-input"
            value={nombre}
            placeholder="Tu nombre"
            onChange={(e) => {
              setNombre(e.target.value);
              setGuardado(false);
            }}
          />
        </Field>
      )}
      <div className="perfil-datos">
        {!nombreEditable && (
          <div className="perfil-dato">
            <span>Nombre</span>
            <strong>{nombre}</strong>
          </div>
        )}
        {/* El dueño sin persona en Personal no tiene puesto: no se muestra. */}
        {(puesto || !etiquetaCuenta) && (
          <div className="perfil-dato">
            <span>Puesto</span>
            <strong>{puesto ? `${puesto}${area ? ` · ${area}` : ""}` : "Sin puesto"}</strong>
          </div>
        )}
        {etiquetaCuenta && (
          <div className="perfil-dato">
            <span>Cuenta</span>
            <div className="perfil-secciones">
              <em>{etiquetaCuenta}</em>
            </div>
          </div>
        )}
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
          onGuardar({ foto, descripcion, ...(nombreEditable ? { nombre: nombre.trim() } : {}) });
          setGuardado(true);
        }}
      >
        {guardado && !cambio ? "Guardado ✓" : "Guardar"}
      </button>

      {children}

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
