import type { DashboardReport } from "./dataModel";
import { META_GASTOS_OPERATIVOS_PCT, money, round2 } from "./dataModel";
import { copyCanvasAsPng } from "./imageExport";

// Imagen del resultado semanal para mandar al grupo del jefe: se lee como una
// cuenta, de la venta a la utilidad después del retiro.
//
//   Venta semanal
//   − Gastos operativos      (verde si está en la meta, rojo si se pasó)
//   − Nómina
//   = Margen operativo
//   − Otros gastos           (fijos, comisiones de apps y banco, otras categorías)
//   = Utilidad antes de retiro
//   − Retiro
//   = Utilidad después de retiro   (la misma "Utilidad" del Dashboard)

const NOMBRE_NEGOCIO = "Metroplex";
const WIDTH = 460;
const PAD = 20;

const NEGRO = "#111111";
const TEXTO = "#333333";
const SUAVE = "#888888";
const VERDE = "#2E7D53";
const VERDE_SUAVE = "#DCEEDF";
const ACENTO = "#1F5D4C";
const ACENTO_SUAVE = "#EEF3EC";
const ROJO = "#A23B2E";
const ROJO_SUAVE = "#F3DEDA";

export interface ResultadoSemanal {
  venta: number;
  ventaSemanaPasada: number | null;
  gastosOperativos: number;
  nomina: number;
  margen: number;
  otros: number;
  otrosDesglose: { label: string; monto: number }[];
  antesDeRetiro: number;
  retiro: number;
  despuesDeRetiro: number;
}

export function resultadoSemanal(report: DashboardReport, ventaSemanaPasada: number | null): ResultadoSemanal {
  const retiro = report.otrosCategorias.find((c) => c.key === "retiro")?.total || 0;
  const otrasCategorias = round2(
    report.otrosCategorias.filter((c) => c.key !== "nomina" && c.key !== "retiro").reduce((s, c) => s + c.total, 0)
  );
  const margen = round2(report.ventaTotal - report.gastosOperativos - report.nomina);
  const antesDeRetiro = round2(report.utilidad + retiro);
  return {
    venta: report.ventaTotal,
    ventaSemanaPasada,
    gastosOperativos: report.gastosOperativos,
    nomina: report.nomina,
    margen,
    otros: round2(margen - antesDeRetiro),
    otrosDesglose: [
      { label: "Fijos", monto: report.gastosFijos },
      { label: "Comisiones apps", monto: report.comisionesApps },
      { label: "Banco", monto: report.comisionTarjetas },
      { label: "Otros", monto: otrasCategorias },
    ].filter((x) => x.monto > 0),
    antesDeRetiro,
    retiro,
    despuesDeRetiro: report.utilidad,
  };
}

const sinCentavos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

// Parte un texto en renglones que quepan en `ancho`.
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const out: string[] = [];
  let actual = "";
  texto.split(" ").forEach((p) => {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && actual) {
      out.push(actual);
      actual = p;
    } else actual = prueba;
  });
  if (actual) out.push(actual);
  return out;
}

type Tipo = "resta" | "subtotal" | "final";
interface Fila {
  tipo: Tipo;
  label: string;
  nota?: string;
  monto: number;
  colorPct?: string;
}

