// Copia un <canvas> ya dibujado al portapapeles como PNG, para pegarlo
// directo en WhatsApp. El ClipboardItem recibe la promesa del blob (no el
// blob ya resuelto) para que Safari lo acepte dentro del mismo toque del
// usuario. Si el navegador no permite copiar imágenes, cae a descargar el
// PNG como antes — devuelve true si se copió, false si se descargó.
export async function copyCanvasAsPng(canvas: HTMLCanvasElement, titulo: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Sin portapapeles de imágenes");
    const blob = new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/png")
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    downloadCanvasAsPng(canvas, titulo);
    return false;
  }
}

// Descarga un <canvas> ya dibujado como PNG — usado por nominaImage.ts y
// horarioImage.ts, que solo difieren en qué dibujan sobre el canvas.
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, titulo: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/[^\wÀ-ÿ .-]/g, "")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}
