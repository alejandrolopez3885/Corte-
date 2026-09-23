import type { DashboardReport } from "./dataModel";
import { META_GASTOS_OPERATIVOS_PCT, money } from "./dataModel";
import { downloadCanvasAsPng } from "./imageExport";

const WIDTH = 460;
const ROW_H = 40;
const TITLE_H = 64;
const TOTAL_H = 56;
const FOOTNOTE_H = 24;

const NEGRO = "#111111";
const VERDE = "#2E7D53";
const VERDE_SUAVE = "#DCEEDF";
const ROJO = "#A23B2E";
const ROJO_SUAVE = "#F3DEDA";
const GRIS_TEXTO = "#1a1a1a";
const GRIS_LABEL = "#5b5b5b";

type Color = "neutral" | "good" | "bad";

interface Row {
  label: string;
  pct: number;
  amount: number;
  color: Color;
}

function colorFor(pct: number, meta: number): Color {
  return pct <= meta ? "good" : "bad";
}

// Genera y descarga una imagen PNG con el reporte del Dashboard (venta,
// gastos y utilidad de la semana) — pensada para compartir el resultado
// de la sucursal por WhatsApp, igual que las imágenes de Horarios y
// Nómina. El gasto operativo se pinta en verde si está en la meta (42% o
// menos de la venta) o en rojo si se pasó; la Utilidad se pinta en verde
// si es positiva o en rojo si no. El resto de las filas queda en un color
// neutro — son informativas, no tienen una meta buena/mala definida.
export function downloadDashboardImage(report: DashboardReport, titulo: string, subtitulo: string): void {
  const rows: Row[] = [
    { label: "Venta total", pct: report.pct.ventaTotal, amount: report.ventaTotal, color: "neutral" },
    { label: "Gastos operativos", pct: report.pct.gastosOperativos, amount: report.gastosOperativos, color: colorFor(report.pct.gastosOperativos, META_GASTOS_OPERATIVOS_PCT) },
    { label: "Gastos fijos", pct: report.pct.gastosFijos, amount: report.gastosFijos, color: "neutral" },
    { label: "Comisiones de apps", pct: report.pct.comisionesApps, amount: report.comisionesApps, color: "neutral" },
    { label: "Comisión bancaria (3% de tarjetas)", pct: report.pct.comisionTarjetas, amount: report.comisionTarjetas, color: "neutral" },
    ...report.otrosCategorias.filter((c) => c.total > 0).map((c) => ({ label: c.label, pct: c.pct, amount: c.total, color: "neutral" as Color })),
    { label: "Nómina (hasta hoy)", pct: report.pct.nomina, amount: report.nomina, color: "neutral" },
  ];

  const utilidadColor: Color = report.utilidad > 0 ? "good" : "bad";
  const height = TITLE_H + rows.length * ROW_H + TOTAL_H + FOOTNOTE_H;

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
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(titulo, WIDTH / 2, y + TITLE_H / 2 - 10);
  ctx.font = "13px Arial";
  ctx.fillStyle = "#cccccc";
  ctx.fillText(subtitulo, WIDTH / 2, y + TITLE_H / 2 + 14);
  y += TITLE_H;

  // Filas
  rows.forEach((r, i) => {
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#fafafa";
    ctx.fillRect(0, y, WIDTH, ROW_H);

    const textColor = r.color === "good" ? VERDE : r.color === "bad" ? ROJO : GRIS_TEXTO;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "13px Arial";
    ctx.fillStyle = GRIS_LABEL;
    ctx.fillText(r.label, 14, y + ROW_H / 2);

    ctx.textAlign = "right";
    ctx.font = r.color === "neutral" ? "12px Arial" : "bold 12px Arial";
    ctx.fillStyle = textColor;
    ctx.fillText(`${r.pct}%`, WIDTH - 116, y + ROW_H / 2);

    ctx.font = r.color === "neutral" ? "bold 13px Arial" : "bold 14px Arial";
    ctx.fillText(money(r.amount), WIDTH - 14, y + ROW_H / 2);

    y += ROW_H;
  });

  // Utilidad — banda destacada verde/roja
  ctx.fillStyle = utilidadColor === "good" ? VERDE_SUAVE : ROJO_SUAVE;
  ctx.fillRect(0, y, WIDTH, TOTAL_H);
  const utilidadColorHex = utilidadColor === "good" ? VERDE : ROJO;
  ctx.textAlign = "left";
  ctx.font = "bold 15px Arial";
  ctx.fillStyle = utilidadColorHex;
  ctx.fillText("UTILIDAD", 14, y + TOTAL_H / 2);
  ctx.textAlign = "right";
  ctx.font = "13px Arial";
  ctx.fillText(`${report.pct.utilidad}%`, WIDTH - 116, y + TOTAL_H / 2);
  ctx.font = "bold 18px Arial";
  ctx.fillText(money(report.utilidad), WIDTH - 14, y + TOTAL_H / 2);
  y += TOTAL_H;

  // Nota de la meta
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, y, WIDTH, FOOTNOTE_H);
  ctx.fillStyle = "#777777";
  ctx.font = "italic 10.5px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Meta de gastos operativos: ${META_GASTOS_OPERATIVOS_PCT}% o menos de la venta`, 14, y + FOOTNOTE_H / 2);

  downloadCanvasAsPng(canvas, titulo);
}
