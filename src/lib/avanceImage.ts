import { META_GASTOS_OPERATIVOS_PCT, META_NOMINA_VERDE_PCT } from "./dataModel";
import { copyCanvasAsPng } from "./imageExport";

// Imagen del avance a mitad de semana (Dashboard > "Copiar avance al
// momento"): lo que se llevaba a mano en la libreta — venta y gasto contra
// su presupuesto, el ritmo de los dos y la nómina hasta hoy y al cierre.
// La venta presupuestada es la meta de venta semanal de Tendencias (se
// captura solo ahí); el gasto presupuestado es su 42% y la nómina
// presupuestada su 15%.

const NOMBRE_NEGOCIO = "Sucursal Metroplex";
const WIDTH = 500;
const PAD = 26;
const GAP = 14;

const FONDO = "#F3F0EA";
const TARJETA = "#FFFFFF";
const NEGRO = "#1E1E1E";
const TEXTO = "#333333";
const SUAVE = "#666666";
const RIEL = "#EDE9E2";
const VERDE = "#22884F";
const AMARILLO = "#E8B32E";
const ROJO = "#C8102E";
const GRIS = "#8E8E8E";
const FUENTE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export interface AvanceSemana {
  semana: string; // "Semana 43 · hasta hoy (jueves)"
  venta: number;
  ventaPresupuesto: number;
  gasto: number;
  nominaHastaHoy: number;
  nominaCierre: number;
}

const pesos = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct1 = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;

type Nota = { color: string; texto: string };

export function avanceSemana(a: AvanceSemana) {
  const gastoPresupuesto = (a.ventaPresupuesto * META_GASTOS_OPERATIVOS_PCT) / 100;
  const nominaPresupuesto = (a.ventaPresupuesto * META_NOMINA_VERDE_PCT) / 100;
  const ventaPct = a.ventaPresupuesto > 0 ? (a.venta / a.ventaPresupuesto) * 100 : 0;
  const gastoPct = gastoPresupuesto > 0 ? (a.gasto / gastoPresupuesto) * 100 : 0;
  const gastoSobreVenta = a.ventaPresupuesto > 0 ? (a.gasto / a.ventaPresupuesto) * 100 : 0;
  const nominaCierrePct = a.ventaPresupuesto > 0 ? (a.nominaCierre / a.ventaPresupuesto) * 100 : 0;
  const nominaDiferencia = a.nominaCierre - nominaPresupuesto;

  const notas: Nota[] = [];
  const quedan = gastoPresupuesto - a.gasto;
  notas.push(
    quedan >= 0
      ? { color: VERDE, texto: `Quedan ${pesos(quedan)} de presupuesto de gasto para cerrar dentro del ${META_GASTOS_OPERATIVOS_PCT}%.` }
      : { color: ROJO, texto: `El gasto ya pasó su presupuesto por ${pesos(-quedan)} (tope ${META_GASTOS_OPERATIVOS_PCT}% de la venta presupuestada).` }
  );
  notas.push(
    nominaDiferencia > 0
      ? {
          color: ROJO,
          texto: `Nómina estimada al cierre ${pesos(nominaDiferencia)} por encima del presupuesto (${pct1(nominaCierrePct)}, meta ${META_NOMINA_VERDE_PCT}%).`,
        }
      : {
          color: VERDE,
          texto: `Nómina estimada al cierre ${pesos(-nominaDiferencia)} debajo del presupuesto (${pct1(nominaCierrePct)}, meta ${META_NOMINA_VERDE_PCT}%).`,
        }
  );
  const puntos = Math.round(gastoPct - ventaPct);
  notas.push(
    puntos > 5
      ? {
          color: AMARILLO,
          texto: `El gasto va ${puntos} puntos adelante de la venta (${pct1(gastoPct)} vs ${pct1(ventaPct)}). Cuidar compras el resto de la semana.`,
        }
      : { color: VERDE, texto: `El gasto va al ritmo de la venta (${pct1(gastoPct)} vs ${pct1(ventaPct)}).` }
  );

  return { gastoPresupuesto, nominaPresupuesto, ventaPct, gastoPct, gastoSobreVenta, nominaCierrePct, nominaDiferencia, notas };
}

