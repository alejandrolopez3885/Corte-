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
