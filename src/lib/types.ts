export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export type DayName = (typeof DAYS)[number];

export const DAY_SHORT: Record<DayName, string> = {
  Lunes: "Lun", Martes: "Mar", Miércoles: "Mié", Jueves: "Jue", Viernes: "Vie", Sábado: "Sáb", Domingo: "Dom",
};

export type PropinaTipo = "p3" | "p2" | "manual" | "none";

export interface MeseroCatalogEntry {
  id: string;
  nombre: string;
}

// Área/categoría a la que pertenece un puesto (Gerencia, Piso, Cocina, lo
// que se vaya necesitando) — catálogo editable, crece igual que
// Proveedores: se crea al vuelo desde el propio puesto en Personal.
export interface AreaEntry {
  id: string;
  nombre: string;
}

// Puesto específico de una persona (Gerente, Mesero, Cocinero, ...),
// ligado a un área. También editable, se crea al vuelo desde Personal.
export interface PuestoEntry {
  id: string;
  nombre: string;
  areaId: string;
}

// Lista de personal, separada del catálogo de meseros (ese es para el
// corte). sueldoDiario es la base para calcular la nómina a partir de
// Horarios — el sueldo semanal completo (6 días trabajados + 1 de
// descanso pagado) siempre es sueldoDiario × 7. puestoId es opcional
// (Gerente, Mesero, Cocinero, ...) y determina el área a la que pertenece.
export interface EmpleadoEntry {
  id: string;
  nombre: string;
  sueldoDiario?: number;
  puestoId?: string;
  // Si tiene una cuenta de equipo con PIN dada de alta desde aquí, el id
  // de su profile — ver staffAccounts.ts. Sin esto, esta persona no tiene
  // acceso a la app (es normal, la mayoría no lo necesita).
  staffProfileId?: string;
}

// Valores rápidos para una celda de horario — el resto de las celdas
// admite cualquier texto libre (p.ej. una hora de entrada).
export const HORARIO_CHIPS = ["OFF", "O", "X", "Z"] as const;

// Áreas fijas del horario — no se pueden crear, renombrar ni borrar.
export const HORARIO_AREAS_FIJAS = [
  { id: "piso", nombre: "PISO" },
  { id: "cocina", nombre: "COCINA" },
] as const;

// Una fila de horario por empleado dentro de un área. `nombre` es una
// foto del nombre al momento de agregarlo a la semana, para que el
// historial no se rompa si después se borra ese empleado de Personal.
export interface HorarioFila {
  empleadoId: string;
  nombre: string;
  valores: Partial<Record<DayName, string>>;
}

// Un área/puesto (Piso, Cocina, ...) con su propia lista de empleados,
// igual que en el Excel que se llevaba antes.
export interface HorarioArea {
  id: string;
  nombre: string;
  filas: HorarioFila[];
}

export interface HorarioSemana {
  areas: HorarioArea[];
  // Días marcados como festivo en esta semana — a quien trabaje ese día
  // (cualquier valor que no sea OFF) se le paga 1 turno extra además de lo
  // que ya le tocaba (normal o Z), ver computeNominaFila. No se paga solo
  // por tener el descanso ahí si no trabajó.
  festivos?: DayName[];
}

export interface HorarioMonthData {
  weeks: (HorarioSemana | null)[];
}

// Nómina calculada de un empleado en una semana, a partir de su horario
// y su sueldo diario — ver computeNominaFila/computeNominaSemana.
export interface NominaDia {
  day: DayName;
  valor: string;
  multiplicador: number;
  monto: number;
  esFestivo: boolean;
}

