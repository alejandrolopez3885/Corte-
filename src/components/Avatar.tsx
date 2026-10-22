import { iniciales } from "../lib/fotos";

// Foto de perfil redonda; sin foto, las iniciales.
export function Avatar({ nombre, foto, tamano = 38 }: { nombre: string; foto?: string; tamano?: number }) {
  return (
    <span className={`avatar ${foto ? "" : "sin-foto"}`} style={{ width: tamano, height: tamano, fontSize: Math.round(tamano * 0.36) }}>
      {foto ? <img src={foto} alt={nombre} /> : iniciales(nombre)}
    </span>
  );
}
