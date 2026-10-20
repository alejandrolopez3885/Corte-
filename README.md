# Cortes

App para llevar el corte de caja diario de un restaurante: por mesero (venta,
tarjetas, propina, gastos y transferencias), organizado por mes → semana →
día, con resúmenes semanales y conciliación de efectivo. Cada mes tiene una
sola fecha ancla real (el Lunes de la Semana 1) — calculada sola al crear el
mes, pero corregible desde el resumen semanal — a partir de la cual se
calculan las 4 semanas (siempre +7/+14/+21 días, nunca se desalinean entre
sí). Así todo el corte (chips de día, encabezados, tablas) siempre muestra
la fecha real (día, mes y año) en vez de solo el nombre del día — y si una
semana se asoma al mes anterior o siguiente, se muestra tal cual, con su
fecha exacta. También tiene, dentro de "Negocio" → "Control de gastos", dos
pantallas de solo control (cada una con su propio selector de mes/semana):
**Control de gastos en efectivo** (los gastos ya categorizados que capturas
en el corte diario) y **Control de gastos en transferencia** — 5 totales
fijos por semana: gastos operativos en transferencia, gastos fijos,
comisión DIDI, comisión UBER y comisión RAPPI. Esta última vive totalmente
separada del corte diario: es solo informativa, no afecta el efectivo ni
ningún total de caja.

**Gastos fijos** se llena solo y queda bloqueado: es el monto fijo semanal
($24,500 de inicio) menos los gastos en efectivo de esa semana con
categoría **Servicio** (luz, gas, teléfono, agua, internet...). Así lo
pagado en efectivo más lo pagado por transferencia siempre suman el monto
fijo — ej. si se pagaron $500 de teléfono en efectivo, Gastos fijos queda
en $24,000. Debajo se ve el desglose (monto fijo − cada Servicio en
efectivo, con su nombre y día — ej. "− Teléfono · Mar 14" = Gastos fijos en
transferencia) y se recalcula solo cada vez que
se agrega, cambia o mueve un gasto de Servicio, sin tener que entrar a
guardar. Con el lápiz se cambia el número solo para esa semana: queda
marcado "editado a mano" y se puede "Volver al automático"; abajo se siguen
listando, como referencia, los Servicios pagados en efectivo esa semana. "Cambiar" el
monto fijo semanal aplica desde esa semana en adelante (las semanas
anteriores se quedan con el monto que tenían). Las semanas que ya tenían
Gastos fijos guardado antes de este cambio se quedan con su número, como
"editado a mano", para no mover resultados pasados; las semanas sin nada
guardado en Control de gastos en transferencia toman el automático.

Desde **Control de gastos en efectivo** también se puede mover un gasto de
un día a otro dentro de la misma semana (botón "Mover a..." en cada gasto),
sin perder su historial (mismo id, categoría y estado). Si el gasto estaba
restado del corte de un mesero ese día, al moverlo se desliga de ese corte y
el total de ese mesero en el día de origen se recalcula sumando de vuelta
el monto — para que el corte diario no quede desacomodado. El gasto llega
al día destino como un gasto suelto (sin ligar a ningún mesero).

También desde ahí se puede editar el concepto y el monto de un gasto —
oculto detrás de un botón de editar (lápiz), para que no se cambie por
accidente. Es el mismo registro que el corte diario (mismo id), así que el
cambio se refleja ahí directo, sin ningún paso extra. Si el gasto estaba
restado del corte de un mesero ese día, el cambio en el monto se traslada a
ese corte (se ajustan sus gastos y su total) — a diferencia de mover un
gasto de día, aquí el gasto se queda ligado al mismo mesero.

Arriba de esa pantalla hay una **búsqueda de tickets**, pensada para el
final de la semana: con el ticket físico en la mano se busca el gasto y
ahí mismo se revisa y se corrige, sin cambiar de sección. Solo busca en la
semana elegida (nunca muestra nada de otras semanas). Tiene dos cuadros que
se usan uno u otro — mientras uno tiene algo escrito, el otro queda
desactivado:

- **Nombre, proveedor, día**: se escribe por ejemplo `coca jueves` o
  `coca 16` — el día puede ir con nombre (`jueves`, `jue`) o con el número
  del día del mes, siempre que caiga en la semana elegida (si no, se avisa
  y se busca en toda la semana). La búsqueda no distingue mayúsculas,
  acentos, guiones ni el orden de las palabras, y tolera errores chicos de
  escritura (`cocacola`, `coliflr`, `walmart coliflor` encuentra
  "Coliflor (Walmart)"). Solo con el día (`jueves`) muestra todos los
  gastos de ese día.
  - Si el gasto está ese día, sale con su monto, categoría y estado.
  - Si no está ese día pero sí en otros de la semana, salen esos: los
    **Pendientes** con el botón "Mover a jueves" (puede ser el mismo ticket
    capturado en otro día — se mueve el mismo gasto, no se duplica) y los
    **Ingresados** atenuados, porque su comprobante ya se subió y no pueden
    ser ese ticket.
  - Si no hay ninguno igual, se muestran los más parecidos ("¿Será alguno
    de estos?").
  - Siempre hay un botón "Ninguno es — agregar nuevo gasto el jueves", y si
    no se encontró nada parecido el formulario sale abierto de una vez: los
    mismos campos que el gasto de Corte, con el día ya puesto (o para
    elegirlo, si no se escribió) y el nombre escrito bien.
  - Abajo, el total de ese gasto en la semana ("Coca Cola esta semana: 3
    gastos · $362.00").
- **Monto**: muestra todos los gastos de la semana con ese monto exacto;
  si no hay ninguno, ofrece los montos más cercanos para tocarlos.

En cada resultado se puede confirmar (Ingresado), elegir la categoría,
editar concepto y monto (lápiz) y moverlo de día — con las mismas reglas
que el listado de abajo. Desde la búsqueda nunca se borra un gasto. Al
confirmar, mover o agregar, la búsqueda se limpia sola, lista para el
siguiente ticket.

**Autocompletado del concepto**: en todos los lugares donde se escribe el
nombre de un gasto (Nuevo gasto en Corte, gastos dentro del corte de un
mesero, editar y agregar desde la búsqueda) se sugieren los nombres que ya
existen en el historial de gastos, el más usado arriba y con su forma bien
escrita (las variantes "coca cola", "Coca-Cola" y "cocacola" se juntan en
la más usada). Si el nombre es nuevo, se revisa la ortografía con
LanguageTool (servicio gratis, sin clave) más una lista propia de marcas,
tiendas y productos comunes, y aparece "¿Quisiste decir …?". Nunca se
cambia el texto solo: siempre hay que tocar la sugerencia. Si LanguageTool
no responde, simplemente no aparece la sugerencia de ortografía; el
autocompletado del historial funciona igual.

Al capturar un corte, "Guardar corte" avisa arriba del botón si falta
elegir el mesero (o la venta), con el selector marcado en rojo; y al
guardar un gasto en efectivo la categoría es obligatoria ("Es importante
seleccionar la categoría") — lo demás que es opcional no pide nada. Los
campos donde se suman varios montos (tarjetas y transferencia del mesero,
transferencias, ventas de apps, efectivo real y el control de gastos en
transferencia) tienen un botón "+" junto al campo, porque el teclado
numérico del celular no tiene coma: se escribe "300", "+", "450"… y
debajo se ve la suma en vivo ("= $875.50 · 3 montos"); al salir del campo
queda solo el total. Desde computadora también se puede separar con coma. Los
montos sueltos que se sumaron se guardan junto con el total (tarjetas y
transferencia del mesero, transferencias y ventas de apps), para poder
revisarlos contra los vouchers.

En Corte, debajo de "Asignado a…", el dueño tiene "Historial de este día
(N cambios)": todo lo registrado sobre ese día del corte — quién, a qué
hora y qué montos. Al agregar el corte de un mesero queda anotado completo
(venta, tarjetas con sus montos sueltos, transferencia, propina, gastos y
entrega); al editarlo, solo lo que cambió, antes → después. Lo mismo se ve
en Negocio > Análisis > Actividad.

- **Frontend**: React + Vite + TypeScript.
- **Backend**: Supabase (Auth + Postgres).
- **Hosting sugerido**: Vercel.

La vista del dueño se organiza en 4 secciones, accesibles desde la barra de
navegación de abajo — tocar una pestaña siempre regresa al inicio de esa
sección, aunque ya estés adentro de una de sus páginas (ej. tocar "Equipo"
estando en Nómina te regresa al menú de Equipo):

- **Corte**: la pantalla principal — mes, semana, día, meseros, gastos,
  transferencias, ventas de apps y sus resúmenes. Arriba de los totales del
  día hay una tarjeta de asignación: quién tiene asignado ese día (si
  alguien) y quién capturó su corte — ver "Asignar día" más abajo.
- **Equipo**: menú con 5 opciones — "Meseros" (catálogo de
  meseros — solo nombre, para elegir a quién le haces el corte en Corte;
  vive aquí porque también son parte de tu equipo, aunque su lista está
  separada de Personal), y como páginas propias "Personal" (la lista de tu
  personal — nombre, sueldo diario y un puesto opcional (Gerente, Mesero,
  Cocinero, ...); la lista se agrupa sola por área según el puesto de cada
  quien. Áreas y puestos son catálogos editables — arrancan con Gerencia
  (Gerente, Subgerente), Piso (Barra, Mesero, Calidad) y Cocina (Jefe de
  cocina, Cocinero) como punto de partida, y se puede crear un puesto
  nuevo (y de paso un área nueva, si hace falta) al vuelo desde el propio
  empleado, igual que un insumo puede crear su proveedor al vuelo. Se
  agrega con un botón "+" en vez de tener el formulario siempre abierto,
  y tocar a alguien lo abre para editar o eliminar. Desde ahí mismo, un
  bloque "Acceso a la app" permite darle a esa persona su propia cuenta
  con PIN, marcando un checklist de qué secciones puede usar: hoy
  existen "Horarios", "Conteo diario" (captura el conteo diario de
  insumos de alta rotación de Bar o Cocina, sin acceso al Catálogo —
  igual que puede hacerlo el dueño desde Control de Bar/Cocina, pero sin
  poder editar productos, precios ni proveedores) y "Nómina" (ve su
  propia nómina semanal, calculada igual que la del dueño, con su "A
  recibir hasta hoy" resaltado y el cierre de semana discreto, pero de solo
  lectura — sin poder agregar ni quitar descuentos o percepciones extra
  de nadie, y sin ver si ya se le pagó — ver el desglose más abajo, en
  la propia sección "Nómina") y "Propinas" (la misma pantalla de
  consulta que ve el dueño en Equipo > Propinas — totales del día de toda
  la semana y su reparto por área, sin poder editar nada; no se acota por
  área ni por persona). Cada permiso se acota distinto: "Horarios" usa el área de
  Personal del puesto (Gerencia/Piso/Cocina) y muestra el horario
  completo de esa área (todo el personal de Piso, o todo el de Cocina,
  no solo su propia fila); "Conteo diario" usa el catálogo de insumos
  (Bar/Cocina/General) en vez del área de Personal, porque no son la
  misma clasificación — un puesto de "Barra" vive bajo el área de
  Personal "Piso", pero sus insumos son los de Bar, así que ese permiso
  se resuelve por el nombre del puesto (Barra → Bar, Cocinero/Jefe de
  cocina → Cocina), no por su área; el checklist ya muestra la etiqueta
  correcta ("Conteo diario de Bar") y lo deja deshabilitado si el puesto
  actual no aplica a ninguna de las dos. "Nómina" es individual (no por
  área): cada quien ve solo su propia fila del reporte, aunque igual
  necesita tener un puesto asignado (de ahí sale su sueldo diario).
  Dentro de "Horarios" hay además otra capa de permiso, fija y no
  editable desde el checklist: solo el dueño y el puesto "Jefe de
  cocina" pueden capturar/editar el horario y descargar su imagen —
  cualquier otro puesto con este permiso (mesero, barra, etc.) solo
  puede verlo, sin poder tocar las celdas, agregar/quitar personal,
  guardar ni descargar nada.
  Sin puesto asignado, ninguno de estos permisos se
  puede habilitar (aunque igual puede tener acceso a "Corte", que no
  depende de un puesto — ver **Asignar día** más abajo).
  Al entrar con su PIN, esa persona no ve las pestañas
  normales de la app: con una sola sección habilitada en total (contando
  Corte) va directo a ella (ej.
  Horarios, mostrando toda su área — Cocina para un jefe de cocina — y
  solo puede agregar a esa misma área; Conteo diario, mostrando solo los
  insumos de alta rotación de Bar o Cocina según su puesto; Nómina,
  mostrando solo su propia fila; o Corte, mostrando la lista de días que
  tiene asignados); con dos o más secciones habilitadas,
  primero ve un menú de inicio para elegir cuál abrir, con un botón para
  volver a ese menú desde cada sección. El PIN no
  se puede cambiar una vez creado (no hay forma de hacerlo sin la clave de
  servicio de Supabase, que esta app no usa) — si hace falta uno nuevo,
  se quita el acceso desde el mismo bloque y se vuelve a dar de alta),
  "Horarios" (arma el horario
  semanal en dos áreas fijas, PISO y COCINA — no se pueden crear, renombrar
  ni borrar áreas — usando las mismas semanas de Corte; un toque en la
  celda cicla OFF → O → X → Z, y al llegar a Z se abre un modal para
  capturar una hora de entrada en su lugar; al abrir una semana nueva se
  precarga con la última semana capturada para solo ajustar lo que cambió,
  pero ya no se guarda solo — hay un botón "Guardar horario" y, en cuanto
  se guarda, la semana queda bloqueada para evitar ediciones accidentales,
  igual que Conteo diario e Inventario, para tener un historial real por
  semana. Ahí mismo se pueden marcar uno o más días como "festivo" —
  específico de esa semana, no se precarga de la semana anterior — y a
  quien trabaje ese día (cualquier valor salvo OFF) se le paga 1 turno
  extra además de lo que le tocaba; el descanso pagado en un día festivo
  no cuenta como trabajado, así que no recibe el extra. En cuanto un
  horario queda guardado aparecen botones "Copiar imagen · Piso" /
  "Copiar imagen · Cocina" / "Copiar imagen · Las 2 áreas" (solo los que
  aplican — si un área no tiene personal capturado, no sale su botón) que
  generan un PNG con esa parte del horario, agrupado por área igual que
  la hoja de cálculo que se usaba antes para esto, y lo copian al
  portapapeles para pegarlo directo en el chat de WhatsApp de cada
  encargado de área — igual que la imagen de Nómina: el botón tocado
  cambia unos segundos a "¡Copiada! Pégala en WhatsApp", y si el
  navegador no permite copiar imágenes, el PNG se descarga como antes con
  el aviso "Tu navegador no permite copiar imágenes — se descargó el
  PNG")
  y "Nómina" (calculada sola a partir de Horarios y el sueldo diario de
  cada quien: Z paga doble, O/X y cualquier hora capturada pagan 1x, el
  descanso OFF solo se paga si esa semana se trabajaron los otros 6 días
  — el sueldo semanal completo, sueldo diario × 7, solo se alcanza así —,
  y un día festivo marcado en Horarios suma 1 turno extra a quien lo
  trabajó (se ve resaltado en la celda de ese día). Ahí mismo, por
  persona, se capturan descuentos itemizados — tardanza, adelanto de
  efectivo, comida u otro, cada uno con su propio concepto y monto — y
  percepciones extra itemizadas — finiquito, bono u otro, que solo
  existen en la semana donde se capturan, no se repiten. Un gasto del
  corte diario categorizado "Nómina" o
  "Comida empleado" también se puede vincular a un empleado de Personal —
  por ejemplo, un adelanto que sale del corte de otra persona —, y ese
  gasto aparece solo como descuento en la nómina del empleado elegido,
  marcado "(Corte)" y sin poder borrarse desde ahí — se edita o se quita
  desde el gasto mismo en Corte.
  La pantalla resalta lo que se debe **hasta hoy**, no la semana
  completa: "Generada hasta hoy" es el bruto acumulado solo de los días
  de esa semana cuya fecha ya pasó o es hoy (en una semana ya cerrada
  equivale al bruto completo, y en una futura es $0), y "A recibir hasta
  hoy" = generada hasta hoy + percepciones extra − descuentos. Arriba de
  todo, debajo del selector y la fecha de la semana, el botón "Copiar
  imagen de la nómina" (ver más abajo), y luego un resumen con el **Total a pagar hasta
  hoy** de todo el personal (resaltado), y debajo de él la generada hasta
  hoy, las percepciones extra (si hay) y los descuentos. En la vista del
  dueño las tarjetas del personal son plegables y arrancan cerradas:
  cerrada, cada persona es una sola fila con su nombre, su etiqueta
  Pendiente/Pagada, lo que le toca "A recibir hasta hoy" y una
  flechita; tocar la fila la abre (o la cierra) y se pueden tener varias
  abiertas a la vez. La vista del empleado siempre muestra su tarjeta
  abierta. Abierta, en la tarjeta de
  cada quien: nombre (con su etiqueta Pendiente/Pagada), área,
  sueldo diario y días trabajados; un recuadro verde con **A recibir
  hasta hoy** en grande y su cuenta debajo — la generada hasta hoy, cada
  percepción extra (+) y cada descuento (-), con su botón para quitarlo
  (salvo los que vienen del Corte) —; las 7 casillas de la semana con el
  código del horario y el monto de cada día; los botones para agregar
  percepción extra o descuento; y al final, discreta en gris, la línea
  "Al cierre de la semana (según horario)" con el neto de la semana
  completa. Hasta abajo de la página (solo el dueño), primero el control
  de pagos (cuántos ya están pagados, total pagado y restante por pagar,
  calculados sobre lo que se debe hasta hoy — ver "Control de pagos" más
  abajo) y después el bloque
  "Cómo se paga al cierre de la semana": Nómina bruto, Descuentos
  (adelantos, comidas, retardos), Percepciones extra (vacaciones,
  finiquito, bonos, etc.), **Neto a pagar** (resaltado), **Nómina en
  efectivo** — el "Efectivo recibido (calculado)" del resumen semanal de
  Corte de esa misma semana, o sea lo que debe haber según el corte, no
  el efectivo real que se contó; los adelantos que salieron del corte ya
  vienen restados ahí como gasto — y **Nómina en transferencia** (neto a
  pagar − nómina en efectivo). Si el efectivo alcanza para todo el neto,
  la nómina en efectivo es el neto completo y la transferencia queda en
  $0.00 (y si el efectivo calculado sale negativo, se toma como $0.00)).
  A diferencia de Horarios (que tiene una imagen por área), aquí hay un
  solo botón, "Copiar imagen de la nómina", que genera un PNG con la
  nómina de la semana de todo el personal (todas las áreas) sin
  descuentos (bruto + percepciones extra si las hay, marcadas con un
  asterisco), agrupada por área con subtotales y un total general al
  final, imitando la hoja de cálculo que se usaba antes para esto — y lo
  copia al portapapeles para pegarlo directo en el chat de WhatsApp. Al
  copiarla, el botón cambia unos segundos a "¡Copiada! Pégala en
  WhatsApp"; si el navegador no permite copiar imágenes, el PNG se
  descarga como antes y aparece el aviso "Tu navegador no permite copiar
  imágenes — se descargó el PNG". Solo en esa imagen el número
  de semana es el de la semana del año (ISO), no el "Semana 1"-"4" del
  mes que se usa en toda la app — ej. la semana del 14 al 20 de
  septiembre se ve ahí como "Semana 38".

  Control de pagos: en Equipo > Nómina (solo el dueño), junto al nombre
  de cada quien hay una etiqueta que se toca — por defecto dice
  "Pendiente" (gris); un toque la cambia a "✓ Pagada" (verde) para marcar
  que ya le pagaste esa semana, y otro toque la regresa a "Pendiente".
  Al marcarla se guarda lo que le tocaba en ese momento (su "A recibir
  hasta hoy") y la etiqueta lo muestra ("✓ Pagada $2,000.00"); si
  después trabaja más días, la etiqueta se queda con lo que se le pagó y
  la diferencia sigue en el restante por pagar. Regresarla a "Pendiente"
  borra ese monto.
  Funciona con la tarjeta cerrada: tocar la etiqueta no abre ni cierra la
  tarjeta. Al final de la página, el apartado de pagos muestra "Ya
  pagados" ("2 de 5"), el total pagado (la suma de lo que se guardó al
  marcar a cada quien) y el restante por pagar (total a pagar hasta hoy −
  total pagado; al cierre de la semana, si ya se le pagó todo a todos,
  queda en $0) — para
  llevar el control de a quién ya le entregaste su pago. Es
  independiente de los descuentos/percepciones extra y no bloquea que
  sigas editando esa nómina. El empleado ya no confirma nada desde su
  cuenta (se quitó el botón "Recibí mi nómina correcta") ni ve este
  estado; las confirmaciones que se hicieron antes con ese botón cuentan
  como "Pagada" y, como no tienen monto guardado, toman lo que le toca
  hasta hoy hasta que se vuelvan a marcar.
  Personal
  sigue siendo una lista aparte del catálogo de Meseros — este es solo
  nombre, sin sueldo, para el corte.

  **Propinas** (Equipo > Propinas): pantalla de solo consulta, con el
  mismo selector de mes y semana que Nómina ("Semana 1" a "4" dentro del
  mes, como el resto de la app), y abajo el rango de fechas de esa semana
  (ej. "12 – 18 oct"). Debajo, la lista de lunes a
  domingo, cada día con su fecha y el total de propinas de ese día (la
  suma de las propinas de todos los cortes de meseros de ese día; sin
  desglose por mesero — un día sin corte sale en $0.00, en gris), y al
  final el "Total semana". Debajo del total, un bloque "Cómo se reparte
  (solo informativo)" con la parte de cada área, cada una con su color:
  Cocina 1% (naranja), Barra 1% (azul) y Gerencia 1% (verde) — cada una
  es un tercio del total de la semana (el 1% de la propina de 3%); si al
  dividir sobra un centavo se lo lleva Gerencia, para que las tres sumen
  exactamente el total. No afecta el corte, la nómina ni ningún otro
  total. Una cuenta de equipo con el permiso "Propinas" ve esta misma
  pantalla en su menú de inicio.

  **Asignar día**: desde el propio Corte diario (arriba de los totales del
  día) el dueño puede asignar ese día a alguien de Personal que ya tenga
  "Acceso a la app" creado — no crea una cuenta nueva, solo elige entre
  quienes ya la tienen. A esa persona le aparece "Corte" como una sección
  más en su cuenta (junto a Horarios/Conteo diario/Inventario/Nómina/Propinas si también las
  tiene), acotada solo a los días que le hayan asignado; ahí entra
  igual que el dueño a capturar meseros, gastos, transferencias y ventas
  de apps de ese día. La tarjeta de asignación en Corte diario muestra
  "Asignado a" (se puede cambiar a otra persona o quitar) y, por separado,
  "Corte hecho por" — un registro que se guarda solo, la primera vez que
  esa persona guarda algo en ese día, y que ya no se borra aunque después
  se le quite el acceso o se reasigne el día a alguien más — así el corte
  diario conserva el historial de quién lo hizo, aparte de quién lo tiene
  asignado ahora.
- **Negocio**: catálogo de proveedores (nombre y la
  marca de "también se pide los jueves" — el mismo proveedor que se elige
  en el Catálogo de Bar/Cocina y que agrupa la lista en Inventario; no se
  puede eliminar un proveedor mientras tenga algún insumo asignado, para
  no perder esa referencia ni el historial ya guardado en Inventario);
  agrupadas bajo "Control de gastos",
  Control de gastos en efectivo y Control de gastos en transferencia; y
  bajo "Análisis", "Tendencias" — cómo va
  el negocio, por fecha real (semanas de lunes a domingo): **venta hasta
  hoy** de la semana en curso contra los mismos días de la semana pasada y
  contra el promedio de esos días en las últimas 4 semanas (el día de hoy
  cuenta solo si ya tiene corte); **¿cómo cerraría la semana?**, con dos
  proyecciones — al ritmo actual (lo que llevas ÷ lo que suelen pesar esos
  días en tu semana) e histórica (lo que llevas + el promedio de los días
  que faltan) —, una barra de avance y cuánto falta para igualar la semana
  pasada; **día a día** contra el mismo día de la semana pasada (los que
  faltan, estimados y punteados); **semanas** con su % contra la anterior,
  promedio y mejor semana (la actual, estimada); **venta promedio por día
  de la semana** (mejor y peor día) y **cómo se cobra** (% en tarjetas y en
  apps contra la semana pasada). Debajo, los resultados por semana ya
  cerrada (venta, utilidad, margen, gastos y nómina, con su cambio y
  minigráfica, gráfica y tabla) — la semana en curso ya no entra ahí, para
  que no parezca una caída solo porque no ha terminado; también bajo "Análisis", "Actividad" — la
  bitácora de toda la app, ordenada en tres pestañas y por semana (con
  flechas para ir a semanas anteriores): **Resumen** (cuántos cambios,
  personas activas e inicios de sesión, comparado con la semana anterior;
  "Para revisar": cosas eliminadas, cambios entre 2 y 6 a.m. y cambios a
  cortes/conteos de días anteriores, cada uno con "Ver ›" al historial ya
  filtrado; cambios por día; pantallas más abiertas y cuáles nadie abrió;
  secciones con más cambios), **Personas** (cada quien con su último uso,
  cuántos cambios y qué secciones usa; al tocarla, a qué horas usa la app,
  sus sesiones y "Ver su historial") e **Historial** (cada cambio con quién,
  hora, dónde y qué — antes tachado → después, o qué se agregó/eliminó —,
  búsqueda por texto y chips por sección, Sesiones, Pantallas y Solo
  eliminaciones). Se registra cada guardado de cualquier sección, cada
  inicio y cierre de sesión, los cambios de cuentas y permisos del equipo y
  qué pantalla abre cada quien (solo el nombre de la pantalla). Solo lo ve
  el dueño. Vive en su propia tabla de Supabase (`bitacora`: correr una vez
  `supabase/migration_007_bitacora.sql` y `supabase/migration_008_bitacora_actividad.sql`)
  en la que solo se pueden agregar renglones: nadie puede editarla ni
  borrarla desde la app. Lo anterior a activarla se puede recuperar en
  parte con `supabase/rellenar_historial.sql`; bajo "Bar", "Control de Bar"; y bajo "Cocina", "Control de
  Cocina" — las dos abren primero a un menú propio (para poder ir sumando
  ahí compras como opción hermana más adelante), con dos piezas
  construidas, en este orden: "Conteo diario" primero — un recuadro de
  texto con la lista de productos de alta rotación, cada uno con su
  presentación entre paréntesis ("Pollo (kg): ", "Elotes (pz, enteros): ",
  "Guacamole (bolsa): "), donde el jefe de cocina/barra solo escribe la
  cantidad después de cada ":" — igual que la nota que llevaba en su chat
  de WhatsApp. En Cocina la lista es fija (Papas a la francesa, Papas
  crisscut, Alitas, Pollo, Carne de hamburguesa, Carne de taco, Dedos de
  queso, Elotes, Pan de hamburguesa, Pan de hot dog, Tocino, Salchicha y
  Guacamole); en Bar se arma con los insumos marcados de alta rotación en
  su catálogo. Se guarda el texto tal cual, por área y por fecha real, con
  los mismos filtros de Mes/Semana y chips de día que Corte. La lista de
  insumos con un campo por producto queda oculta por ahora (por eso los
  insumos de alta rotación de Inventario no reciben valores nuevos desde
  aquí). Al tocar "Guardar conteo" se revisa cada línea: si a algún
  producto le falta la cantidad, o trae algo que no sea solo un número
  (ej. "5kg" o "dos" — la presentación ya va entre paréntesis), aparece
  un aviso con esos productos y no se guarda hasta corregirlos (si no
  hay, se pone 0). En Bar, por ahora no se hace pedido desde aquí: ya
  guardado el conteo, debajo del texto solo aparece la lista "Conteo del
  día" con cada producto y su cantidad contada (con su presentación), en
  el mismo orden del texto, de solo lectura — sin recuadros de "Pedir",
  sin "Copiar pedido" ni "Guardar pedido"; lo único editable sigue siendo
  el texto de arriba (con "Editar"), y al volver a guardarlo la lista se
  actualiza sola. En Cocina, ya guardado, debajo del texto aparece la lista
  separada por proveedor con cada cantidad: cada producto se busca por
  su nombre en el catálogo del área (sin importar mayúsculas ni acentos)
  y toma el proveedor que tenga asignado ahí; lo que no está en el
  catálogo o no tiene proveedor cae en "Sin proveedor". Cada fila
  muestra la cantidad contada con su presentación al lado ("Dedos de
  queso … 9 pz") y un recuadro "Pedir" para escribir ahí mismo cuánto
  pedir; se guarda con "Guardar pedido" (por área y fecha, aparte del
  conteo): si algún recuadro queda vacío o no es solo un número aparece
  el mismo aviso y no se guarda, y 0 significa que ese día no se pide
  ese producto. Ya guardado, el pedido queda bloqueado hasta tocar
  "Editar pedido". Junto a cada recuadro va la presentación en que se
  pide: la del campo "Se pide por" del Catálogo (ej. las papas se cuentan
  en kg y se piden por caja) o, si no tiene, la misma del conteo. Al final
  de cada proveedor (guardado o no el pedido) hay un botón "Copiar pedido
  [proveedor]" que copia al portapapeles el mensaje para WhatsApp —
  "Metroplex" (quién pide) y un renglón por producto con pedido mayor a 0
  ("Papas a la francesa 1 caja", "Papas crisscut 2 cajas" — la
  presentación va en plural cuando no es 1, salvo abreviaturas como kg o
  pz). El botón no cambia, para poder copiar
  las veces que sea; solo aparece abajo un aviso discreto "✓ Pedido
  copiado" que se quita solo a los 2 segundos. En cuanto se
  guarda, el texto queda bloqueado; para corregirlo
  hay que tocar "Editar", confirmar un aviso, y recién
  ahí se desbloquea) y "Catálogo" después: cada insumo tiene nombre, un
  precio de referencia opcional y un proveedor opcional (el mismo
  catálogo de proveedores en ambas áreas, y se puede crear uno nuevo al
  vuelo desde el propio insumo), agrupados en la lista por proveedor, y
  una marca de "alta rotación" para que aparezca en el Conteo diario. Opcional,
  "Se pide por": la presentación en que se le pide al proveedor (caja,
  bolsa, kg, pz…). Si es distinta a la unidad en que se cuenta,
  aparece "¿Cuánto trae 1 [esa presentación]?" para convertir lo pedido a
  kg/pz en Pedidos. La
  unidad de medida es un selector con solo dos opciones, Kg o Pieza — en
  Cocina se elige libremente (Kg por default), y en Bar queda fijo en
  Pieza y el selector se ve bloqueado, porque ahí siempre se cuenta por
  pieza; bajo "General", "Control General" — mismo Catálogo (nombre,
  unidad libre entre Kg/Pieza, precio, proveedor), pero sin Conteo diario
  ni la marca de "alta rotación" (que no aplica sin conteo diario propio):
  abre directo al catálogo, sin menú intermedio, porque es su única
  función. Es para insumos que gerencia maneja aparte, sin ser de Bar ni
  de Cocina — desechables, limpieza y similares; y bajo "Compras", "Inventario" — el conteo completo del domingo y el
  parcial del jueves (switch "Completo (domingo)" / "Jueves"), en notas
  libres: el cuadro arranca vacío y quien cuenta escribe lo que va viendo,
  un producto por renglón y como le salga (".6 consomé", "1k ajo en
  polvo", "500 bolsas Johnster", "250 gms habanero"). Se guarda por la
  fecha real del domingo o jueves de esa semana; un renglón con texto pero
  sin número no deja guardar. Al tocar "Guardar inventario" también se
  revisa qué productos del catálogo tocaba contar ese día (todos el
  domingo; el jueves, solo los de proveedores marcados; sin los de alta
  rotación) y no aparecen en las notas: si falta alguno, sale el aviso
  "Faltan por contar" con esos productos separados por proveedor, cada uno
  con su casilla, todas marcadas de inicio. "No hay — guardar marcados en
  0" guarda y agrega al final de las notas un renglón "0 [producto]" por
  cada marcado (ej. "0 Zanahoria"), para que salgan en la lista de abajo
  con conteo 0 y su recuadro "Pedir" — así el pedido sale completo aunque
  no se haya anotado lo que no había. Lo que se desmarca (porque sí hay y
  solo faltó anotarlo) no se agrega y queda en "No se contaron"; si se
  desmarca todo, el botón dice "Guardar sin los que faltan". "Volver a
  contar" cierra el aviso sin guardar. Si no falta nada, se guarda
  directo. Ya guardado (y bloqueado, con "Editar" igual
  que el Conteo diario), cada renglón se lee — cantidad, unidad si la
  escribió (k/kg, gms, paq, bolsa…) y nombre — y se busca en el catálogo
  de Bar, Cocina y General por nombre o apodo, aunque esté abreviado, en
  otro orden o en plural. Lo que no se reconoce (o tiene más de un
  posible) aparece arriba en "No reconocidos" para elegir qué producto es
  una sola vez: lo escrito se guarda como apodo de ese insumo y la
  próxima vez sale solo. Lo reconocido se muestra separado por proveedor
  con el mismo recuadro "Pedir", "Copiar pedido [proveedor]" y "Guardar
  pedido" del Conteo diario (si un producto se anotó dos veces, se ven
  juntas las dos cantidades). Al final, plegable, "No se contaron": los
  productos del catálogo que tocaba contar ese día (todos el domingo; el
  jueves, solo los de proveedores marcados) y no aparecen en las notas,
  sin contar los de alta rotación, que van en el Conteo diario (lo que se
  marcó como "no hay" al guardar ya no sale aquí). También
  existe como permiso "Inventario" en "Acceso a la app", para que el jefe
  de cocina lo capture desde su cuenta; y "Pedidos" — solo consulta: el
  total de lo pedido en la semana elegida (hasta hoy), sumando lo guardado
  con "Guardar pedido" en el Conteo diario de Cocina (lunes a domingo;
  Bar ya no captura pedido ahí, aunque los que se hayan guardado antes
  siguen contando)
  y en el Inventario del jueves y del domingo, separado por proveedor y
  producto. Debajo de cada producto se ve de dónde salió ("Lun 1 · Jue 2 ·
  Inv. Jue 1"). El total se pasa a la unidad en que se cuenta el producto
  (kg, o pz para lo que se cuenta por pieza) con la equivalencia del
  Catálogo — "¿Cuánto trae 1 [Se pide por]?", ej. 1 caja = 10 kg —, para
  que cuadre con el inventario inicial y final: 4 cajas × 10 kg = 40 kg. Si
  a un producto le falta esa equivalencia, se queda en su presentación y
  se marca en naranja. Arriba, qué días ya tienen pedido guardado (y aviso
  de los que ya pasaron sin él). Con Mes/Semana se ve cualquier semana
  anterior. La captura semanal que vivía antes aquí se quitó
- **Dashboard**: reporte de resultados de la semana, solo para leer (con
  porcentajes sobre la venta total): Venta total, Gastos operativos (suma
  los de efectivo categorizados como Operación más los de transferencia),
  Gastos fijos (desplegable: lo pagado en transferencia más los gastos en
  efectivo categorizados como Servicio, con cada uno listado por nombre,
  día y monto — siempre suman el monto fijo semanal, salvo que se haya
  editado a mano), las 3 comisiones de apps, el
  resto de categorías de gastos en efectivo desglosadas una por una
  (Nómina, Cortesía, Retiro,
  Mantenimiento, Comida empleado, Envíos, Cancelaciones — con su propio
  desglose por mesero, nombre y total de la semana, porque un gasto de
  Cancelaciones en Corte se le puede asignar a un mesero del catálogo —,
  Otro, Sin categoría) y Nómina "(hasta hoy)" (el bruto de Equipo > Nómina
  generado solo hasta hoy en esa semana — no la semana completa, para que
  el reporte sea en tiempo real —, sin restar los descuentos, con un link
  directo al desglose) — y al final la Utilidad (Venta
  total menos todo lo anterior).

  Los números se pintan en verde/rojo/neutro según qué tan bien le fue al
  negocio esa semana, no solo con texto: Gastos operativos tiene una meta
  fija de 42% o menos de la venta — verde si la cumple, rojo si se pasó —,
  y Utilidad se pinta verde si es positiva o rojo si no (con toda la fila
  resaltada, no solo el número). El resto de las filas son informativas y
  se quedan en el color neutro de siempre — no tienen una meta buena/mala
  definida. Arriba del reporte hay un botón "Descargar imagen" que genera
  y descarga un PNG con este mismo resultado (mismos colores, para que se
  note de un vistazo si algo se salió de la meta) — pensado para enviarlo
  por WhatsApp, igual que las imágenes de Horarios y Nómina.

Hay 2 tipos de cuenta:

- **Dueño (`owner`)**: acceso completo — todos los meses, semanas y días,
  catálogo de meseros, resúmenes. Inicia sesión con correo y contraseña.
- **Staff (`staff`)**: una cuenta de equipo, dada de alta **desde Equipo >
  Personal** (nombre + PIN de 4 dígitos, sin correo — ver "Acceso a la
  app" más arriba) — no hace falta crearla en el dashboard de Supabase.
  Solo ve las secciones que su checklist de permisos habilita
  (Horarios/Conteo diario/Inventario/Nómina/Propinas) más, si el dueño le asignó algún día
  desde Corte diario (ver "Asignar día" más arriba), "Corte" — acotado
  solo a esos días. Esa persona entra desde "Soy del equipo, tengo un
  PIN" en la pantalla de inicio, elige su nombre y teclea su PIN.

  Por debajo sigue siendo una cuenta real de Supabase Auth (con un correo
  técnico invisible tipo `xxxx@cortes.local` y el PIN como contraseña), así
  que reutiliza toda la seguridad y sesiones ya construidas. Las fechas
  asignadas para Corte sí viven en su propia tabla con permisos (RLS): el
  staff solo puede leer sus propias fechas, y solo el dueño puede
  asignarlas o quitarlas. Al quitar una fecha, esa persona pierde acceso a
  ese día de inmediato — la app revisa sus fechas asignadas cada ~20
  segundos mientras está abierta, así que no necesita cerrar sesión ni
  recargar para que la revocación tome efecto. Lo que sigue viviendo solo
  en la interfaz es el acceso al resto del negocio (catálogo, otros
  meses/semanas): a nivel de base de datos el staff puede leer y escribir
  el mismo registro `app_data` que el dueño.

**Novedades al entrar (cuentas de equipo)**: cuando algo cambia en una
sección que usa el personal, lo primero que ve esa persona al entrar es una
tarjeta encima de la pantalla con un dibujito de cómo se usa, un título y
una frase corta. Si hay varias, se pasan con "Siguiente" (con puntitos que
marcan cuántas son) y la última dice "Entendido"; se cierra en cualquier
momento con la ✕ o tocando fuera, y ya no vuelve a salir. A cada quien solo
le salen las novedades de secciones a las que hoy tiene acceso (Corte =
tiene algún día asignado; las demás, sus permisos) y que ya usaba antes
del cambio: si nunca ha entrado a esa sección, para esa persona todo es
nuevo y no ve nada. Ej. si alguien hizo su último corte en marzo y en
noviembre se le vuelve a asignar un día, al entrar ve todo lo que cambió en
Corte desde marzo. Para saberlo, cada persona guarda en su propia cuenta
(en Supabase Auth, sin tablas nuevas) solo qué novedades ya vio y la
última vez que entró con acceso a cada sección; para Corte también cuenta
el "Corte hecho por" de cada día. El personal nunca consulta el historial
de cambios. Al cerrarlas queda además un renglón "Novedades" en el
historial (solo el dueño lo ve). El dueño también recibe el slider al
entrar, con las novedades de todas las secciones (aunque él haya pedido
el cambio): le salen todas las que todavía no ha cerrado, y al cerrarlas
ya no vuelven a salir. Lo visto se guarda en su cuenta, no en el aparato:
si las cierra en la computadora, ya no le salen en el celular. Lo que ve
el dueño no queda en el historial. Las
novedades viven en `src/lib/novedades.ts`; hoy hay 4. De Corte: sumar
montos con "+", el nombre del gasto que se completa solo y la categoría
obligatoria (con la nueva Servicio). De Inventario: el aviso "Faltan por
contar" al guardar, para que lo que no hay salga en 0 y se pueda pedir.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**.
2. Cuando esté listo, entra a **SQL Editor** → **New query**, pega todo el
   contenido de [`supabase/schema.sql`](./supabase/schema.sql) y dale **Run**.
   Esto crea las tablas `profiles` y `app_data` con sus políticas de acceso
   (RLS).
3. Corre también [`supabase/migration_002_staff_pin.sql`](./supabase/migration_002_staff_pin.sql)
   de la misma forma (New query → pegar → Run). Esto crea la tabla que
   permite dar de alta a tu equipo con PIN desde la app.
4. Corre también [`supabase/migration_003_staff_assignments.sql`](./supabase/migration_003_staff_assignments.sql).
   Esto crea la tabla de fechas asignadas (varias por persona) y quita el
   campo viejo de una sola fecha.
5. Corre también [`supabase/migration_004_assignment_week.sql`](./supabase/migration_004_assignment_week.sql).
   Agrega el campo para elegir a mano en qué "Semana N" de tu corte cae cada
   fecha asignada (ver sección 4 más abajo — importante, evita que la app
   adivine mal la semana).
6. Corre también [`supabase/migration_005_realtime.sql`](./supabase/migration_005_realtime.sql).
   Habilita que los cambios se reflejen solos en todos los dispositivos
   conectados, sin recargar la página (ver sección 5 más abajo).
7. Corre también [`supabase/migration_006_staff_permisos.sql`](./supabase/migration_006_staff_permisos.sql).
   Agrega los campos que permiten dar de alta cuentas de equipo adicionales
   (ej. jefe de cocina) con permisos por sección desde Equipo &gt; Personal
   (ver "Acceso a la app" en la sección de Personal, más abajo).
8. Ve a **Authentication → Sign In / Providers → Email** y **apaga "Confirm
   email"**. Es obligatorio: las cuentas del equipo usan un correo técnico
   que no es real, así que nunca podrían confirmarse por correo.
9. Ve a **Authentication → Users → Add user** y crea **un solo usuario para
   ti** (el dueño), con tu correo y una contraseña. Copia su **User UID** (lo
   verás en la lista de usuarios). A tu compañero **no** lo crees aquí — eso
   se hace desde la app en el paso 4 más abajo.
10. Vuelve a **SQL Editor** y da de alta tu perfil de dueño, reemplazando el
   UUID por el que copiaste:

   ```sql
   insert into public.profiles (id, role, display_name)
     values ('UUID-DEL-DUEÑO', 'owner', 'Tu nombre');
   ```

11. Ve a **Project Settings → API** y copia:
   - **Project URL** → será `VITE_SUPABASE_URL`
   - **anon public key** → será `VITE_SUPABASE_ANON_KEY`

## 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores del
paso anterior. Este archivo nunca se sube a git (está en `.gitignore`).

## 3. Desarrollo local

```bash
npm install
npm run dev
```

Abre la URL que te muestre Vite (normalmente `http://localhost:5173`) e
inicia sesión con cualquiera de los 2 usuarios que creaste.

## 4. Dar de alta a tu equipo y asignarle días

Inicia sesión como dueño y toca **Equipo** en la barra de navegación de abajo
(la app del dueño se organiza en 3 secciones: **Corte** para capturar y ver
resúmenes, **Equipo** para tu personal, y **Negocio** para catálogos como
meseros y proveedores):

1. La primera vez verás un formulario: **Nombre + PIN de 4 dígitos** (lo
   escribes dos veces para confirmarlo). Al guardar, se crea la cuenta.
2. Después verás la lista de **fechas asignadas** (puede estar vacía) con un
   botón para **agregar** una fecha nueva y un ícono de bote de basura para
   **quitar** cualquiera ya asignada. Puedes asignarle tantos días como
   quieras, de cualquier mes.

   Al elegir la fecha, la app te sugiere una semana ("Semana 1/2/3/4"), pero
   **revísala y corrígela si hace falta**: las pestañas de semana de tu
   corte son manuales (dependen de cuándo empezaste a capturar ese mes, no
   de un cálculo fijo por fecha), así que la sugerencia puede no coincidir
   con la semana donde tú ya tienes (o vas a tener) capturado ese día. Elige
   la que corresponda a tu propio corte.
3. Tu compañero entra desde la pantalla de inicio, con "Soy del equipo,
   tengo un PIN" → toca su nombre → teclea su PIN → si tiene más de un día
   asignado, elige cuál va a capturar (puede cambiar de día con el enlace
   "Cambiar día" arriba de la captura).
4. Si quitas una fecha, esa persona pierde acceso a ese día en cuestión de
   segundos, sin que tenga que cerrar sesión.

## 5. Sincronización en vivo

Con `migration_005_realtime.sql` corrido, los cambios se reflejan solos en
todos los dispositivos que tengan la app abierta — si tú editas un corte
desde tu iPad, tu compañero lo ve aparecer en su celular sin recargar (y
viceversa). Si por algún motivo la conexión en vivo se cae, la app sigue
guardando normal; solo tardarías en ver el cambio de otro dispositivo hasta
que recargues.

## 6. Desplegar en Vercel

1. Sube este repositorio a GitHub (ya está conectado si vienes de Claude
   Code).
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el
   repo. Vercel detecta Vite automáticamente (build command `npm run build`,
   output `dist`).
3. En **Environment Variables**, agrega `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` con los mismos valores de tu `.env`.
4. Deploy. Cada push a la rama conectada vuelve a desplegar automáticamente.

## Estructura del proyecto

```
src/
  lib/            dataModel (lógica pura), types, supabaseClient, auth, useAppData,
                  gastosBusqueda (búsqueda de tickets, historial de nombres, ortografía)
  components/
    ui.tsx        Sheet, Field, inputs, Toggle, Empty
    ConceptoInput.tsx  cuadro de concepto de gasto con autocompletado y ortografía
    NovedadesAlEntrar.tsx  slider de novedades al entrar (cuentas de equipo); lista en lib/novedades.ts
    modals/       un modal por acción (mesero, gasto, transferencia, etc.)
  pages/
    Login.tsx
    CortesApp.tsx vista principal del dueño y de Corte por día asignado
    StaffAccessShell.tsx menú de cuentas de equipo (permisos + Corte)
supabase/
  schema.sql                        tablas y políticas RLS base
  migration_002_staff_pin.sql       tabla de directorio para el login por PIN
  migration_003_staff_assignments.sql  fechas asignadas (varias por persona)
  migration_004_assignment_week.sql    semana elegida a mano por asignación
  migration_005_realtime.sql           activa la sincronización en vivo
  migration_006_staff_permisos.sql     cuentas de equipo con permisos por sección
```