export interface NominaEmpleadoSemana {
  empleadoId: string;
  nombre: string;
  areaNombre: string;
  sueldoDiario: number;
  dias: NominaDia[];
  diasTrabajados: number;
  offPagado: boolean;
  bruto: number;
  extras: NominaExtra[];
  totalExtras: number;
  descuentos: NominaDescuento[];
  totalDescuentos: number;
  neto: number;
  // Si el dueño ya la marcó como pagada esta semana — ver
  // NominaConfirmacion.
  confirmado: boolean;
  confirmadoEn?: string;
  // Lo que se le pagó al marcarla (su "a recibir hasta hoy" de ese
  // momento). Vacío en marcas viejas, de antes de que se guardara.
  montoPagado?: number;
}

// Descuentos de nómina capturados a mano por empleado — tardanzas,
// adelantos de efectivo durante la semana, comida, etc. Itemizados (no un
// solo total por tipo) para poder consultarlos uno por uno después, y
// guardados por semana igual que Horarios, para tener historial real.
export type NominaDescuentoTipo = "tardanza" | "adelanto" | "comida" | "otro";

export const NOMINA_DESCUENTO_TIPOS: { value: NominaDescuentoTipo; label: string }[] = [
  { value: "tardanza", label: "Tardanza" },
  { value: "adelanto", label: "Adelanto de efectivo" },
  { value: "comida", label: "Comida" },
  { value: "otro", label: "Otro" },
];

export interface NominaDescuento {
  id: string;
  empleadoId: string;
  tipo: NominaDescuentoTipo;
  concepto?: string;
  monto: number;
  // "corte" = derivado en vivo de un gasto del corte diario vinculado a
  // este empleado (adelanto o comida) — no se guarda ni se borra aquí,
  // se edita o elimina desde el gasto en Corte. Sin este campo (u
  // "manual") es un descuento capturado a mano en la propia Nómina.
  origen?: "manual" | "corte";
}

// Percepciones extra de una sola vez — finiquitos, bonos, etc. Igual que
// los descuentos, pero se suman al bruto en vez de restarse, y solo
// existen en la semana donde se capturaron (no son recurrentes).
export type NominaExtraTipo = "finiquito" | "bono" | "otro";

export const NOMINA_EXTRA_TIPOS: { value: NominaExtraTipo; label: string }[] = [
  { value: "finiquito", label: "Finiquito" },
  { value: "bono", label: "Bono" },
  { value: "otro", label: "Otro" },
];

export interface NominaExtra {
  id: string;
  empleadoId: string;
  tipo: NominaExtraTipo;
  concepto?: string;
  monto: number;
}

// Marca de que el dueño ya le pagó a un empleado su nómina de la semana —
// la pone y la quita tocando la etiqueta Pendiente/Pagada en Equipo >
// Nómina. (Antes la capturaba el propio empleado con "Recibí mi nómina
// correcta"; esas marcas viejas cuentan como pagadas.)
export interface NominaConfirmacion {
  empleadoId: string;
  nombre: string;
  confirmadoEn: string; // ISO datetime
  // Lo que se le pagó al marcarla: su "a recibir hasta hoy" en ese
  // momento. Si después trabaja más días, la diferencia queda en el
  // restante por pagar.
  monto?: number;
}

export interface NominaDescuentosSemana {
  descuentos: NominaDescuento[];
  extras?: NominaExtra[];
  confirmaciones?: NominaConfirmacion[];
}

export interface NominaDescuentosMonthData {
  weeks: (NominaDescuentosSemana | null)[];
}

export interface MeseroCut {
  id: string;
  meseroId: string;
  nombre: string;
  venta: number;
  tarjetas: number;
  transferencia: number;
  propinaTipo?: PropinaTipo;
  propina: number;
  gastosTotal: number;
  total: number;
  aplicaPropina?: boolean; // legacy field from cuts saved before propinaTipo existed
  // Montos sueltos que se sumaron ("300+450+750"), para revisarlos contra
  // los vouchers — solo si se capturó más de uno.
  tarjetasDesglose?: number[];
  transferenciaDesglose?: number[];
}

export type GastoEstado = "pendiente" | "ingresado";
export type GastoOrigen = "mesero" | "manual";