// Dibuja la imagen y la copia al portapapeles (o la descarga si el
// navegador no deja): true si se copió.
export function copyDashboardImage(r: ResultadoSemanal, subtitulo: string, nota: string): Promise<boolean> {
  const pct = (n: number) => (r.venta > 0 ? `${Math.round((n / r.venta) * 100)}%` : "—");
  const enMeta = r.venta > 0 && (r.gastosOperativos / r.venta) * 100 <= META_GASTOS_OPERATIVOS_PCT;
  const filas: Fila[] = [
    { tipo: "resta", label: "Gastos operativos", nota: `Meta: ${META_GASTOS_OPERATIVOS_PCT}% o menos`, monto: r.gastosOperativos, colorPct: enMeta ? VERDE : ROJO },
    { tipo: "resta", label: "Nómina", monto: r.nomina },
    { tipo: "subtotal", label: "Margen operativo", nota: "Venta − gastos operativos − nómina", monto: r.margen },
    { tipo: "resta", label: "Otros gastos", nota: r.otrosDesglose.map((x) => `${x.label} ${sinCentavos(x.monto)}`).join(" · "), monto: r.otros },
    { tipo: "subtotal", label: "Utilidad antes de retiro", monto: r.antesDeRetiro },
    { tipo: "resta", label: "Retiro", monto: r.retiro },
    { tipo: "final", label: "Utilidad después de retiro", monto: r.despuesDeRetiro },
  ];

  const scale = 2;
  const canvas = document.createElement("canvas");
  const medir = canvas.getContext("2d")!;
  const anchoLabel = WIDTH - PAD * 2 - 190;
  // Alto de cada fila según cuántos renglones ocupa su nota.
  const notas = filas.map((f) => {
    if (!f.nota) return [];
    medir.font = "11px Arial";
    return renglones(medir, f.nota, anchoLabel);
  });
  const altoFila = (f: Fila, i: number) => (f.tipo === "final" ? 64 : 44) + notas[i].length * 14 - (notas[i].length ? 6 : 0);
  const HEAD = 92;
  const VENTA = r.ventaSemanaPasada !== null ? 104 : 84;
  const PIE = 30;
  const height = HEAD + VENTA + filas.reduce((s, f, i) => s + altoFila(f, i), 0) + PIE;

  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = "alphabetic";

  // Encabezado
  ctx.fillStyle = NEGRO;
  ctx.fillRect(0, 0, WIDTH, HEAD);
  ctx.textAlign = "left";
  ctx.fillStyle = "#bbbbbb";
  ctx.font = "12px Arial";
  ctx.fillText("RESULTADO SEMANAL", PAD, 28);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.fillText(NOMBRE_NEGOCIO, PAD, 54);
  ctx.fillStyle = "#cccccc";
  ctx.font = "13px Arial";
  ctx.fillText(subtitulo, PAD, 76);
  let y = HEAD;

  // Venta semanal
  ctx.fillStyle = "#666666";
  ctx.font = "12px Arial";
  ctx.fillText("VENTA SEMANAL", PAD, y + 26);
  ctx.fillStyle = NEGRO;
  ctx.font = "bold 32px Arial";
  ctx.fillText(money(r.venta), PAD, y + 62);
  if (r.ventaSemanaPasada !== null) {
    const cambio = r.ventaSemanaPasada > 0 ? Math.round(((r.venta - r.ventaSemanaPasada) / r.ventaSemanaPasada) * 100) : null;
    ctx.font = "bold 12.5px Arial";
    ctx.fillStyle = cambio !== null && cambio < 0 ? ROJO : VERDE;
    ctx.fillText(
      cambio === null
        ? `Semana pasada: ${money(r.ventaSemanaPasada)}`
        : `${cambio < 0 ? "▼" : "▲"} ${Math.abs(cambio)}% vs. semana pasada (${money(r.ventaSemanaPasada)})`,
      PAD,
      y + 84
    );
  }
  y += VENTA;
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(0, y - 1, WIDTH, 1);

  // Filas
  filas.forEach((f, i) => {
    const h = altoFila(f, i);
    const final = f.tipo === "final";
    const positivo = f.monto >= 0;
    if (f.tipo === "subtotal") ctx.fillStyle = ACENTO_SUAVE;
    else if (final) ctx.fillStyle = positivo ? VERDE_SUAVE : ROJO_SUAVE;
    else ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, y, WIDTH, h);
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, y + h - 1, WIDTH, 1);

    const colorFuerte = final ? (positivo ? VERDE : ROJO) : f.tipo === "subtotal" ? ACENTO : NEGRO;
    const base = y + (final ? 38 : 27) - (notas[i].length ? 6 : 0);

    // Etiqueta y nota
    ctx.textAlign = "left";
    ctx.fillStyle = f.tipo === "resta" ? TEXTO : colorFuerte;
    ctx.font = final ? "bold 15px Arial" : f.tipo === "subtotal" ? "bold 14px Arial" : "14px Arial";
    ctx.fillText(final ? f.label.toUpperCase() : f.label, PAD, base);
    ctx.font = "11px Arial";
    ctx.fillStyle = f.tipo === "subtotal" ? "#5b7d70" : SUAVE;
    notas[i].forEach((linea, k) => ctx.fillText(linea, PAD, base + 15 + k * 14));

    // % y monto
    const medio = y + h / 2 + 5;
    ctx.textAlign = "right";
    ctx.font = f.tipo === "resta" && !f.colorPct ? "12.5px Arial" : "bold 12.5px Arial";
    ctx.fillStyle = f.colorPct || (f.tipo === "resta" ? "#666666" : colorFuerte);
    ctx.fillText(pct(f.monto), WIDTH - PAD - (final ? 150 : 130), medio);
    ctx.font = final ? "bold 22px Arial" : f.tipo === "subtotal" ? "bold 15px Arial" : "bold 14px Arial";
    ctx.fillStyle = colorFuerte;
    const monto = money(f.monto);
    ctx.fillText(monto, WIDTH - PAD, medio + (final ? 3 : 0));
    if (f.tipo === "resta") {
      const ancho = ctx.measureText(monto).width;
      ctx.font = "14px Arial";
      ctx.fillStyle = "#999999";
      ctx.fillText("− ", WIDTH - PAD - ancho, medio);
    }
    y += h;
  });

  // Pie
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, y, WIDTH, PIE);
  ctx.textAlign = "left";
  ctx.fillStyle = SUAVE;
  ctx.font = "italic 10.5px Arial";
  ctx.fillText(nota, PAD, y + 19);

  return copyCanvasAsPng(canvas, `Resultado ${NOMBRE_NEGOCIO} ${subtitulo}`);
}
