import type { DashboardReport } from "./dataModel";
import { META_GASTOS_OPERATIVOS_PCT, META_MARGEN_OPERATIVO_PCT, META_NOMINA_PCT, TOLERANCIA_AMARILLO_PCT, money, round2 } from "./dataModel";
import { copyCanvasAsPng } from "./imageExport";

// Imagen del resultado semanal para mandar al grupo del jefe, con la misma
// cuenta que la app de ellos: se lee de la venta a la utilidad.
//
//   Venta semanal
//   − Gastos operativos      (meta: 42% o menos)
//   − Nómina                 (meta: 16% o menos)
//   − Otros gastos           (fijos, comisiones de apps y banco, otras categorías)
//   = Utilidad operativa ($) y Margen operativo (%, meta: 15% o más)
//   − Retiro                 (los "gastos externos": no operativos)
//   = Utilidad después de retiro   (la misma "Utilidad" del Dashboard)
//
// Semáforo: verde en la meta, amarillo cerca (a 3 puntos o menos), rojo
// fuera.

const NOMBRE_NEGOCIO = "Metroplex";
const WIDTH = 460;
const PAD = 20;

const NEGRO = "#111111";
const TEXTO = "#333333";
const SUAVE = "#888888";
const VERDE = "#2E7D53";
const VERDE_SUAVE = "#DCEEDF";
const AMARILLO = "#B8752D";
const ACENTO = "#1F5D4C";
const ACENTO_SUAVE = "#EEF3EC";
const ROJO = "#A23B2E";
const ROJO_SUAVE = "#F3DEDA";

export interface ResultadoSemanal {
  venta: number;
  ventaSemanaPasada: number | null;
  gastosOperativos: number;
  nomina: number;
  otros: number;
  otrosDesglose: { label: string; monto: number }[];
  utilidadOperativa: number;
  retiro: number;
  despuesDeRetiro: number;
}

export function resultadoSemanal(report: DashboardReport, ventaSemanaPasada: number | null): ResultadoSemanal {
  const retiro = report.otrosCategorias.find((c) => c.key === "retiro")?.total || 0;
  const otrasCategorias = round2(
    report.otrosCategorias.filter((c) => c.key !== "nomina" && c.key !== "retiro").reduce((s, c) => s + c.total, 0)
  );
  // Utilidad operativa = venta − todos los gastos menos el retiro.
  const utilidadOperativa = round2(report.utilidad + retiro);
  return {
    venta: report.ventaTotal,
    ventaSemanaPasada,
    gastosOperativos: report.gastosOperativos,
    nomina: report.nomina,
    otros: round2(report.ventaTotal - report.gastosOperativos - report.nomina - utilidadOperativa),
    otrosDesglose: [
      { label: "Fijos", monto: report.gastosFijos },
      { label: "Comisiones apps", monto: report.comisionesApps },
      { label: "Banco", monto: report.comisionTarjetas },
      { label: "Otros", monto: otrasCategorias },
    ].filter((x) => x.monto > 0),
    utilidadOperativa,
    retiro,
    despuesDeRetiro: report.utilidad,
  };
}