export type GastoCategoria =
  | "operacion"
  | "nomina"
  | "cortesia"
  | "retiro"
  | "mantenimiento"
  | "servicio"
  | "comida_empleado"
  | "envios"
  | "cancelaciones"
  | "otro";

export const GASTO_CATEGORIAS: { value: GastoCategoria; label: string }[] = [
  { value: "operacion", label: "Operación" },
  { value: "nomina", label: "Nómina" },
  { value: "cortesia", label: "Cortesía" },
  { value: "retiro", label: "Retiro" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "servicio", label: "Servicio" },
  { value: "comida_empleado", label: "Comida empleado" },
  { value: "envios", label: "Envíos" },
  { value: "cancelaciones", label: "Cancelaciones" },
  { value: "otro", label: "Otro" },
];

export interface Gasto {
  id: string;
  concepto: string;
  total: number;
  estado: GastoEstado;
  origen: GastoOrigen;
  meseroNombre?: string;
  meseroCutId?: string;
  categoria?: GastoCategoria;
  // A qué empleado de Personal se le descuenta este gasto de su nómina —
  // solo aplica a categoría "nomina" (adelanto) o "comida_empleado". Se
  // limpia solo si la categoría cambia a otra cosa.
  empleadoId?: string;
  // A qué mesero del catálogo se le asigna esta cancelación — solo aplica
  // a categoría "cancelaciones". Distinto de meseroCutId (que liga un
  // gasto al corte específico de un día, no al mesero como tal). Se
  // limpia solo si la categoría cambia a otra cosa.
  meseroId?: string;
}

export interface Transferencia {
  id: string;
  persona: string;
  total: number;
  origen?: "mesero";
  meseroCutId?: string;
  desglose?: number[]; // montos sueltos que se sumaron
}

export interface ProveedorCatalogEntry {
  id: string;
  nombre: string;
  // Si también se le hace un pedido parcial los jueves (para entrega el
  // viernes), aparte del pedido completo de todos los proveedores que se
  // cuenta cada domingo (Negocio > Pedidos a proveedores).
  incluyeJueves?: boolean;
}

// Catálogo de insumos de Bar/Cocina/General — el primer paso de Control de
// Bar y Control de Cocina, y de Control General (desechables, limpieza y
// demás insumos que gerencia maneja aparte, sin pertenecer a Bar ni a
// Cocina). Cada insumo puede ligarse a un proveedor (mismo catálogo de
// arriba, para no duplicar proveedores entre secciones) y marcarse de alta
// rotación para aparecer primero en el conteo diario — General no tiene
// conteo diario propio, así que esa marca no aplica ahí.
export type InsumoArea = "bar" | "cocina" | "general";

export type ConteoTextoArea = "bar" | "cocina";

// Lista base del Conteo diario de Cocina — el jefe de cocina escribe la
// cantidad después de cada ":"; la presentación ya va entre paréntesis.
export const PLANTILLA_CONTEO_COCINA = [
  "Papas a la francesa (kg): ",
  "Papas crisscut (kg): ",
  "Alitas (kg): ",
  "Pollo (kg): ",
  "Carne de hamburguesa (kg): ",
  "Carne de taco (kg): ",
  "Dedos de queso (pz): ",
  "Elotes (pz, enteros): ",
  "Pan de hamburguesa (pz): ",
  "Pan de hot dog (pz): ",
  "Tocino (kg): ",
  "Salchicha (pz): ",
  "Guacamole (bolsa): ",
].join("\n");

export interface InsumoEntry {
  id: string;
  area: InsumoArea;
  nombre: string;
  unidad: string;
  precio?: number;
  proveedorId?: string;
  altaRotacion?: boolean;
  // Presentación en que se le pide al proveedor ("caja", "bolsa"...) — puede
  // ser distinta a la del conteo (las papas se cuentan en kg y se piden por
  // caja). Sin valor, se usa la presentación del conteo.
  unidadPedido?: string;
  // Cuánto trae 1 unidadPedido en la unidad en que se cuenta (1 caja =
  // 10 kg) — para pasar lo pedido a kg/pz en Negocio > Pedidos.
  equivalenciaPedido?: number;
  // Cómo lo escriben en las notas del Inventario ("6x6", "Lyncott") cuando no
  // se parece al nombre — se guardan al ligar un renglón no reconocido.
  apodos?: string[];
}

