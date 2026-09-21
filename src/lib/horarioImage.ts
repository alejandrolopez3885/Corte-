import { DAYS, DAY_SHORT } from "./types";
import type { HorarioArea, HorarioSemana } from "./types";
import { downloadCanvasAsPng } from "./imageExport";

const COL_NOMBRE = 220;
const COL_DIA = 90;
const WIDTH = COL_NOMBRE + COL_DIA * 7;

const ROW_H = 38;
const AREA_BAND_H = 32;
const TITLE_H = 64;
const COL_HEADER_H = 36;

const AREA_COLORS = ["#8BC34A", "#F39C12", "#26A69A", "#5C6BC0", "#EC7063", "#AF7AC5"];
const NEGRO = "#111111";
const DIA_BG = "#F1F8E9";

// Genera y descarga una imagen PNG con el horario semanal, agrupado por
// área — igual estructura que la hoja de cálculo que se usaba antes para
// esto. `soloAreaId` limita la imagen a una sola área (ej. para el jefe
// de cocina); sin eso, incluye todas las áreas con personal capturado.
export function downloadHorarioImage(semana: HorarioSemana, titulo: string, subtitulo: string, soloAreaId?: string): void {
  const grupos: HorarioArea[] = semana.areas.filter((a) => (!soloAreaId || a.id === soloAreaId) && a.filas.length > 0);
  if (grupos.length === 0) return;

  const height = TITLE_H + grupos.reduce((s, g) => s + AREA_BAND_H + COL_HEADER_H + g.filas.length * ROW_H, 0);

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);

  let y = 0;

  // Título
  ctx.fillStyle = NEGRO;
  ctx.fillRect(0, y, WIDTH, TITLE_H);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(titulo, WIDTH / 2, y + TITLE_H / 2 - 10);
  ctx.font = "13px Arial";
  ctx.fillStyle = "#cccccc";
  ctx.fillText(subtitulo, WIDTH / 2, y + TITLE_H / 2 + 14);
  y += TITLE_H;

  grupos.forEach((g, gi) => {
    const color = AREA_COLORS[gi % AREA_COLORS.length];

    // Banda del área
    ctx.fillStyle = color;
    ctx.fillRect(0, y, WIDTH, AREA_BAND_H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(g.nombre.toUpperCase(), 12, y + AREA_BAND_H / 2);
    y += AREA_BAND_H;

    // Encabezado de columnas
    ctx.fillStyle = NEGRO;
    ctx.fillRect(0, y, WIDTH, COL_HEADER_H);
    let x = 0;
    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText("NOMBRES", x + 12, y + COL_HEADER_H / 2);
    x += COL_NOMBRE;
    ctx.textAlign = "center";
    DAYS.forEach((d) => {
      ctx.fillText(DAY_SHORT[d].toUpperCase(), x + COL_DIA / 2, y + COL_HEADER_H / 2);
      x += COL_DIA;
    });
    y += COL_HEADER_H;

    // Filas de personal
    g.filas.forEach((fila, fi) => {
      const rowBg = fi % 2 === 0 ? "#ffffff" : "#fafafa";
      ctx.fillStyle = rowBg;
      ctx.fillRect(0, y, WIDTH, ROW_H);
      ctx.fillStyle = DIA_BG;
      ctx.fillRect(COL_NOMBRE, y, COL_DIA * 7, ROW_H);

      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText(fila.nombre, 12, y + ROW_H / 2);

      let cx = COL_NOMBRE;
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      DAYS.forEach((d) => {
        const valor = fila.valores[d] || "";
        ctx.fillStyle = valor ? "#1a1a1a" : "#bbbbbb";
        ctx.fillText(valor || "–", cx + COL_DIA / 2, y + ROW_H / 2);
        cx += COL_DIA;
      });

      y += ROW_H;
    });
  });

  downloadCanvasAsPng(canvas, titulo);
}
