import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
after(() => vite.close());
const { aplicarApertura, buildMonth, defaultData, efectivoDelDia, migrateAppData, recalcularAcumulados } = await vite.ssrLoadModule("/src/lib/dataModel.ts");

function corte(id, meseroId, venta, extra = {}) {
  return {
    id, meseroId, nombre: meseroId, venta, tarjetas: 50, transferencia: 20,
    propinaTipo: "p3", propina: 0, gastosTotal: 10, total: 0, ...extra,
  };
}

test("dos lecturas del mismo mesero descuentan la primera y no mezclan meseros", () => {
  const dia = { meseros: [
    corte("1", "ana", 1000, { lecturaSistema: 1000, lecturaDiaria: true }),
    corte("2", "luis", 400, { lecturaSistema: 400, lecturaDiaria: true }),
    corte("3", "ana", 1700, { lecturaSistema: 1700, lecturaDiaria: true }),
  ] };
  recalcularAcumulados(dia);
  assert.deepEqual(dia.meseros.map((m) => m.venta), [1000, 400, 700]);
  assert.equal(dia.meseros[2].propina, 21);
  assert.equal(dia.meseros[2].total, 641);
});

test("editar o eliminar el primer corte ajusta los posteriores", () => {
  const dia = { meseros: [
    corte("1", "ana", 1000, { lecturaSistema: 1000, lecturaDiaria: true }),
    corte("2", "ana", 1700, { lecturaSistema: 1700, lecturaDiaria: true }),
  ] };
  dia.meseros[0].lecturaSistema = 1100;
  recalcularAcumulados(dia);
  assert.deepEqual(dia.meseros.map((m) => m.venta), [1100, 600]);
  dia.meseros.splice(0, 1);
  recalcularAcumulados(dia);
  assert.equal(dia.meseros[0].venta, 1700);
});

test("al editar un corte anterior histórico ajusta la lectura diaria posterior", () => {
  const dia = { meseros: [
    corte("1", "ana", 1000),
    corte("2", "ana", 1700, { lecturaSistema: 1700, lecturaDiaria: true }),
  ] };
  recalcularAcumulados(dia);
  assert.deepEqual(dia.meseros.map((m) => m.venta), [1000, 700]);
  dia.meseros[0].venta = 1100;
  recalcularAcumulados(dia);
  assert.deepEqual(dia.meseros.map((m) => m.venta), [1100, 600]);
  dia.meseros.splice(0, 1);
  recalcularAcumulados(dia);
  assert.equal(dia.meseros[0].venta, 1700);
});

test("conserva los cálculos históricos y descuenta sus ventas en una lectura nueva", () => {
  const dia = { meseros: [
    corte("1", "ana", 500),
    corte("2", "ana", 1000, { lecturaSistema: 1000 }),
    corte("3", "ana", 2000, { lecturaSistema: 2000, lecturaDiaria: true }),
  ] };
  recalcularAcumulados(dia);
  assert.deepEqual(dia.meseros.map((m) => m.venta), [500, 1000, 500]);
  recalcularAcumulados(dia);
  assert.deepEqual(dia.meseros.map((m) => m.venta), [500, 1000, 500]);
});

test("una lectura posterior al corte de apertura descuenta lo entregado en apertura", () => {
  const dia = { meseros: [
    corte("1", "ana", 1000, { lecturaSistema: 1000, apertura: true }),
    corte("2", "ana", 1700, { lecturaSistema: 1700, lecturaDiaria: true }),
  ] };
  recalcularAcumulados(dia);
  assert.deepEqual(dia.meseros.map((m) => m.venta), [1000, 700]);
});

test("al editar apertura conserva su posición y recalcula el corte posterior", () => {
  const dia = { meseros: [], gastos: [], transferencias: [], ventaApps: 0 };
  const apertura = (venta) => ({
    ventaApps: 0,
    bloques: [{ meseroId: "ana", nombre: "Ana", venta, tarjetas: 0, transferencia: 0, gastos: [] }],
  });
  aplicarApertura(dia, apertura(1000), "Dueño");
  const id = dia.meseros[0].id;
  dia.meseros.push(corte("2", "ana", 1700, { lecturaSistema: 1700, lecturaDiaria: true }));
  recalcularAcumulados(dia);
  aplicarApertura(dia, apertura(1100), "Dueño");
  assert.equal(dia.meseros[0].id, id);
  assert.deepEqual(dia.meseros.map((m) => m.venta), [1100, 600]);
});