// Inventario semanal (Negocio > Inventario) — una fila por insumo, por
// semana (mismas semanas que Corte). Domingo: cantidad de TODOS los
// proveedores. Jueves: mismo formato, pero solo de los proveedores
// marcados incluyeJueves — ambos caen dentro de la misma semana
// Lunes-Domingo, así que comparten la misma fila.
export interface InventarioFila {
  cantidad?: number;
}

export interface InventarioSemanal {
  filas: Record<string, InventarioFila>; // insumoId -> fila
}

export interface InventarioSemanalMonthData {
  weeks: (InventarioSemanal | null)[];
}

// Pedido semanal (Negocio > Pedidos) — misma estructura y semanas que
// Inventario (Completo/Jueves incluidos), pero la cantidad que se
// guarda aquí es la que se va a pedir, no la que hay en existencia. El
// panel muestra junto a cada fila la cantidad de Inventario de esa misma
// semana/modo, solo como referencia de lectura — no vive en esta fila.
export interface PedidoFila {
  cantidad?: number;
}

export interface PedidoSemanal {
  filas: Record<string, PedidoFila>; // insumoId -> fila
}

export interface PedidoSemanalMonthData {
  weeks: (PedidoSemanal | null)[];
}

// Facturas/notas de proveedores pagadas por transferencia — no son efectivo,
// no afectan ningún total de caja, y se administran aparte del corte diario
// (no viven dentro de un mes/semana/día). Categoría fija (no editable) para
// que desde ya queden listas para un futuro análisis por categoría.
export interface FacturaProveedor {
  id: string;
  proveedorId: string;
  numero: string;
  total: number;
  fecha: string; // ISO date (YYYY-MM-DD)
  estado: GastoEstado;
  categoria: "operacion";
}

export interface DayData {
  meseros: MeseroCut[];
  gastos: Gasto[];
  transferencias: Transferencia[];
  ventaApps: number;
  ventaAppsDesglose?: number[]; // montos sueltos que se sumaron
  // Historial de quién tiene/tuvo este día asignado y quién realmente
  // capturó el corte — independientes entre sí: asignadoA refleja la
  // asignación vigente (se limpia si se quita el acceso), hechoPor es un
  // registro permanente de quién guardó datos aquí, para que no se pierda
  // aunque después se le quite el acceso a esa persona.
  asignadoA?: { empleadoId: string; staffId: string; nombre: string };
  hechoPor?: { empleadoId?: string; nombre: string };
  // "Guardar corte": quien termina el corte lo confirma y desde ahí queda
  // bloqueado para el personal (el dueño siempre puede editarlo o reabrirlo).
  corteGuardado?: { fecha: string; nombre: string }; // fecha: ISO con hora
}

// Control de gastos que los proveedores dan a crédito, pagados después por
// transferencia — solo informativo: no afecta el efectivo a entregar ni
// ningún total de caja del corte. Se lleva por semana, igual que
// `efectivoReal`.
export interface CreditoProveedores {
  operativos: number;
  // Gastos fijos en transferencia. Normalmente se calculan solos (monto
  // fijo semanal − gastos en efectivo de categoría Servicio) y aquí queda
  // 0; solo se usa este número si fijosManual es true (editado con el
  // lápiz). Semanas guardadas antes de que existiera fijosManual se
  // respetan tal cual — ver resolveGastosFijos.
  fijos: number;
  fijosManual?: boolean;
  comisionDidi: number;
  comisionUber: number;
  comisionRappi: number;
}

export interface WeekData {
  days: Record<DayName, DayData>;
  efectivoReal?: number | null;
  creditoProveedores?: CreditoProveedores;
}

