import { DAYS, DAY_SHORT } from "./types";
import type { NominaEmpleadoSemana } from "./types";
import { money } from "./dataModel";

const COL_NOMBRE = 210;
const COL_BASE = 110;
const COL_XDIA = 95;
const COL_DIAS = 95;
const COL_DIA = 58;
const COL_TOTAL = 120;
const WIDTH = COL_NOMBRE + COL_BASE + COL_XDIA + COL_DIAS + COL_DIA * 7 + COL_TOTAL;

const ROW_H = 38;
const AREA_BAND_H = 32;
const SUBTOTAL_H = 32;
const TITLE_H = 64;
const COL_HEADER_H = 40;
const TOTAL_H = 50;
const FOOTNOTE_H = 26;

const AREA_COLORS = ["#8BC34A", "#F39C12", "#26A69A", "#5C6BC0", "#EC7063", "#AF7AC5"];
const NEGRO = "#111111";
const AMARILLO = "#FFD400";
const NARANJA = "#F2994A";
const SUBTOTAL_BG = "#C5E1A5";
const DIA_BG = "#F1F8E9";

// Agrupa por areaNombre respetando el orden en que aparece cada área por
// primera vez en el reporte (no se reordena alfabéticamente).
function agruparPorArea(reporte: NominaEmpleadoSemana[]): { nombre: string; empleados: NominaEmpleadoSemana[] }[] {
  const grupos: { nombre: string; empleados: NominaEmpleadoSemana[] }[] = [];
  reporte.forEach((e) => {
    let g = grupos.find((g) => g.nombre === e.areaNombre);
    if (!g) {
      g = { nombre: e.areaNombre, empleados: [] };
      grupos.push(g);
    }
    g.empleados.push(e);
  });
  return grupos;
}

// Genera y descarga una imagen PNG con el desglose de nómina de la
// semana sin descuentos (bruto + percepciones extra, como finiquitos o
// bonos, si hay), agrupado por área con subtotales — pensado para
// compartir por WhatsApp con quien paga, igual que la hoja de cálculo
// que se usaba antes para esto.
export function downloadNominaImage(reporte: NominaEmpleadoSemana[], titulo: string, subtitulo: string): void {
  const grupos = agruparPorArea(reporte);
  const hayExtras = reporte.some((e) => e.totalExtras > 0);
  const height =
    TITLE_H +
    COL_HEADER_H +
    grupos.reduce((s, g) => s + AREA_BAND_H + g.empleados.length * ROW_H + SUBTOTAL_H, 0) +
    TOTAL_H +
    (hayExtras ? FOOTNOTE_H : 0);

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

  // Encabezado de columnas
  ctx.fillStyle = NEGRO;
  ctx.fillRect(0, y, WIDTH, COL_HEADER_H);
  let x = 0;
  ctx.font = "bold 12px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText("NOMBRE", x + 12, y + COL_HEADER_H / 2);
  x += COL_NOMBRE;
  ctx.textAlign = "center";
  ctx.fillStyle = AMARILLO;
  ctx.fillText("SUELDO BASE", x + COL_BASE / 2, y + COL_HEADER_H / 2);
  x += COL_BASE;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("X DÍA", x + COL_XDIA / 2, y + COL_HEADER_H / 2);
  x += COL_XDIA;
  ctx.fillText("DÍAS PAGADOS", x + COL_DIAS / 2, y + COL_HEADER_H / 2);
  x += COL_DIAS;
  DAYS.forEach((d) => {
    ctx.fillText(DAY_SHORT[d].toUpperCase(), x + COL_DIA / 2, y + COL_HEADER_H / 2);
    x += COL_DIA;
  });
  ctx.fillStyle = NARANJA;
  ctx.fillRect(x, y, COL_TOTAL, COL_HEADER_H);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("TOTAL SEMANA", x + COL_TOTAL / 2, y + COL_HEADER_H / 2);
  y += COL_HEADER_H;

  let granTotal = 0;

  grupos.forEach((g, gi) => {
    const color = AREA_COLORS[gi % AREA_COLORS.length];
    const subtotalArea = g.empleados.reduce((s, e) => s + e.bruto + e.totalExtras, 0);
    granTotal += subtotalArea;

    // Banda del área
    ctx.fillStyle = color;
    ctx.fillRect(0, y, WIDTH, AREA_BAND_H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "left";
    ctx.fillText(g.nombre.toUpperCase(), 12, y + AREA_BAND_H / 2);
    y += AREA_BAND_H;

    // Filas de empleados
    g.empleados.forEach((e, ei) => {
      const rowBg = ei % 2 === 0 ? "#ffffff" : "#fafafa";
      ctx.fillStyle = rowBg;
      ctx.fillRect(0, y, WIDTH, ROW_H);
      ctx.fillStyle = DIA_BG;
      ctx.fillRect(COL_NOMBRE + COL_BASE + COL_XDIA + COL_DIAS, y, COL_DIA * 7, ROW_H);

      let cx = 0;
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText(e.nombre + (e.totalExtras > 0 ? " *" : ""), cx + 12, y + ROW_H / 2);
      cx += COL_NOMBRE;

      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(money(e.sueldoDiario * 7), cx + COL_BASE / 2, y + ROW_H / 2);
      cx += COL_BASE;
      ctx.fillText(money(e.sueldoDiario), cx + COL_XDIA / 2, y + ROW_H / 2);
      cx += COL_XDIA;
      const diasPagados = e.dias.reduce((s, d) => s + d.multiplicador, 0);
      ctx.fillText(String(diasPagados), cx + COL_DIAS / 2, y + ROW_H / 2);
      cx += COL_DIAS;

      e.dias.forEach((d) => {
        if (d.multiplicador > 0) ctx.fillText(String(d.multiplicador), cx + COL_DIA / 2, y + ROW_H / 2);
        cx += COL_DIA;
      });

      ctx.font = "bold 12px Arial";
      ctx.fillText(money(e.bruto + e.totalExtras), cx + COL_TOTAL / 2, y + ROW_H / 2);

      y += ROW_H;
    });

    // Subtotal del área
    ctx.fillStyle = SUBTOTAL_BG;
    ctx.fillRect(0, y, WIDTH, SUBTOTAL_H);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`SUBTOTAL ${g.nombre.toUpperCase()}`, WIDTH - COL_TOTAL - 12, y + SUBTOTAL_H / 2);
    ctx.textAlign = "center";
    ctx.fillText(money(subtotalArea), WIDTH - COL_TOTAL / 2, y + SUBTOTAL_H / 2);
    y += SUBTOTAL_H;
  });

  // Total general
  ctx.fillStyle = NEGRO;
  ctx.fillRect(0, y, WIDTH, TOTAL_H);
  ctx.fillStyle = AMARILLO;
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "left";
  ctx.fillText("TOTAL NÓMINA SEMANAL", 12, y + TOTAL_H / 2);
  ctx.fillStyle = NARANJA;
  ctx.fillRect(WIDTH - COL_TOTAL, y, COL_TOTAL, TOTAL_H);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(money(granTotal), WIDTH - COL_TOTAL / 2, y + TOTAL_H / 2);
  y += TOTAL_H;

  if (hayExtras) {
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, y, WIDTH, FOOTNOTE_H);
    ctx.fillStyle = "#666666";
    ctx.font = "italic 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText("* incluye percepciones extra de esta semana (finiquito, bono)", 12, y + FOOTNOTE_H / 2);
  }

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