function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const out: string[] = [];
  let linea = "";
  texto.split(" ").forEach((p) => {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && linea) {
      out.push(linea);
      linea = p;
    } else linea = prueba;
  });
  if (linea) out.push(linea);
  return out;
}

function tarjeta(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = TARJETA, r = 14) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function riel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, color: string) {
  tarjeta(ctx, x, y, w, h, RIEL, h / 2);
  const lleno = Math.max(0, Math.min(1, pct / 100)) * w;
  if (lleno > 0) tarjeta(ctx, x, y, Math.max(lleno, h), h, color, h / 2);
}

function espaciado(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, align: "left" | "center") {
  ctx.letterSpacing = "2px";
  ctx.textAlign = align;
  ctx.fillText(texto, x, y);
  ctx.letterSpacing = "0px";
}

export function dibujarAvance(a: AvanceSemana): HTMLCanvasElement {
  const c = avanceSemana(a);
  const scale = 2;
  const canvas = document.createElement("canvas");
  const medir = canvas.getContext("2d")!;
  const INNER = WIDTH - PAD * 2;
  medir.font = `14px ${FUENTE}`;
  const notasLineas = c.notas.map((n) => renglones(medir, n.texto, INNER - 36));

  const HEAD = 112;
  const DONAS = 196;
  const RITMO = 228;
  const NOMINA = 196;
  const altoNota = (l: string[]) => 22 + l.length * 21;
  const height = PAD + HEAD + GAP + DONAS + GAP + RITMO + GAP + NOMINA + notasLineas.reduce((s, l) => s + GAP + altoNota(l), 0) + PAD;

  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = "alphabetic";
  let y = PAD;

  // Encabezado
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(PAD, y, INNER, HEAD, 14);
  ctx.clip();
  ctx.fillStyle = NEGRO;
  ctx.fillRect(PAD, y, INNER, HEAD);
  ctx.fillStyle = AMARILLO;
  ctx.beginPath();
  ctx.arc(PAD + INNER - 30, y + 30, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = AMARILLO;
  ctx.font = `bold 10px ${FUENTE}`;
  espaciado(ctx, "AVANCE AL MOMENTO", PAD + 22, y + 30, "left");
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 25px ${FUENTE}`;
  ctx.fillText(NOMBRE_NEGOCIO, PAD + 22, y + 66);
  ctx.fillStyle = "#BBBBBB";
  ctx.font = `13px ${FUENTE}`;
  ctx.fillText(a.semana, PAD + 22, y + 92);
  y += HEAD + GAP;

  // Venta y gasto: dona con su avance contra el presupuesto
  const anchoDona = (INNER - GAP) / 2;
  const donas = [
    {
      titulo: "VENTA",
      pct: c.ventaPct,
      color: VERDE,
      monto: a.venta,
      pie: `de ${pesos(a.ventaPresupuesto)} · ${a.venta <= a.ventaPresupuesto ? `faltan ${pesos(a.ventaPresupuesto - a.venta)}` : `arriba ${pesos(a.venta - a.ventaPresupuesto)}`}`,
    },
    {
      titulo: "GASTO",
      pct: c.gastoPct,
      color: c.gastoPct > 100 ? ROJO : AMARILLO,
      monto: a.gasto,
      pie: `de ${pesos(c.gastoPresupuesto)} · ${a.gasto <= c.gastoPresupuesto ? `quedan ${pesos(c.gastoPresupuesto - a.gasto)}` : `pasado ${pesos(a.gasto - c.gastoPresupuesto)}`}`,
    },
  ];
  donas.forEach((d, i) => {
    const x = PAD + i * (anchoDona + GAP);
    const cx = x + anchoDona / 2;
    tarjeta(ctx, x, y, anchoDona, DONAS);
    ctx.fillStyle = SUAVE;
    ctx.font = `bold 10px ${FUENTE}`;
    espaciado(ctx, d.titulo, cx, y + 26, "center");
    const cy = y + 82;
    ctx.lineWidth = 13;
    ctx.strokeStyle = RIEL;
    ctx.beginPath();
    ctx.arc(cx, cy, 37, 0, Math.PI * 2);
    ctx.stroke();
    if (d.pct > 0) {
      ctx.strokeStyle = d.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 37, -Math.PI / 2, -Math.PI / 2 + Math.min(1, d.pct / 100) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = NEGRO;
    ctx.textAlign = "center";
    ctx.font = `bold 16px ${FUENTE}`;
    ctx.fillText(pct1(d.pct), cx, cy + 6);
    ctx.font = `bold 19px ${FUENTE}`;
    ctx.fillText(pesos(d.monto), cx, y + 158);
    ctx.fillStyle = SUAVE;
    ctx.font = `11.5px ${FUENTE}`;
    ctx.fillText(d.pie, cx, y + 180);
  });
  y += DONAS + GAP;

  // Ritmo de la semana
  tarjeta(ctx, PAD, y, INNER, RITMO);
  const xi = PAD + 18;
  const wi = INNER - 36;
  ctx.fillStyle = SUAVE;
  ctx.font = `bold 11px ${FUENTE}`;
  espaciado(ctx, "↗  RITMO DE LA SEMANA", xi, y + 30, "left");
  const barras = [
    { label: "Venta", pct: c.ventaPct, color: VERDE },
    { label: "Gasto", pct: c.gastoPct, color: c.gastoPct > 100 ? ROJO : AMARILLO },
  ];
  barras.forEach((b, i) => {
    const by = y + 58 + i * 50;
    ctx.fillStyle = TEXTO;
    ctx.font = `14px ${FUENTE}`;
    ctx.textAlign = "left";
    ctx.fillText(b.label, xi, by);
    ctx.font = `bold 14px ${FUENTE}`;
    ctx.textAlign = "right";
    ctx.fillText(pct1(b.pct), xi + wi, by);
    riel(ctx, xi, by + 10, wi, 13, b.pct, b.color);
  });
  // Marca de la venta sobre la barra del gasto
  const mx = xi + Math.min(1, c.ventaPct / 100) * wi;
  const my = y + 108 + 10;
  ctx.fillStyle = NEGRO;
  ctx.fillRect(mx - 1, my - 4, 2, 21);
  ctx.fillStyle = SUAVE;
  ctx.font = `10px ${FUENTE}`;
  ctx.textAlign = "center";
  ctx.fillText("venta", mx, my + 30);
  ctx.fillStyle = RIEL;
  ctx.fillRect(xi, y + 154, wi, 1);
  ctx.fillStyle = c.gastoSobreVenta > META_GASTOS_OPERATIVOS_PCT ? ROJO : NEGRO;
  ctx.font = `bold 34px ${FUENTE}`;
  ctx.textAlign = "left";
  const grande = pct1(c.gastoSobreVenta);
  ctx.fillText(grande, xi, y + 202);
  const tx = xi + ctx.measureText(grande).width + 16;
  ctx.fillStyle = TEXTO;
  ctx.font = `12.5px ${FUENTE}`;
  ctx.fillText("Gasto acumulado sobre la venta presupuestada.", tx, y + 184);
  ctx.font = `bold 12.5px ${FUENTE}`;
  ctx.fillText(`Tope de la semana: ${META_GASTOS_OPERATIVOS_PCT}%`, tx, y + 203);
  y += RITMO + GAP;

  // Nómina: lo generado hasta hoy, lo que falta al cierre y el presupuesto
  tarjeta(ctx, PAD, y, INNER, NOMINA);
  ctx.fillStyle = SUAVE;
  ctx.font = `bold 11px ${FUENTE}`;
  espaciado(ctx, `NÓMINA · META ${META_NOMINA_VERDE_PCT}% DE LA VENTA PRESUP.`, xi, y + 30, "left");
  ctx.font = `10.5px ${FUENTE}`;
  ctx.textAlign = "left";
  ctx.fillText("$0", xi, y + 52);
  ctx.textAlign = "right";
  ctx.fillText(`Presupuesto ${pesos(c.nominaPresupuesto)}`, xi + wi, y + 52);
  const tope = Math.max(c.nominaPresupuesto, a.nominaCierre, 1);
  const by = y + 60;
  const bh = 20;
  const wPagado = (Math.min(a.nominaHastaHoy, tope) / tope) * wi;
  const wCierre = (Math.min(a.nominaCierre, tope) / tope) * wi;
  const wPresup = (c.nominaPresupuesto / tope) * wi;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(xi, by, wi, bh, 4);
  ctx.clip();
  ctx.fillStyle = RIEL;
  ctx.fillRect(xi, by, wi, bh);
  ctx.fillStyle = GRIS;
  ctx.fillRect(xi, by, wCierre, bh);
  ctx.fillStyle = NEGRO;
  ctx.fillRect(xi, by, wPagado, bh);
  if (a.nominaCierre > c.nominaPresupuesto) {
    ctx.fillStyle = ROJO;
    ctx.fillRect(xi + wPresup, by, Math.max(3, wCierre - wPresup), bh);
  }
  ctx.restore();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 10.5px ${FUENTE}`;
  ctx.textAlign = "center";
  if (wPagado > 60) ctx.fillText("Pagado", xi + wPagado / 2, by + 14);
  if (wCierre - wPagado > 60) ctx.fillText("Por pagar", xi + (wPagado + Math.min(wCierre, wPresup)) / 2, by + 14);

  const anchoDato = (wi - 16) / 3;
  const datos = [
    { label: "Pagado al momento", valor: pesos(a.nominaHastaHoy), color: NEGRO },
    { label: "Estimado al cierre", valor: pesos(a.nominaCierre), color: NEGRO },
    c.nominaDiferencia > 0
      ? { label: "Exceso estimado", valor: pesos(c.nominaDiferencia), color: ROJO }
      : { label: "Sobra estimado", valor: pesos(-c.nominaDiferencia), color: VERDE },
  ];
  datos.forEach((d, i) => {
    const dx = xi + i * (anchoDato + 8);
    tarjeta(ctx, dx, y + 90, anchoDato, 46, FONDO, 6);
    ctx.textAlign = "left";
    ctx.fillStyle = SUAVE;
    ctx.font = `11px ${FUENTE}`;
    ctx.fillText(d.label, dx + 9, y + 108);
    ctx.fillStyle = d.color;
    ctx.font = `bold 14px ${FUENTE}`;
    ctx.fillText(d.valor, dx + 9, y + 127);
  });
  ctx.fillStyle = NEGRO;
  ctx.fillRect(xi, y + 148, wi, 1.5);
  ctx.font = `bold 14px ${FUENTE}`;
  ctx.textAlign = "left";
  ctx.fillText("Nómina al cierre", xi, y + 177);
  ctx.fillStyle = c.nominaDiferencia > 0 ? ROJO : VERDE;
  ctx.textAlign = "right";
  ctx.fillText(`${pct1(c.nominaCierrePct)} de venta presup.`, xi + wi, y + 177);
  y += NOMINA;

  // Notas
  c.notas.forEach((n, i) => {
    y += GAP;
    const h = altoNota(notasLineas[i]);
    tarjeta(ctx, PAD, y, INNER, h, TARJETA, 8);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PAD, y, INNER, h, 8);
    ctx.clip();
    ctx.fillStyle = n.color;
    ctx.fillRect(PAD, y, 4, h);
    ctx.restore();
    ctx.fillStyle = TEXTO;
    ctx.font = `14px ${FUENTE}`;
    ctx.textAlign = "left";
    notasLineas[i].forEach((l, j) => ctx.fillText(l, PAD + 18, y + 27 + j * 21));
    y += h;
  });

  return canvas;
}

export function copyAvanceImage(a: AvanceSemana): Promise<boolean> {
  return copyCanvasAsPng(dibujarAvance(a), `Avance ${a.semana}`);
}