export interface MonthData {
  label: string;
  weeks: WeekData[];
  // Fecha real (ISO) del Lunes de la Semana 1. Se calcula sola al crear el
  // mes, pero es editable — las semanas 2-4 siempre son +7/+14/+21 días a
  // partir de esta, así que corregirla recorre el mes completo de una vez
  // y las semanas nunca quedan desalineadas entre sí.
  week1StartDate?: string;
}

export interface AppData {
  meseros: MeseroCatalogEntry[];
  empleados: EmpleadoEntry[];
  // Áreas y puestos de Personal (Equipo > Personal) — ver AreaEntry/PuestoEntry.
  areas: AreaEntry[];
  puestos: PuestoEntry[];
  proveedores: ProveedorCatalogEntry[];
  facturas: FacturaProveedor[];
  months: Record<string, MonthData>;
  // Horarios por semana, usando las mismas semanas (mes/índice) que Corte —
  // así ambas secciones comparten la misma noción de "Semana N" sin
  // duplicar la fecha ancla. Solo existe entrada para los meses/semanas
  // donde ya se capturó algo.
  horarios: Record<string, HorarioMonthData>;
  // Descuentos de nómina por semana (mismas semanas que Horarios).
  nominaDescuentos: Record<string, NominaDescuentosMonthData>;
  // Catálogo de insumos de Bar y Cocina (Negocio > Control de Bar/Cocina).
  insumos: InsumoEntry[];
  // Conteo diario de insumos de alta rotación (Control de Bar/Cocina),
  // mismo formato en ambas áreas: fecha real (ISO) -> insumoId -> cantidad.
  // Solo existe entrada para las fechas donde ya se capturó algo.
  conteosDiarios: Record<string, Record<string, number>>;
  // Conteo diario en texto libre (Control de Bar/Cocina > Conteo diario):
  // la lista tal cual la escribe el jefe de cocina/barra, por área y por
  // fecha real (ISO) -> texto.
  conteosDiariosTexto: Record<ConteoTextoArea, Record<string, string>>;
  // Cantidad a pedir que se captura junto al conteo diario en texto: por
  // área, fecha real (ISO) -> producto (nombre normalizado) -> cantidad.
  // 0 significa que ese día no se pide ese producto.
  pedidosDiarios: Record<ConteoTextoArea, Record<string, Record<string, number>>>;
  // Inventario del domingo/jueves en notas libres (Negocio > Inventario):
  // fecha real del domingo o jueves (ISO) -> texto tal cual lo escribieron.
  inventariosNotas: Record<string, string>;
  // Lo que se pide desde ese inventario: fecha -> producto (nombre
  // normalizado) -> cantidad; 0 = no se pide.
  pedidosInventario: Record<string, Record<string, number>>;
  // Inventario semanal (Negocio > Inventario, mismas semanas que
  // Corte/Horarios) — lo que hay en existencia, no lo que se pide.
  inventarioSemanal: Record<string, InventarioSemanalMonthData>;
  // Pedidos semanales (Negocio > Pedidos) — lo que se va a pedir a cada
  // proveedor, mismas semanas y Completo/Jueves que Inventario.
  pedidosSemanal: Record<string, PedidoSemanalMonthData>;
  // Monto fijo semanal de Gastos fijos (renta, servicios, etc.), con su
  // historial: cada cambio aplica desde esa semana (fecha ISO del lunes)
  // en adelante. Vacío o sin definir = MONTO_FIJO_SEMANAL_INICIAL.
  montosFijosSemanales?: MontoFijoSemanal[];
  // Meta de venta semanal (Negocio > Tendencias) — un solo monto para todas
  // las semanas.
  metaSemanal?: number;
  // Recetario (Negocio > Bar/Cocina > Recetario): las recetas que
  // captura el dueño y consulta el personal con el permiso "Recetario".
  recetas?: Receta[];
}