// Verde en la meta, amarillo a 3 puntos o menos, rojo fuera. `maximo`: la
// meta es un tope (gastos, nómina); si no, es un mínimo (margen).
function semaforo(pct: number, meta: number, maximo: boolean): string {
  const fuera = maximo ? pct - meta : meta - pct;
  return fuera <= 0 ? VERDE : fuera <= TOLERANCIA_AMARILLO_PCT ? AMARILLO : ROJO;
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

type Fila =
  | { tipo: "resta" | "final"; label: string; nota?: string; monto: number; colorPct?: string }
  | { tipo: "recuadros" };

function recuadro(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  // roundRect no existe en navegadores viejos: ahí va cuadrado.
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#dfe7dc";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Dibuja la imagen y la copia al portapapeles (o la descarga si el
// navegador no deja): true si se copió.
export function copyDashboardImage(r: ResultadoSemanal, subtitulo: string, nota: string): Promise<boolean> {
  const pctNum = (n: number) => (r.venta > 0 ? (n / r.venta) * 100 : 0);
  const pct = (n: number) => (r.venta > 0 ? `${Math.round(pctNum(n))}%` : "—");
  const margen = pctNum(r.utilidadOperativa);
  const colorMargen = r.venta > 0 ? semaforo(margen, META_MARGEN_OPERATIVO_PCT, false) : SUAVE;
  const filas: Fila[] = [
    {
      tipo: "resta",
      label: "Gastos operativos",
      nota: `Meta: ${META_GASTOS_OPERATIVOS_PCT}% o menos`,
      monto: r.gastosOperativos,
      colorPct: semaforo(pctNum(r.gastosOperativos), META_GASTOS_OPERATIVOS_PCT, true),
    },
    { tipo: "resta", label: "Nómina", nota: `Meta: ${META_NOMINA_PCT}% o menos`, monto: r.nomina, colorPct: semaforo(pctNum(r.nomina), META_NOMINA_PCT, true) },
    { tipo: "resta", label: "Otros gastos", nota: r.otrosDesglose.map((x) => `${x.label} ${sinCentavos(x.monto)}`).join(" · "), monto: r.otros },
    { tipo: "recuadros" },
    { tipo: "resta", label: "Retiro", nota: "Gastos externos (no operativos)", monto: r.retiro },
    { tipo: "final", label: "Utilidad después de retiro", monto: r.despuesDeRetiro },
  ];

  const scale = 2;
  const canvas = document.createElement("canvas");
  const medir = canvas.getContext("2d")!;
  const anchoLabel = WIDTH - PAD * 2 - 190;
  // Alto de cada fila según cuántos renglones ocupa su nota.
  const notas = filas.map((f) => {
    if (f.tipo === "recuadros" || !f.nota) return [];
    medir.font = "11px Arial";
    return renglones(medir, f.nota, anchoLabel);
  });
  const RECUADROS = 104;
  const altoFila = (f: Fila, i: number) =>
    f.tipo === "recuadros" ? RECUADROS : (f.tipo === "final" ? 64 : 44) + notas[i].length * 14 - (notas[i].length ? 6 : 0);
  const HEAD = 92;
  const VENTA = r.ventaSemanaPasada !== null ? 104 : 84;
  const PIE = 44;
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

  filas.forEach((f, i) => {
    const h = altoFila(f, i);

    // Utilidad operativa ($) y Margen operativo (%), como en la app del jefe.
    if (f.tipo === "recuadros") {
      ctx.fillStyle = ACENTO_SUAVE;
      ctx.fillRect(0, y, WIDTH, h);
      const w = (WIDTH - PAD * 2 - 10) / 2;
      const cajas = [
        { titulo: "Utilidad operativa", valor: money(r.utilidadOperativa), nota: "Venta − todos los gastos, sin el retiro", color: r.utilidadOperativa >= 0 ? ACENTO : ROJO },
        {
          titulo: "Margen operativo",
          valor: r.venta > 0 ? `${margen.toFixed(2)}%` : "—",
          nota: `Sobre ventas totales · meta ${META_MARGEN_OPERATIVO_PCT}% o más`,
          color: colorMargen,
        },
      ];
      cajas.forEach((c, k) => {
        const x = PAD + k * (w + 10);
        recuadro(ctx, x, y + 12, w, h - 24);
        ctx.textAlign = "left";
        ctx.fillStyle = "#5b7d70";
        ctx.font = "bold 12px Arial";
        ctx.fillText(c.titulo, x + 12, y + 34);
        ctx.fillStyle = c.color;
        ctx.font = "bold 22px Arial";
        ctx.fillText(c.valor, x + 12, y + 62);
        ctx.fillStyle = SUAVE;
        ctx.font = "10px Arial";
        renglones(ctx, c.nota, w - 24).forEach((linea, n) => ctx.fillText(linea, x + 12, y + 78 + n * 12));
      });
      y += h;
      return;
    }

    const final = f.tipo === "final";
    const positivo = f.monto >= 0;
    ctx.fillStyle = final ? (positivo ? VERDE_SUAVE : ROJO_SUAVE) : "#ffffff";
    ctx.fillRect(0, y, WIDTH, h);
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, y + h - 1, WIDTH, 1);

    const colorFuerte = final ? (positivo ? VERDE : ROJO) : NEGRO;
    const base = y + (final ? 38 : 27) - (notas[i].length ? 6 : 0);

    // Etiqueta y nota
    ctx.textAlign = "left";
    ctx.fillStyle = final ? colorFuerte : TEXTO;
    ctx.font = final ? "bold 15px Arial" : "14px Arial";
    ctx.fillText(final ? f.label.toUpperCase() : f.label, PAD, base);
    ctx.font = "11px Arial";
    ctx.fillStyle = SUAVE;
    notas[i].forEach((linea, k) => ctx.fillText(linea, PAD, base + 15 + k * 14));

    // % y monto
    const medio = y + h / 2 + 5;
    ctx.textAlign = "right";
    ctx.font = f.colorPct || final ? "bold 12.5px Arial" : "12.5px Arial";
    ctx.fillStyle = f.colorPct || (final ? colorFuerte : "#666666");
    ctx.fillText(pct(f.monto), WIDTH - PAD - (final ? 150 : 130), medio);
    ctx.font = final ? "bold 22px Arial" : "bold 14px Arial";
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

  // Pie: qué significa cada color y la nota de la semana.
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, y, WIDTH, PIE);
  ctx.textAlign = "left";
  ctx.font = "bold 10.5px Arial";
  let x = PAD;
  [
    { color: VERDE, texto: "En meta" },
    { color: AMARILLO, texto: `Cerca (${TOLERANCIA_AMARILLO_PCT} pts o menos)` },
    { color: ROJO, texto: "Fuera de meta" },
  ].forEach((l) => {
    ctx.fillStyle = l.color;
    ctx.beginPath();
    ctx.arc(x + 4, y + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(l.texto, x + 12, y + 19);
    x += 12 + ctx.measureText(l.texto).width + 16;
  });
  ctx.fillStyle = SUAVE;
  ctx.font = "italic 10.5px Arial";
  ctx.fillText(nota, PAD, y + 35);

  return copyCanvasAsPng(canvas, `Resultado ${NOMBRE_NEGOCIO} ${subtitulo}`);
}
