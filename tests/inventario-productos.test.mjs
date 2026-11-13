import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
after(() => vite.close());
const { plantillaConProductos, plantillaConteo } = await vite.ssrLoadModule("/src/lib/dataModel.ts");
const { gruposDelModo } = await vite.ssrLoadModule("/src/lib/inventarioNotas.ts");

test("la plantilla agrega solo productos nuevos de alta rotación desde su fecha, sin duplicados", () => {
  const base = plantillaConteo("cocina");
  const insumos = [
    { id: "1", area: "cocina", nombre: "Salsa nueva", unidad: "pieza", presentacion: "bolsa", altaRotacion: true, conteoDiarioDesde: "2026-11-12" },
    { id: "2", area: "cocina", nombre: "Alitas", unidad: "kg", altaRotacion: true, conteoDiarioDesde: "2026-11-12" },
    { id: "3", area: "cocina", nombre: "Histórico", unidad: "kg", altaRotacion: true },
    { id: "4", area: "cocina", nombre: "Sin rotación", unidad: "kg", conteoDiarioDesde: "2026-11-12" },
  ];
  assert.equal(plantillaConProductos(base, insumos, "2026-11-11"), base);
  const actual = plantillaConProductos(base, insumos, "2026-11-12");
  assert.match(actual, /Salsa nueva \(bolsa\): /);
  assert.equal((actual.match(/Alitas \(kg\):/g) || []).length, 1);
  assert.doesNotMatch(actual, /Histórico|Sin rotación/);
});

test("incluir al proveedor incorpora sus productos normales al jueves y no los de alta rotación", () => {
  const productos = [
    { id: "1", area: "cocina", nombre: "Tomate", unidad: "kg", proveedorId: "p" },
    { id: "2", area: "cocina", nombre: "Cebolla", unidad: "kg", proveedorId: "p" },
    { id: "3", area: "cocina", nombre: "Salsa", unidad: "kg", proveedorId: "p", altaRotacion: true },
  ];
  assert.deepEqual(gruposDelModo(productos, [{ id: "p", nombre: "Verduras" }], "jueves"), []);
  const grupos = gruposDelModo(productos, [{ id: "p", nombre: "Verduras", incluyeJueves: true }], "jueves");
  assert.deepEqual(grupos[0].items.map((i) => i.id).sort(), ["1", "2"]);
});