export interface Receta {
  id: string;
  // Recetario de Bar o de Cocina (en Cocina "vaso" se muestra como "Presentación").
  area: "bar" | "cocina";
  nombre: string;
  vaso: string;
  // Uno por renglón: "2 oz Tequila blanco" (medida y producto).
  ingredientes: string;
  // Separados por coma.
  utensilios: string;
  // Un paso por renglón.
  preparacion: string;
  notas: string;
}

export interface MontoFijoSemanal {
  desde: string;
  monto: number;
}

// Un punto de la tendencia semanal (Negocio > Tendencias) — un resumen de
// salud del negocio por cada semana ya capturada (venta, gastos, nómina,
// utilidad y margen), en orden cronológico, sin importar el mes.
export interface WeekTrendPoint {
  monthKey: string;
  weekIndex: number;
  label: string;
  weekStartDate: string;
  ventaTotal: number;
  gastoTotal: number;
  nomina: number;
  utilidad: number;
  margenPct: number;
  gastosOperativosPct: number;
  nominaPct: number;
  efectivoReal: number | null;
  efectivoEsperado: number;
}

// Proyección de venta de la próxima semana, calculada con un promedio
// ponderado (más peso a las semanas recientes) ajustado por la tendencia
// semanal promedio de la ventana usada — ver computeVentaProyeccion.
export interface VentaProyeccion {
  monto: number;
  confiable: boolean;
  semanasBase: number;
  tendenciaSemanal: number;
}

export type Role = "owner" | "staff";

// Secciones que una cuenta de equipo con PIN puede tener habilitadas más
// allá del acceso por día asignado (mesero) — ver EmpleadoEntry.staffProfileId
// y PERMISOS_DISPONIBLES. Se agregan más conforme el dueño los vaya
// necesitando, sin rehacer el checklist.
export type PermisoStaff = "horarios" | "conteo_diario" | "inventario" | "nomina" | "propinas" | "recetario";

export const PERMISOS_DISPONIBLES: { value: PermisoStaff; label: string; description: string }[] = [
  {
    value: "horarios",
    label: "Horarios",
    description: "Ver y capturar el horario semanal de su propia área (según su puesto en Personal).",
  },
  {
    value: "conteo_diario",
    label: "Conteo diario",
    description: "Capturar el conteo diario de insumos de alta rotación de su propia área (Bar o Cocina) — sin catálogo.",
  },
  {
    value: "inventario",
    label: "Inventario",
    description: "Capturar el inventario del domingo y del jueves en notas, y el pedido que sale de ahí.",
  },
  {
    value: "nomina",
    label: "Nómina",
    description: "Ver su propia nómina semanal, calculada desde Horarios — sin editar descuentos ni percepciones extra de nadie.",
  },
  {
    value: "propinas",
    label: "Propinas",
    description: "Consultar el total de propinas de cada día de la semana y cómo se reparte entre áreas — sin editar nada.",
  },
  {
    value: "recetario",
    label: "Recetario",
    description: "Consultar las recetas de bebidas: medidas, vaso, utensilios y preparación — sin editar nada.",
  },
];

export interface Profile {
  id: string;
  role: Role;
  display_name: string | null;
  owner_id: string | null;
  // Solo para cuentas de equipo dadas de alta desde Personal (no las de
  // meseros por día asignado): a qué EmpleadoEntry corresponden (para
  // saber su puesto/área) y qué secciones tienen habilitadas.
  empleado_id?: string | null;
  permisos?: PermisoStaff[];
}

export interface StaffAssignment {
  id: string;
  staff_id: string;
  assigned_date: string; // ISO date (YYYY-MM-DD)
  // A qué pestaña "Semana N" del corte corresponde (0-3). Lo elige el dueño
  // al asignar, porque las semanas del corte son manuales y no siempre
  // coinciden con un cálculo automático por fecha. Nulo en asignaciones
  // guardadas antes de que existiera este campo.
  week_index: number | null;
}
