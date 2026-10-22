// Foto de perfil: se recorta al centro en cuadro y se reduce a 192 px en
// JPEG (~10 KB), para guardarla dentro de los datos sin pesar.
export const TAMANO_FOTO = 192;

export function reducirFoto(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = TAMANO_FOTO;
      canvas.height = TAMANO_FOTO;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Sin canvas"));
      ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, TAMANO_FOTO, TAMANO_FOTO);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

// "Luis Pérez" → "LP"; "Aldair" → "AL".
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