test("efectivo recibido se descuenta sin restar propinas", () => {
  const dia = { meseros: [
    corte("1", "ana", 1000, { tarjetas: 0, transferencia: 0, gastosTotal: 0, lecturaSistema: 1000, lecturaDiaria: true, efectivoRecibidoDueno: 1000 }),
    corte("2", "ana", 1700, { tarjetas: 0, transferencia: 0, gastosTotal: 0, lecturaSistema: 1700, lecturaDiaria: true, efectivoRecibidoDueno: null }),
  ], gastos: [], transferencias: [] };
  recalcularAcumulados(dia);
  let e = efectivoDelDia({}, "2026-11-09", dia, 1700);
  assert.equal(dia.meseros[0].total, 1030);
  assert.equal(e.recibidoDueno, 1000);
  assert.equal(e.entregar, 700);
  assert.equal(e.totalDia, 1700);
  dia.meseros[0].efectivoRecibidoDueno = null;
  e = efectivoDelDia({}, "2026-11-09", dia, 1700);
  assert.equal(e.entregar, 1700);
});

test("no descuenta dos veces una apertura histórica marcada como recibida", () => {
  const dia = { meseros: [corte("1", "ana", 1000, { total: 1000, propina: 0, apertura: true, efectivoRecibidoDueno: 1000 })], gastos: [], transferencias: [], apertura: { ids: ["1"] } };
  const e = efectivoDelDia({}, "2026-11-09", dia, 1000);
  assert.equal(e.aperturaEntregado, 1000);
  assert.equal(e.recibidoDueno, 0);
  assert.equal(e.entregar, 0);
});

test("fondo restante se suma hasta que el dueño recibe ese dinero", () => {
  const mes = buildMonth("2026-11", "2026-11-02");
  mes.weeks[0].days.Domingo.efectivoDejado = { monto: 500 };
  const dia = mes.weeks[1].days.Lunes;
  dia.gastos.push({ id: "g", concepto: "Hielo", total: 200, estado: "pendiente", origen: "manual", delFondo: true });
  let e = efectivoDelDia({ "2026-11": mes }, "2026-11-09", dia, 500);
  assert.equal(e.fondoQueda, 300);
  assert.equal(e.entregar, 1000);
  dia.fondoEntregado = { fecha: "2026-11-09T12:00:00Z", nombre: "Dueño", monto: 300 };
  e = efectivoDelDia({ "2026-11": mes }, "2026-11-09", dia, 500);
  assert.equal(e.fondoEntregado, 300);
  assert.equal(e.entregar, 700);
  assert.equal(e.totalDia, 1000);
});

test("la cantidad entregada no cambia al recalcular el corte", () => {
  const dia = { meseros: [corte("1", "ana", 1000, { tarjetas: 0, transferencia: 0, gastosTotal: 0, lecturaSistema: 1000, lecturaDiaria: true, efectivoRecibidoDueno: 1000 })], gastos: [], transferencias: [] };
  recalcularAcumulados(dia);
  dia.meseros[0].lecturaSistema = 1100;
  recalcularAcumulados(dia);
  const e = efectivoDelDia({}, "2026-11-09", dia, 1100);
  assert.equal(e.recibidoDueno, 1000);
  assert.equal(e.entregar, 100);
});

test("los campos nuevos sobreviven a la serialización y migración de datos", () => {
  const data = defaultData();
  data.months["2026-11"] = buildMonth("2026-11", "2026-11-02");
  const dia = data.months["2026-11"].weeks[0].days.Lunes;
  dia.meseros.push(corte("1", "ana", 1000, { lecturaSistema: 1000, lecturaDiaria: true, efectivoRecibidoDueno: 1000 }));
  dia.fondoEntregado = { fecha: "2026-11-02T12:00:00Z", nombre: "Ana", monto: 300 };
  const { data: restaurada } = migrateAppData(JSON.parse(JSON.stringify(data)));
  const recuperado = restaurada.months["2026-11"].weeks[0].days.Lunes;
  assert.equal(recuperado.meseros[0].lecturaDiaria, true);
  assert.equal(recuperado.meseros[0].efectivoRecibidoDueno, 1000);
  assert.deepEqual(recuperado.fondoEntregado, dia.fondoEntregado);
});
