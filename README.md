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
fecha exacta. En el resumen semanal, **Efectivo real (lo que contaste)**
se guarda tal como se ve escrito: al tocar "Guardar efectivo real" (que
cambia a "✓ Guardado") o solo al salir del campo, y la diferencia contra
el efectivo calculado se ve mientras se escribe. También tiene, dentro de "Negocio" → "Control de gastos", dos
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

**Pendientes en Control de gastos en efectivo**: arriba de la lista de
gastos hay filtros con cuántos hay de cada uno — **Todos**, **Pendientes**,
**Sin categoría** (pendientes sin categoría) e **Ingresados**. Si la semana
tiene pendientes se abre directo en Pendientes; si no, en Todos. Con un
filtro solo salen los días que tienen algo de ese filtro (con "2
pendientes" en vez del total del día) y un resumen ("3 pendientes ·
$1,135.00"). Cada pendiente lleva una etiqueta con lo que le falta: "Falta
categoría" (rojo; Confirmar sigue apagado hasta elegirla) o "Falta
confirmar (subir comprobante al bot)" (naranja), con el borde del mismo
color. Al confirmar uno, sale el aviso "✓ Coca Cola $362.00 confirmado" y,
en Pendientes, se quita de la lista. Cada gasto lleva además una etiqueta
discreta con su día y fecha ("Lun 12 oct"). En el selector de semana, las
que tienen pendientes lo dicen ("Sem 3 · 3 pdtes"), y si hay pendientes en
las 2 semanas anteriores sale arriba "⚠ 1 pendiente en semanas anteriores
(5 – 11 oct)" — al tocarlo, abre la más vieja.

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

**Corte de mesero paso por paso**: el "+" de meseros en Corte abre "Hacer
corte a mesero", a pantalla completa, una pregunta a la vez con la barra
de avance arriba ("Pregunta 2 de 6 · 17%") y abajo Atrás / Siguiente (no
avanza sin contestar lo obligatorio): 1) **¿A quién se le hace corte?**
(lista con sus iniciales; "Ya tiene un corte hoy" si ya tiene); 2) **¿Se
cobra propina?** ("Sí, 3%", "Sí, 2%", "Sí, otra cantidad" —pide cuánto— o
"No se cobra propina"; al usuario de para llevar en su lugar le pregunta
**¿Quién cobró este turno?**); 3) **¿Cuánto vendió en el sistema?** (al
usuario acumulado: lo que marca en todo el día, y debajo lo ya cortado y
lo de este corte); 4) **¿Cuánto trae en tarjetas?** (con "+" para sumar
vouchers, o "No trae tarjetas"); 5) **¿Tiene transferencias?** (igual, o
"No tiene transferencias"); 6) **¿Pagó algún gasto de su corte?** con el
formulario completo: primero la **categoría** en botones, luego concepto,
total, "¿Para quién?" (Nómina, Comida empleado) o "¿A quién se le
cancela?" (Cancelaciones, ya con el mesero del corte), un botón **Subir
comprobante** desactivado ("Próximamente") y "Ya está ingresado". Abajo:
Atrás · **Guardar otro gasto** (lo agrega, limpia el formulario y sigue
ahí; los agregados quedan arriba con su categoría y ✕) · el botón verde, que
dice **No tuvo gastos** mientras no se ha llenado nada, **Guardar y
continuar** en cuanto se llena algún campo (agrega ese gasto y sigue; a
medias avisa qué falta) y Siguiente si ya hay gastos agregados y el
formulario está vacío.
Al final, el **Resultado**: venta, propina, tarjetas, transferencias y
gastos, cada uno con "Cambiar", y **Efectivo a entregar** en grande; el
cuadro **Efectivo recibido** solo calcula "Dar cambio: $…", "Faltan: $…"
o "Exacto" — no se guarda ni cambia el efectivo del día ni de la semana.
Botones: Atrás · **Hacer otro corte** (guarda y empieza otro) · **Guardar
corte** (guarda y regresa al corte del día, como siempre). Tocar un corte
ya hecho abre directo en el Resultado (sin "Hacer otro corte", con el bote
para eliminarlo). Se guarda igual que antes: los gastos como pendientes (o
ingresados) con su categoría, y la transferencia a nombre del mesero. Al
**eliminar un corte** se borran con él su transferencia y los gastos que
se capturaron en ese corte; al eliminar o cambiar el monto de uno de esos
gastos desde Gastos del día, el corte de ese mesero se ajusta solo
(gastos y entrega).

**Gasto y transferencia paso por paso**: el "+" de Gastos abre "Nuevo
gasto" con el mismo diseño: 1) **¿Se rebaja de algún corte?** ("Sí, del
corte de Jenny" con su entrega, uno por cada corte del día, o "No, es un
gasto general"; si aún no hay cortes, se salta) y 2) **¿Qué gasto es?**
con el formulario completo (categoría primero, concepto, total, a quién,
Subir comprobante "Próximamente" e ingresado) y arriba si se rebaja de
alguien ("Se rebaja de la entrega de Jenny ($5,000.00)"). Botones: Atrás ·
**Guardar otro gasto** (lo guarda, limpia y sigue ahí; con el formulario
vacío el verde dice "Listo") · **Guardar gasto**. El "+" de Transferencias
abre "Nueva transferencia": 1) **¿Se rebaja de algún corte?** (o "No se
rebaja de ningún corte"), 2) **¿Quién cobró la transferencia?** (solo si
no es de un corte: los meseros o "Otra persona" con su nombre; si es de un
corte va a nombre de ese mesero) y 3) **¿De cuánto es?** (con "+" para
sumar varias), con Atrás · **Guardar otra transferencia** · **Guardar
transferencia**. Si se rebaja de un corte, se descuenta de la entrega de
ese mesero; al editar (abre directo en el gasto o el monto; con Atrás se
cambia de qué corte se rebaja) o eliminar, los cortes se ajustan solos. El
efectivo del día y de la semana no cambia: ya cuenta todos los gastos y
transferencias.

Al capturar un corte, "Guardar corte" no se puede tocar si falta elegir el
mesero o la venta; y al guardar un gasto en efectivo la categoría es obligatoria ("Es importante
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

La vista del dueño se organiza en 5 secciones, accesibles desde la barra de
navegación de abajo (Inicio · Corte · Equipo · Negocio · Dashboard) — tocar una pestaña siempre regresa al inicio de esa
sección, aunque ya estés adentro de una de sus páginas (ej. tocar "Equipo"
estando en Nómina te regresa al menú de Equipo):

- **Inicio**: lo primero que ve el dueño al abrir la app — qué necesita su
  atención hoy. Arriba, el saludo según la hora ("Buenos días", "Buenas
  tardes", "Buenas noches"), la fecha y un resumen ("6 cosas por revisar ·
  3 urgentes"). Debajo, las alertas en 4 grupos, cada uno con su color en
  el borde, y cada alerta con una línea de por qué importa y "Ver ›", que
  lleva directo a la pantalla donde se resuelve:
  - **Urgente** (rojo): cortes de días pasados sin "Guardar corte" (desde
    el 20 de octubre de 2026, cuando se agregó el botón), días pasados sin
    nada capturado (solo si la semana anterior ese día sí tuvo corte),
    gastos en Pendiente de esta semana y la pasada (cuántos y el total; lleva
    a Control de gastos en efectivo) y el efectivo real de las 2 últimas
    semanas cerradas sin capturar o que no cuadra con lo calculado (abre el
    Resumen semanal de esa semana).
  - **Operación** (amarillo): conteo diario de **ayer** de Cocina o Bar sin
    capturar, o el de Cocina con el pedido sin guardar (el de hoy no avisa
    porque se hace en la noche; solo de las áreas que lo vienen usando en
    las últimas 2 semanas; abre directo el Conteo diario); inventario del domingo más reciente y, de jueves a sábado, el
    del jueves — sin hacer o con "No reconocidos" por resolver, en el
    mismo orden que Inventario: si al domingo le falta su jueves (sin
    guardar ni saltado), avisa del jueves ("el del domingo espera a
    este"); un jueves saltado no avisa (abre Inventario en esa semana y
    paso; si es de hoy dice "Se hace hoy en la noche"); horario de la
    próxima semana sin guardar, solo sábado y domingo; hoy y mañana sin
    nadie asignado ni corte capturado ("Mañana · nadie tiene asignado ese
    corte") (solo si se ha usado "Asignar día" en las
    últimas 3 semanas); la nómina de la semana que cerró (o la de hoy si
    es domingo) con personas sin marcar como pagadas; y el **consumo de
    insumos** de domingo a domingo: inventario del domingo anterior + lo
    pedido en la semana (conteo diario e inventario, desde ese domingo
    hasta el sábado) − inventario de este domingo, todo pasado a kg/pz con
    la equivalencia del Catálogo ("2 cajas", "500 g" y "3" se entienden).
    Si un producto se usó 25% o más de lo normal para esa venta (lo normal
    = su proporción consumo/venta de hasta 4 semanas anteriores; hacen
    falta al menos 2), sale "Pollo: se usaron 48 kg — lo normal con esta
    venta son ~37 kg (+30%)" (hasta 3, los más altos); si salió negativo
    (al final había más de lo que había + lo pedido), "Papas crisscut: no
    cuadra" (hasta 2). Llevan al inventario de ese domingo. Debajo, si se
    lleva inventario, una nota con cuántos insumos se piden en otra
    presentación sin "¿Cuánto trae 1 …?", porque de esos no se puede
    calcular el consumo (un producto con alguna cantidad que no se pudo
    pasar a kg/pz se deja fuera esa semana).
  - **El negocio** (verde): la venta hasta hoy de la semana con su cambio
    contra los mismos días de la semana pasada y, si hay meta semanal, su
    avance con barra; la tarjeta "Por pagar en transferencia esta semana
    (estimado hoy)": la nómina que no alcanza a cubrir el efectivo (la
    misma cuenta que "Cómo se paga" en Nómina: neto de la semana − el
    efectivo calculado del corte hasta hoy, así que baja conforme entra
    efectivo), los gastos fijos en transferencia y los gastos operativos en
    transferencia ya capturados, con su total (cada renglón solo si es
    mayor a 0); debajo, hasta 3 alertas de "Para revisar" de Tendencias (lo
    atípico y las tendencias; lo incompleto y el efectivo ya salen arriba),
    las **cancelaciones por mesero** — las de esta semana ligadas a un
    mesero ("¿A quién se le cancela?"), cuando son 2 o más y al menos el
    doble de su promedio de las 4 semanas anteriores ("Luis: 4
    cancelaciones esta semana · $620 — normalmente 1 por semana ($150)") —
    y "Ver todo en Tendencias ›".
  - **La app y el equipo** (gris): de los últimos 7 días de Actividad, sin
    contar lo que hizo el dueño — cambios con algo eliminado, cambios entre
    2 y 6 a.m. y cambios a cortes de días pasados (con quién; llevan a
    Actividad) — y quien tiene asignado el corte de hoy o mañana y no ha
    abierto la app en 7 días.
  Un grupo sin pendientes no aparece. Si no hay ninguno, sale "Todo al
  día ✓ — No hay cortes, gastos ni pendientes por revisar" y solo la
  tarjeta de venta. Las alertas no se descartan a mano: se quitan solas al
  resolver el pendiente.
- **Etiquetas del día** (`src/lib/etiquetas.ts`, `src/components/EtiquetasDia.tsx`):
  qué pasó o va a pasar cada día que mueve la venta — 🎵 Música en vivo,
  ⚽ Partido, 🎉 Festivo o puente, 🎂 Evento privado y 📌 Otro (varias a
  la vez), con una nota opcional ("Banda de rock", "2 partidos"). Se
  guardan en el día del corte, así que se ven igual en los dos lados: en
  **Horarios**, una fila con los 7 días (sus íconos o "＋"; tocar uno abre
  "Etiquetas · Viernes 23"), y los íconos también bajo el nombre del día
  en la tabla; en **Corte**, una línea debajo de "Historial de este día"
  con las etiquetas y la nota y "＋ Etiqueta del día" / "Cambiar
  etiquetas". Sirven para días pasados y para planear. 💰 **Quincena** se
  marca sola: el 15 y el último día del mes; si cae en sábado o domingo, el
  viernes anterior. También salen solos: 🇲🇽 **festivos oficiales** (Año
  Nuevo, Constitución —1er lunes de febrero—, Juárez —3er lunes de marzo—,
  1 de mayo, 16 de septiembre, Revolución —3er lunes de noviembre—,
  Navidad y el cambio de presidente cada 6 años), ✨ **fechas especiales**
  que mueven la venta (Jueves y Viernes Santo según la Pascua, Reyes, San
  Valentín, Día del Niño, Día de las Madres, Día del Padre, Noche Mexicana,
  Halloween, Día de Muertos, Guadalupe, Nochebuena y Fin de año) y 🌉
  **puentes** (festivo en lunes: sábado y domingo antes; en viernes:
  sábado y domingo después; en jueves: el viernes; en martes: el lunes).
  No tocan la nómina: el "Día festivo" del horario se sigue marcando a mano.
- **Clima** (`src/lib/clima.ts`): el de Apodaca, N.L., de Open-Meteo
  (gratis, sin clave) — máxima, mínima, lluvia y cielo de cada día, de los
  días pasados y del pronóstico de los próximos 16 días (se trae solo, no se
  captura). En Horarios, cada día de la fila muestra el cielo y la máxima
  ("☀️ 31°"); en Corte, la línea del día lleva "🌧️ 24° / 18° · lluvia 6.2
  mm" (en días que vienen, la probabilidad de lluvia si es de 30% o más).
- **Valores del horario**: OFF = descanso, X = abre, Z = dobla, O = cierra
  (entra lunes a jueves 4 pm, viernes y sábado 5 pm, domingo 3 pm); una hora
  ("5", "6:30") es una entrada especial en la tarde y se paga como un turno.
  Etiquetas y clima son los pasos 1 y 2 hacia el creador de horarios
  automático (luego: pronóstico de venta, reglas del personal y el horario
  sugerido).
- **Venta esperada** (`src/lib/pronostico.ts`, `src/components/PronosticoDetalle.tsx`,
  paso 3): para cada día, el **día típico** — la venta de en medio
  (mediana) de los últimos 8 días iguales sin nada especial (sin
  etiquetas, festivos, fechas especiales ni puentes), con un rango
  (cuartiles) — ajustado por lo que tiene ese día (etiquetas, festivo,
  fecha especial, puente, quincena), medido con la propia historia: cuánto
  vendieron los días con eso contra su día típico, primero en días donde
  solo pasó eso. Con 1–2 casos se aplica y dice "pocos datos" (y el rango
  se abre); sin casos sale "todavía no hay días así para medirlo" y queda
  el día típico. El clima todavía no entra al cálculo. Se ve en
  **Horarios** (el dueño y quien edita horarios, ej. jefe de cocina): cada
  día de la fila con "~$21k" y "Venta esperada de la semana"; al tocar un
  día, el desglose (el dueño lo ve arriba de sus etiquetas; el jefe de
  cocina, en una hoja de solo lectura). En el **Inicio** del dueño: "Venta
  esperada esta semana", "Hoy se esperan $… ($…–$…)", cada día con lo
  esperado y, si ya pasó, ▲▼ lo vendido contra lo esperado, y "La semana
  que viene". En **Corte** (dueño): "Se esperan $…" o, ya cerrado,
  "Esperábamos $… · vendiste $… (+15%)", y con 25% o más de diferencia y
  sin etiqueta, "¿Pasó algo? Ponle una etiqueta".
- **Reglas del personal** (`src/components/panels/ReglasHorarioPanel.tsx`,
  `src/lib/reglasHorario.ts`, paso 4): en Horarios, el enlace "Reglas del
  personal ›" (dueño y quien edita horarios; el jefe de cocina solo ve su
  área). Pestañas PISO y COCINA, cada una con:
  **¿Cuántos trabajan cada día?** (mínimo por día; piso 3-3-3-4-6-6-6 y
  cocina 2-2-2-2-3-3-3 de inicio; debajo de cada día su venta esperada;
  tocar un día abre −/+), **Subir gente si se espera más venta** (+1 por
  cada $6,000 arriba de lo normal en piso, $10,000 en cocina, apagado en
  cocina; el monto se cambia con −/+ de $500), **Apertura y dobles** (cada
  día alguien abre con X o Z, máximo de dobles por persona a la semana —2—,
  no doblar dos días seguidos, cada día alguien que haga corte —los que
  tienen "Puede hacer corte" en su ficha— y 1 descanso por semana a tiempo
  completo) y **Cada persona**: quienes
  salieron en esa área en los últimos 6 horarios, con chips Abre/Cierra/
  Dobla y su descanso, o sus días fijos. Lo que no se ha guardado se deduce
  de esos horarios: sin ningún OFF y con días vacíos = "Solo días fijos"
  (el valor más común de cada día, ej. Dana: Jue 6:30 · Vie 6:30 · Sáb O ·
  Dom O); abre si tuvo 2 o más X, dobla con al menos una Z, cierra con al
  menos una O; descanso preferido = los días con OFF si fueron 3 o menos
  (si no, "flexible"). Al tocar a alguien: "Tiempo completo" o "Solo días
  fijos", sus días fijos (X, Z, O, vacío o una hora especial), qué puede
  hacer —abrir (con "Cuando abre, siempre dobla (Z)", ej. Aldair que abre
  de mesero y cierra de barra, y "Máximo de días que abre a la semana", ej.
  Alejandro 1 y Jennifer 2, y "Días que puede abrir", ej. Dana sábado o
  domingo y Kevin domingo; con días fijos, ese día abre en vez de cerrar),
  cerrar, doblar y "Puede hacer corte"— y
  "Descanso preferido" (o "Días que no puede" con días fijos). Chips
  "Corte", "Abre máx. 1", "Abre con Z".
  Arriba, **🧠 Lo que aprendí** (`src/lib/aprender.ts`, paso 6): compara
  las reglas guardadas con los horarios de las últimas 4 semanas (hasta la
  actual) y propone cambios con **Aplicar** (cambia y guarda esa regla) o
  **Ignorar** (no vuelve a salir; `AppData.reglasIgnoradas`): subir/bajar el
  mínimo de un día cuando 3 de 4 semanas (o más) se puso otro número,
  descanso preferido cuando descansó el mismo día 3 de 4 semanas, "sí puede
  abrir / doblar" cuando lo hizo 2 veces o más y su regla dice que no, y
  subir el máximo de dobles. Debajo: **Venta por persona en piso** (venta
  real ÷ personas trabajando, mediana por día; en naranja los días con menos
  de ¾ del promedio), el **error promedio de la venta esperada** en los
  últimos 28 días (lo que se esperaba cada día con lo que se sabía antes de
  él) y qué porcentaje del **horario sugerido** quedó igual al guardarlo
  (al guardar una semana hecha con "Usar este horario" se guarda cómo venía
  la propuesta en `HorarioSemana.sugerido`). El enlace de Horarios muestra
  cuántas sugerencias hay ("Reglas del personal 3 ›"). El jefe de cocina ve
  solo las de cocina.
  "Guardar reglas" escribe solo las áreas que cambiaron en
  `AppData.reglasHorario`. El horario sugerido (paso 5) usa estas reglas.
- **Horario sugerido** (`src/lib/horarioSugerido.ts`, paso 5): mientras el
  horario de la semana se puede editar (dueño, o jefe de cocina solo con
  cocina), la tarjeta "✨ Horario sugerido" con el botón "Sugerir horario de
  esta semana". Para cada área: se necesitan el mínimo de las reglas + 1 por
  cada "venta por persona extra" que la venta esperada pase del día típico;
  los de días fijos van tal cual; a cada tiempo completo se le pone 1 OFF en
  el día con más gente de sobra (de preferencia su descanso preferido; si
  empata, el de la semana pasada; luego el de menos venta) y O los demás
  días; cada día abre (X) uno que pueda abrir, el que menos ha abierto en la
  semana (si empata, el que abrió ese día la semana pasada), y en días con
  más gente de lo normal o donde falta gente ese mismo dobla (Z), respetando
  el máximo de dobles, sin doblar dos días seguidos y sin pasar el máximo de
  días que abre cada quien ni sus días para abrir; quien "siempre dobla al
  abrir" solo abre con Z. Las aperturas de la semana se escogen probando
  todas las combinaciones: gana la que cubre más días y, si empatan, la que
  reparte mejor, dobla en los días fuertes y se parece a la semana pasada.
  Al tiempo completo que solo abre ciertos días se le evita el descanso en
  esos días.
  Los descansos de los que hacen corte no caen el mismo día (aviso "nadie
  que haga corte" si no se puede); los días sin nadie disponible para abrir
  salen juntos en un aviso. Se abre una hoja con las tablas, la fila "Trabajan
  6/8" (en rojo si faltan), avisos ("Viernes: faltan 2 en piso…", "nadie que
  pueda abrir"), leyenda y "¿Por qué así?". "Usar este horario" llena el
  formulario sin guardar (banner "Se cargó el horario sugerido…" con
  "Volver a como estaba"); se corrige tocando las celdas y se guarda con
  "Guardar horario" como siempre.
- **Horario entre varias personas**: al guardar, solo se reemplazan las
  áreas (y los festivos) que se cambiaron en esa pantalla; lo demás se toma
  de la versión más reciente guardada. Así el dueño (piso) y el jefe de
  cocina pueden editar al mismo tiempo sin borrarse el trabajo; si se
  conservó lo de alguien más, el aviso de guardado dice "Se conservó lo que
  guardó alguien más en COCINA". Con el horario bloqueado (sin editar) se ve
  siempre lo último guardado, y al tocar "Editar" se empieza desde ahí.
- **Corte**: la pantalla principal — mes, semana, día, meseros, gastos,
  transferencias, ventas de apps y sus resúmenes. Debajo de "Historial de este día"
  todo va ordenado paso a paso (`src/components/CorteDelDia.tsx`):
  - **Siguiente paso**: tarjeta verde con barra de avance ("Siguiente paso
    · 3 de 4 · 50%"), qué toca hacer en una frase y su botón, y abajo los
    pasos del día como etiquetas (✓ los hechos, resaltado el actual):
    **Corte de apertura** ("Hoy abre …", botón Corte de apertura) →
    **Cortes del cierre** (botón Hacer corte a mesero) → **Confirmar
    gastos** (los que siguen en Pendiente o les falta algo, con "Ver
    gastos", que pasa a Todo el día y baja a Gastos) → **Guardar corte**
    ("Revisa que las apps del día ($…) y Johnster del día ($…) coincidan
    con el sistema"). Los días sin turnos (antes del 21/10/2026) son 3
    pasos, sin apertura. Ya guardado, la tarjeta dice "Corte guardado" por
    quién y cuándo (el dueño con "Reabrir corte").
  - **Pestañas** Turno 1 · Apertura (con candado y la hora si ya se
    guardó; ahí el aviso con "Desbloquear apertura" para el dueño y sin
    botones +) / Turno 2 · Cierre (se abre solo cuando ya hay apertura) /
    Todo el día (resumen, con los cortes separados por turno). Los días
    sin turnos no llevan pestañas.
  - **Totales del turno** en tarjetas (venta, tarjetas, transferencias,
    gastos, propinas y apps del día, que se toca para cambiarla; en Todo
    el día: venta total, venta local, etc.).
  - **Cortes de meseros** en tabla (venta, tarjetas, transf., gastos y
    entrega, con el total; tocar una fila abre el corte) — en celular,
    lista con los mismos datos; a un lado (abajo en celular) **Gastos**
    (categoría, de qué corte, del fondo o general, y Confirmar/Ingresado)
    y **Transferencias**; y **Efectivo · ¿cuánto debe haber?** (debajo de
    los cortes en iPad, al final en celular): solo dinero, como cuenta de
    caja con lo que "lleva" cada renglón — efectivo que cobraron los
    meseros (sin propinas, tarjetas ni transferencias), − gastos del
    turno, = debe haber en caja, − se deja para mañana, = efectivo a
    entregar; abajo, el turno 1 ya entregado y el total del día.
  - **Fondo** (lo que se dejó el día anterior, desde el 25/10/2026): solo
    vive en el turno 1. Si hay fondo, el primer paso es **Recibe el fondo
    ($…)** con "Ya lo recibí". En la pestaña Turno 1 sale la tarjeta
    **Fondo**: se dejó ayer, los gastos pagados con él (con +; en Nuevo
    gasto la pregunta pasa a ser **¿Con qué dinero se pagó?** con "Con el
    fondo que se dejó ayer · quedan $…" como primera opción) y **queda del
    fondo**. Esos gastos se restan del fondo, no de las ventas. El **Corte
    de apertura** muestra el bloque Fondo (se dejó, − gastos del fondo,
    queda) y al final "Efectivo de las ventas + fondo que queda = se
    entrega al dueño"; al guardarlo, los gastos del fondo quedan dentro de
    la apertura. El turno 2 ya no lleva fondo: su efectivo es solo lo de su
    turno. En Todo el día: fondo + cobrado − gastos del día − ya entregado
    en la apertura (con el fondo). Los gastos del fondo siguen contando
    como gastos del día en totales y Dashboard.
  - **Barra fija abajo** con el efectivo a entregar (en la noche, si hubo
    apertura), "Dejar efectivo" y "Guardar corte" (ya guardado: "Reabrir
    corte" para el dueño o "Guardado"). Arriba de los totales del
  día hay una tarjeta de asignación: quién tiene asignado ese día (si
  alguien) y quién capturó su corte — ver "Asignar día" más abajo.
- **Corte de apertura y cierre** (en los cortes desde el **21 de octubre
  de 2026**; los días anteriores quedan como estaban): arriba del corte
  aparece "Hoy abre: [nombre] (X en el horario)" — quien tiene **X** (abre)
  o **Z** (dobla) ese día en Horarios — y el botón **"Corte de apertura"**.
  Ahí, en una sola pantalla y sin propina, se captura lo que llevan hasta
  ese momento: **Apps**, el **usuario de para llevar** (ej. "Johnster") y
  el **usuario de quien abrió** (venta, tarjetas, transferencias y
  gastos). "¿Quién abrió?" viene del horario y se puede cambiar a mano; "Su
  usuario en el sistema" se elige (el nombre del horario no siempre es el
  del sistema), la app lo sugiere si coincide con su primer nombre y lo
  recuerda para la siguiente vez. Al guardarlo, esos cortes, gastos y
  transferencias quedan bloqueados para el personal y la lista se ve en
  "Apertura · hasta [hora]" (con candado, incluida la venta de apps) y
  "Resto del día". Al cierre, el corte de Johnster y (si se le hace) el de
  quien abrió se capturan con la **venta total del día que marca el
  sistema** y las tarjetas/transferencias del resto del día: la app
  muestra "En la apertura: $X · Este corte (resto del día): $Y" y guarda
  solo la diferencia (se recalcula sola si se corrige la apertura).
  Johnster nunca lleva propina; en el cierre de quien abrió se elige 3%,
  2%, Nada o Manual. Las apps se cierran escribiendo el total del día en
  "Ventas de apps". Arriba se muestran "Johnster del día", "[Quien abrió]
  del día" y "Apps del día", que deben coincidir con el sistema. "Guardar
  corte" al final bloquea todo; el dueño siempre puede editar y con
  "Desbloquear apertura" libera esa parte. El usuario de para llevar se
  marca una vez en Equipo > Meseros ("Usuario de para llevar (sin
  propina)").
- **Efectivo del día** (mismos días, desde el 21/10/2026): en lugar del
  renglón "Efectivo a entregar", el corte muestra la cuenta del efectivo:
  "Efectivo de la apertura (ya entregado al dueño)" como referencia — el
  dueño siempre se lleva el efectivo de la apertura —, "Efectivo del resto
  del día (sin propinas)", "+ Se dejó el día anterior" (automático, si el
  día anterior se dejó efectivo), "− Se deja en el restaurante" (si hoy se
  deja) y **"Efectivo a entregar en la noche"**, lo que va en el sobre;
  abajo, el total de efectivo del día (apertura + noche). Con "+ Dejar
  efectivo para el día siguiente" quien cierra registra el monto y para
  qué (ej. hielo, retiro del dueño): sale del corte de ese día y entra
  solo al del día siguiente. Lo que se pague con ese dinero se registra en
  Gastos del día (no dentro del corte de apertura); el corte de apertura
  lo recuerda con un aviso cuando hay efectivo dejado.
- **Equipo**: menú con 5 opciones — "Meseros" (catálogo de
  meseros — solo nombre, para elegir a quién le haces el corte en Corte;
  vive aquí porque también son parte de tu equipo, aunque su lista está
  separada de Personal), y como páginas propias "Personal" (la lista de tu
  personal — nombre, sueldo diario y un puesto opcional (Gerente, Mesero,
  Cocinero, ...); la lista se agrupa sola por área según el puesto de cada
  quien. Al editar a alguien hay un interruptor **Activo / Inactivo**: los
  inactivos (ya no trabajan aquí) salen al final en "Inactivos", atenuados,
  y se conserva todo su historial (horarios, nómina), pero ya no salen en
  "Agregar empleado" de Horarios, no se precargan en una semana nueva y no
  entran en Reglas del personal ni en el horario sugerido. Áreas y puestos son catálogos editables — arrancan con Gerencia
  (Gerente, Subgerente), Piso (Bar tender, Mesero, Calidad, Capitán) y
  Cocina (Jefe de cocina, Cocinero) como punto de partida (el puesto que
  antes se llamaba "Barra" se renombró solo a "Bar tender" — mismo puesto,
  así que quien lo tenía lo conserva con su conteo y recetario de Bar — y
  "Capitán" se agregó solo en Piso), y se puede crear un puesto
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
  área ni por persona) y "Recetario" (consulta de las recetas que captura
  el dueño en Negocio > Bar/Cocina > Recetario, sin poder editar nada: los
  puestos de Cocina — Cocinero, Jefe de cocina — ven solo el "Recetario de
  Cocina", Bar tender solo el "Recetario de Bar", y cualquier otro puesto las
  dos. Es el único permiso que se puede habilitar aunque la persona no
  tenga puesto asignado) y "Pedidos" (pegar los pedidos de la semana
  desde WhatsApp, sin área — ver abajo en Negocio > Pedidos). Cada permiso se acota distinto: "Horarios" usa el área de
  Personal del puesto (Gerencia/Piso/Cocina) y muestra el horario
  completo de esa área (todo el personal de Piso, o todo el de Cocina,
  no solo su propia fila); "Conteo diario" usa el catálogo de insumos
  (Bar/Cocina/General) en vez del área de Personal, porque no son la
  misma clasificación — un puesto de "Bar tender" vive bajo el área de
  Personal "Piso", pero sus insumos son los de Bar, así que ese permiso
  se resuelve por el nombre del puesto (Bar tender o Barra → Bar, Cocinero/Jefe de
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
  Sin puesto asignado, ninguno de estos permisos (salvo Recetario) se
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

  **Guardar corte**: hasta abajo del corte del día (después de
  Transferencias) está el botón "Guardar corte", con el aviso "Al
  guardarlo ya no se podrá editar". Al tocarlo primero se revisa que todo
  esté completo; si falta algo, sale "Todavía no puedes terminar el corte"
  con la lista de qué falta y no deja seguir: un gasto en **Pendiente**
  ("sube el comprobante al bot y toca Confirmar"), un gasto sin concepto,
  sin monto o sin categoría, un corte de mesero sin venta, o que no haya
  ningún corte de mesero. Si está completo, sale "¿Seguro guardar el
  corte?" con un renglón con casilla por cada total — tarjetas,
  transferencias, gastos, venta (total) y apps — y uno más: "Ya subí al
  bot los comprobantes de gastos, bancarios y transferencias, y la venta".
  El botón "Sí, todo coincide — guardar corte" solo se activa con todas
  las casillas marcadas. Ya guardado, arriba de los totales sale "Corte
  guardado por [nombre] el [fecha] a las [hora]". Para el personal el día
  queda bloqueado: el aviso agrega "Ya no se puede editar. Si algo está
  mal, avísale al dueño", desaparecen los botones "+" de meseros, gastos y
  transferencias, no se abren los cortes, gastos, transferencias ni
  ventas de apps, y no se puede tocar Confirmar/Ingresado. El dueño ve el
  mismo aviso pero puede seguir editando todo, y abajo tiene "Reabrir
  corte" (con confirmación) para desbloquearlo y que la persona lo
  corrija y lo vuelva a guardar. Los cortes hechos antes de este botón no
  quedan bloqueados solos.
- **Negocio**: catálogo de proveedores (nombre y la
  marca de "también se pide los jueves" — el mismo proveedor que se elige
  en el Catálogo de Bar/Cocina y que agrupa la lista en Inventario; no se
  puede eliminar un proveedor mientras tenga algún insumo asignado, para
  no perder esa referencia ni el historial ya guardado en Inventario).
  Cada proveedor muestra cuántos insumos tiene. Para los repetidos (ej.
  "Compras Johnster" y "Johster", que suelen salir de Importar catálogo
  cuando el Excel trae el nombre escrito distinto): arriba sale "Posibles
  repetidos" con los pares de nombre parecido — un error de dedo o uno
  contenido en otro ("Pan"/"Panadería"), sin contar palabras genéricas
  como "Compras" — cada uno con "Unir"; y en cada proveedor, "Unir con…"
  para los que no se parecen en el nombre (Pollo y JD Alimentos). Al unir
  se elige qué nombre se queda (de inicio, el que tiene más insumos), con
  un aviso de qué va a pasar y "Unir en [nombre]": los insumos del otro
  (y sus facturas) pasan al que se queda, el otro desaparece de la lista,
  si cualquiera de los dos se contaba los jueves el que se queda también,
  y el nombre que desaparece se guarda como otro nombre del que se queda
  ("También se llama: Johster") — Importar catálogo reconoce esos nombres
  como el mismo proveedor, para no volver a crear el repetido. El historial
  de Inventario y Pedidos no cambia (se guarda por producto). No se
  deshace con un botón;
  agrupadas bajo "Control de gastos",
  Control de gastos en efectivo y Control de gastos en transferencia; y
  bajo "Análisis", "Tendencias" — la
  sección más dinámica: se reacomoda sola según los datos. Arriba, "Para
  revisar" (siempre primero) es exclusivamente de la semana en curso (de
  lunes a hoy; el lunes empieza en limpio), para ir resolviendo esa semana,
  en este orden: información que parece incompleta (días de esta semana sin
  corte, días con venta pero sin gastos cuando normalmente sí hay, semana
  sin horarios capturados), valores atípicos de esta semana (±25% contra lo
  normal de ese mismo día: venta del día, gastos muy altos para su
  categoría, meseros, cancelaciones/cortesías) y cómo va al ritmo actual
  (por debajo de la semana pasada o de la meta); cada una con "Ver ›" a su
  tarjeta. Lo de semanas ya cerradas (efectivo real sin capturar o
  descuadrado, semana sin nómina, margen anormalmente alto, 3 semanas
  seguidas bajando o subiendo, gastos operativos arriba de 42%, nómina
  subiendo como % de la venta) no sale ahí: hace subir su tarjeta. Con menos de 3 semanas de historial casi no marca atípicos.
  Luego "Venta hasta hoy" con la meta semanal (un solo campo y Guardar).
  Después, las tarjetas que traen algo fuera de lo normal suben solas, con
  la etiqueta "Subió: …", y las demás se juntan abajo en "Sin novedades".
  Tarjetas: ¿cómo cerraría la semana?, día a día vs. semana pasada (con la
  venta de cada día de esta semana y de la pasada; los días estimados
  quedan sin número), semanas, venta por mesero vs. su promedio, gastos vs.
  venta, propinas/cancelaciones/cortesías, cómo se cobra, nómina vs.
  venta, efectivo real vs. esperado, venta promedio por día de la
  semana y resultados por semana cerrada. **Gastos vs. venta** (antes
  "Gastos por categoría"): los gastos capturados en el corte de esta semana
  (de lunes a los días que ya cuentan en la venta) como % de esa venta,
  contra lo "normal" — esos mismos días de las últimas 4 semanas —, en
  total y por categoría (Semana, % venta, Normal), sin Retiro, adelantos
  de Nómina, Cancelaciones ni Cortesías. Una categoría se marca ▲ en rojo
  si su % va 25% o más arriba de lo normal y la diferencia es de $500 o
  más, y ▼ en verde si bajó igual (con menos de 3 semanas de historial no
  se marca). "Los que suben": cada categoría marcada con su %, lo normal a
  estas alturas y sus 3 gastos más grandes; la que más se pasó sale en
  "Para revisar" (también en Inicio) y hace subir la tarjeta. Abajo, las
  últimas 4 semanas cerradas con sus gastos del corte y su % de la venta.
  Los gastos en transferencia se capturan por semana, así que no entran
  aquí: se ven en Resultados por semana cerrada. **Nómina vs. venta** (meta de
  15–16% de la venta: verde hasta 15%, amarillo de 15 a 16%, rojo arriba
  de 16%): esta semana, la nómina de los días que ya cuentan en la venta
  (lunes a ayer, u hoy si ya se guardó su corte) entre esa venta, en grande con
  su semáforo y una barra con la meta; abajo, cuánto tendría que vender la
  semana completa para cerrar en 16% con la nómina de su horario, cómo
  cerraría al ritmo de hoy y cuánto habría que recortar de nómina si no
  alcanza. Luego las últimas 6 semanas cerradas con su % y color; "Por
  día", el promedio de las últimas 4 semanas cerradas con horario de cada
  día de la semana: venta, personas en el horario (quien no tiene OFF),
  nómina y %, más la venta por persona; y "Sugerencias para el horario":
  los 2 días con el % más alto arriba de 16% ("Con 7 personas bajaría a
  ~X%") y, si un día vende por persona 1.8 veces o más que el más bajo y
  está en verde, que ahí cabe alguien más. La nómina del día es el sueldo
  diario de quien trabaja según el horario (doble, festivo y OFF pagado
  incluidos); una semana sin horario no cuenta. Si esta semana (con 2
  días o más) va arriba de 16%, sale en "Para revisar" y la tarjeta sube;
  entre 15 y 16%, solo sube. En detalle — cómo va
  el negocio, por fecha real (semanas de lunes a domingo): **venta hasta
  hoy** de la semana en curso contra los mismos días de la semana pasada y
  contra el promedio de esos días en las últimas 4 semanas (el día de hoy
  cuenta solo cuando ya se guardó su corte con "Guardar corte" — un corte
  de apertura o lo capturado a medio día no cuenta, para no bajar los
  números ni sacar diagnósticos de un día a medias); **¿cómo cerraría la semana?**, con dos
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
  Guacamole); en Bar también es fija, todo en pz (Agua natural Johnster,
  Coca Cola Retornable Regular 355ml, XX Lager, Coca de sabor para llevar,
  Agua natural, Tecate Light, Indio, XX Caguama, Tecate rojo, XX ámbar, XX
  ultra, Amstel, Carta blanca, Coca zero, Coca light, Caguama Indio,
  Caguama Tecate light, Pepsi regular y Pepsi black) — ya no se arma con
  los insumos de alta rotación del catálogo, y los conteos ya guardados no
  cambian. Se guarda el texto tal cual, por área y por fecha real, con
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
  pieza. Bajo "Bar" y bajo "Cocina" hay además, como opción propia
  junto a su Control (separada del control de insumos), un **Recetario
  de Bar** y un **Recetario de Cocina**: la lista de recetas en orden
  alfabético, con buscador (por nombre o ingrediente) y
  el vaso de cada una a la derecha; al tocar una se ve completa en una
  sola pantalla: Vaso (en Cocina se llama "Presentación", ej. plato
  extendido), Ingredientes (cada uno con su medida a la derecha —
  se escriben uno por renglón, "2 oz Tequila blanco", y la app separa la
  medida sola; también entiende "Hielo al gusto"), Utensilios (como
  etiquetas), Preparación (pasos numerados) y Decoración / notas. El dueño
  agrega recetas con el "+" y las edita o borra con el lápiz de cada una;
  con **"Cargar varias"** pega muchas de un jalón en texto — cada receta
  empieza con un renglón "# Nombre" y abajo van "Vaso:" (o
  "Presentación:"), "Ingredientes:" (uno por renglón), "Utensilios:",
  "Preparación:" (un paso por renglón) y "Notas:", cada sección en el
  mismo renglón o en los de abajo; las que no se pongan quedan vacías.
  "Revisar" muestra lo que entendió (cuántas recetas, ingredientes y pasos
  de cada una) y, si un nombre ya existe en ese recetario, deja elegir
  "Reemplazar" (se actualiza la misma receta) o "Saltar"; "Agregar N
  recetas" las guarda todas. Hay un "Ver ejemplo del formato" ahí mismo;
  las cuentas de equipo con el permiso "Recetario" lo ven desde su Inicio,
  sin "+" ni lápiz, acotado a su área: Cocina (Cocinero, Jefe de cocina)
  ve el "Recetario de Cocina" y Barra el "Recetario de Bar"; los demás
  puestos ven un solo "Recetario" con las de Bar y de Cocina (separadas
  con un encabezado por área cuando hay de las dos; si solo hay de una,
  la lista sin encabezados). Por ahora es
  texto sencillo, sin fotos; bajo "General", "Control General" — mismo Catálogo (nombre,
  unidad libre entre Kg/Pieza, precio, proveedor), pero sin Conteo diario
  ni la marca de "alta rotación" (que no aplica sin conteo diario propio):
  abre directo al catálogo, sin menú intermedio, porque es su única
  función. Es para insumos que gerencia maneja aparte, sin ser de Bar ni
  de Cocina — desechables, limpieza y similares; y bajo "Compras", "Inventario" — el conteo completo del domingo y el
  parcial del jueves, por pasos y en orden: arriba, "1 · Jueves [día]" y
  "2 · Domingo [día]" con la fecha real de esa semana y su estado (Sin
  guardar, Guardado ✓, No se hizo, Desde el jueves/domingo, Después del
  jueves). Al abrir una semana se abre el paso que toca. Cada uno se
  captura desde su día (antes sale "🔒 Se habilita el jueves 22", también
  para el dueño), y el domingo además espera a que se guarde el jueves
  ("🔒 Primero guarda el inventario del jueves", con "Ir al jueves"). El
  jueves se puede corregir con "Editar" mientras no se guarde el domingo;
  ya guardado el domingo, para el personal queda "Cerrado: ya se guardó el
  inventario del domingo" (el dueño siempre puede). Si una semana no se
  hizo el jueves, solo el dueño ve "Saltar el jueves de esta semana" (con
  confirmación): el jueves queda como "No se hizo", se habilita el
  domingo, y se puede deshacer desde el mismo paso. Las semanas de antes
  que solo tienen el domingo guardado se respetan tal cual. Va en notas
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
  próxima vez sale solo — un apodo así gana aunque otro producto se llame
  igual. En la lista para elegir, cada producto dice de dónde es ("Limón
  · Cocina · Frutas y Verduras · kg"), con los posibles hasta arriba. Si
  la duda es porque un producto está repetido en el catálogo (mismo
  nombre, sin importar acentos), arriba sale "'Limón' está 3 veces en el
  catálogo" y, para el dueño, "Unir": se elige cuál se queda (de inicio
  el más completo, con proveedor y precio) y los otros se borran del
  catálogo; sus nombres y apodos pasan a ser apodos del que se queda, toma
  lo que le falte (precio, proveedor, "Se pide por") y las capturas viejas
  por insumo se pasan a él. Si uno de los que se borran era de alta
  rotación en otra área, avisa que deja de salir en su Conteo diario.
  "Faltan por contar" escribe el área cuando hay dos productos con el
  mismo nombre ("0 Limón (Bar)"), y un renglón con "(Bar)", "(Cocina)" o
  "(General)" al final solo se busca en ese catálogo. Lo reconocido se muestra separado por proveedor
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
  anterior. **Pedidos cargados** (permiso "Pedidos" en "Acceso a la app",
  pensado para el jefe de cocina): en su pantalla "Pedidos" elige la
  semana (esta o la pasada) y pega de un jalón los mensajes de WhatsApp
  con los pedidos — copiados tal cual, con fecha y nombre, y mezclados de
  varios proveedores ("Apodaca / 1 caja de francesa / 5kg carne molida /
  1paq salchicha"). "Leer y sumar" quita lo que agrega WhatsApp, reconoce
  cada producto del catálogo (por nombre o apodo, sin fijarse en palabras
  como "de" o "para": "carne para taco" = Carne de taco), lo acomoda con
  su proveedor y suma sus cantidades ("1 + 1 + 1 = 3 cajas"), pasando lo
  escrito a la presentación "Se pide por" (ej. kg a cajas con la
  equivalencia; si no se puede, lo avisa). Si los mensajes traen fecha,
  la semana se elige sola según el mensaje más reciente. Lo que no
  reconozca se liga una vez a su producto ("¿Qué producto es?") y queda
  como apodo para la próxima; lo que no se ligue no se suma. "Guardar
  pedidos de la semana" lo guarda por semana y proveedor (al volver a
  pegar los de un proveedor, se reemplazan) con quién y cuándo lo cargó.
  Aquí, en Pedidos, cada proveedor cargado dice "✓ Cargado por … · día",
  sus productos vienen de esa carga ("Cargado 3") en lugar de los
  pedidos sueltos del Conteo diario y del Inventario de esa semana (para
  no contar doble), y arriba se ve cuántos proveedores de Cocina ya están
  cargados y cuáles faltan. El consumo de insumos de Inicio usa lo mismo.
  La captura semanal que vivía antes aquí se quitó;
  y "Importar catálogo": se elige el Excel de inventario de Johnster
  (.xlsx o .xlsm) y la app lee ahí mismo su hoja "PRECIOS BASE" (nada se
  sube a ningún lado). Compara cada insumo contra el catálogo por nombre (o
  por sus apodos) y muestra un resumen: insumos nuevos, los que tienen
  precio o datos distintos, los iguales y los proveedores que todavía no
  existen. Abajo, con filtros Todos / Nuevos / Cambian / Pendientes, la
  lista agrupada por sección del Excel: en los que cambian se ve antes →
  después (precio, "Se pide por", unidad y proveedor); en los nuevos, su
  presentación, su precio y un selector de área ya propuesto (cervezas,
  refrescos, vinos, licores, mixers, concentrados y limonadas → Bar;
  desechables, limpieza, higiene y varios → General, salvo especias como
  ajo, pimienta o paprika que van a Cocina; lo demás → Cocina). Si un
  nombre se parece a uno del catálogo ("criscutt" vs. "crisscut") pregunta
  "¿Es el mismo?": "Sí, actualizarlo" o "No, crear nuevo". Los que el Excel
  marca PENDIENTE o POR CONFIRMAR llevan la etiqueta "Pendiente" con su
  nota. Nada se guarda hasta tocar "Importar N cambios": entonces se crean
  los proveedores que falten y se agregan o actualizan los insumos. El
  precio se guarda tal cual el Excel, por presentación de compra (por kg,
  por millar, por paquete…), y la presentación queda como "Se pide por"
  (kg y pieza no, porque son la unidad en que se cuenta). De los insumos que
  ya existían solo cambian precio, "Se pide por", unidad y proveedor — su
  área, apodos y alta rotación se quedan —; los del catálogo que no vienen
  en el Excel no se tocan. Se puede volver a importar cada vez que se
  actualicen los precios. Un insumo con dato pendiente lo dice en rojo en
  su Catálogo y arriba de su ficha ("Pendiente del Excel: …"), con "Ya lo
  completé" para quitar el aviso. En el Catálogo, el precio de referencia
  es por su "Se pide por" (o por kg/pieza si no tiene).
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
  definida. Arriba del reporte hay un botón "Copiar imagen del resultado"
  que genera un PNG y lo copia al portapapeles para pegarlo en el grupo de
  WhatsApp del jefe (el botón cambia unos segundos a "¡Copiada! Pégala en
  WhatsApp"; si el navegador no deja copiar imágenes, el PNG se descarga y
  aparece el aviso). La imagen hace la misma cuenta que la app del jefe:
  encabezado negro "Resultado semanal · Metroplex · Semana [ISO] ·
  [fechas y año]" (con "hasta hoy (día)" si la semana no ha terminado); la
  **venta semanal** en grande con su cambio contra la venta de la semana
  pasada (por fecha real; ▲ verde o ▼ rojo); − **gastos operativos** (meta
  42% o menos); − **nómina** (meta 15–16%); − **otros gastos** en un
  renglón, con su desglose chico (fijos, comisiones de apps, banco y las
  demás categorías, sin la nómina en efectivo ni el retiro); dos
  recuadros: **Utilidad operativa** en pesos (venta − todos los gastos,
  sin el retiro) y **Margen operativo** en % con 2 decimales (utilidad
  operativa ÷ venta, meta 15% o más); − **retiro** ("gastos externos", no
  operativos: los gastos con categoría Retiro); y = **utilidad después de
  retiro** en grande, en verde si es positiva o rojo si no — es la misma
  Utilidad del reporte. Cada renglón lleva su % sobre la venta. Semáforo
  en gastos operativos, nómina y margen operativo: verde en la meta,
  amarillo cerca (a 3 puntos o menos: gastos operativos hasta 45%, margen
  desde 12%) y rojo fuera; la nómina, igual que en Tendencias, es verde
  hasta 15%, amarilla de 15 a 16% y roja arriba de 16%. Al pie, qué significa cada
  color y una nota (en una semana en curso, que los números son hasta
  hoy).
  Debajo, el botón **"Copiar avance al momento"**: la imagen del avance a
  mitad de semana (lo que antes se llevaba a mano en la libreta), con la
  misma forma de copiar/descargar. La **venta presupuestada** es la meta de
  venta semanal de Tendencias — se captura solo ahí; si no hay, en lugar
  del botón sale el aviso "Sin venta presupuestada: captúrala en
  Tendencias…". De ella salen el **gasto presupuestado** (42%) y la
  **nómina presupuestada** (15%). La imagen trae: encabezado negro "Avance
  al momento · Sucursal Metroplex · Semana [ISO] · hasta hoy (día)" (o las
  fechas si la semana ya cerró); dos donas — **Venta** (lo capturado en el
  corte contra la venta presupuestada: "de $X · faltan $Y") y **Gasto**
  (los gastos operativos, efectivo y transferencia, contra el gasto
  presupuestado: "de $X · quedan $Y"; roja si ya se pasó); **Ritmo de la
  semana**: barras del % de avance de venta y gasto, con una marca de la
  venta sobre la barra del gasto, y en grande el gasto acumulado como % de
  la venta presupuestada (tope 42%); **Nómina** (meta 15%): barra con lo
  generado hasta hoy ("Pagado", según Horarios hasta hoy, igual que el
  reporte), lo que falta al cierre ("Por pagar", con los horarios de la
  semana completa) y en rojo lo que pase del presupuesto; tres recuadros
  (pagado al momento, estimado al cierre y exceso o sobra estimado) y la
  nómina al cierre como % de la venta presupuestada (roja arriba de 15%).
  Al final, tres avisos con su color: lo que queda de presupuesto de gasto
  (verde) o cuánto se pasó (rojo); la nómina estimada al cierre arriba
  (rojo) o abajo (verde) del presupuesto; y si el gasto va más de 5 puntos
  adelante de la venta (amarillo, "cuidar compras") o al ritmo (verde).

Hay 2 tipos de cuenta:

- **Dueño (`owner`)**: acceso completo — todos los meses, semanas y días,
  catálogo de meseros, resúmenes. Inicia sesión con correo y contraseña.
- **Staff (`staff`)**: una cuenta de equipo, dada de alta **desde Equipo >
  Personal** (nombre + PIN de 4 dígitos, sin correo — ver "Acceso a la
  app" más arriba) — no hace falta crearla en el dashboard de Supabase.
  Solo ve las secciones que su checklist de permisos habilita
  (Horarios/Conteo diario/Inventario/Nómina/Propinas/Recetario) más, si el dueño le asignó algún día
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
novedades viven en `src/lib/novedades.ts`; hoy hay 6. De Corte: sumar
montos con "+", el nombre del gasto que se completa solo, la categoría
obligatoria (con la nueva Servicio) y el botón "Guardar corte". De
Inventario: el aviso "Faltan por contar" al guardar, para que lo que no
hay salga en 0 y se pueda pedir, y el inventario en orden (primero el
jueves, luego el domingo).

Antes de las novedades sale siempre una tarjeta de intro, "Hay cosas
nuevas en la app": explica que así se avisan los cambios la primera vez
que se entra (que no se abrió nada por error), que el dibujo de cada
tarjeta es solo un ejemplo y no hay que seleccionar nada, que se pasan con
Siguiente/Entendido y que solo salen una vez; su botón es "Ver las
novedades". En cada novedad, la etiqueta de arriba dice el número y la
sección ("Novedad 4 de 5 · Inventario"), el dibujo lleva encima "Ejemplo ·
así se ve en la app" con borde punteado y no responde a toques, y arriba
del botón dice "Solo es informativo — no tienes que hacer nada aquí".

**Pregúntale a Cortes (solo dueño)**: en todas las pantallas del dueño hay
un botón verde redondo 💬 encima de la barra de abajo (a la derecha) que
abre "Pregúntale a Cortes". Se pregunta de tres formas: escribiendo y
tocando enviar, dictando con el micrófono 🎤 (usa el dictado del navegador,
gratis, en español de México; el botón se pone rojo mientras escucha y al
terminar responde solo; si el celular no lo tiene, el micrófono no sale y
se puede usar el dictado del teclado) o tocando una pregunta.

**Autocompletado**: mientras se escribe, debajo de la caja salen hasta 5
preguntas completas armadas con lo que sí hay capturado, cada una con su
número ya calculado a la derecha (ej. "Propinas de Dana esta semana ·
$362"); al tocarla responde de inmediato y queda escrita en la caja. Salen
de: las preguntas de siempre, los días de esta semana y la pasada (venta,
propinas, gastos y efectivo de cada día), los promedios de cada día de la
semana, las personas del horario de esta semana y la pasada ("Cuánto le
toca a…", "Nómina de … de la semana pasada") y los meseros que tuvieron
corte en las últimas 2 semanas (sus propinas de hoy, ayer, esta semana y
la pasada). Busca cada palabra escrita aunque vaya a medias ("venta prom
vi" → "Venta promedio de los viernes", "cuanto le toca a al" → Aldair
primero), ignora palabras de relleno (de, la, el, cuánto…) y entiende
sinónimos (vendimos → venta, sueldo → nómina, ganancia → utilidad, sobre →
efectivo, normalmente → promedio). Primero las que coinciden con lo escrito
y, entre ellas, las que más se usan. Si se manda la pregunta sin tocar una
sugerencia, se interpreta como siempre y, si no se entiende, responde la
primera sugerencia. Mientras hay sugerencias se esconden los botones.

Al abrir, sin escribir nada, solo salen las 3 que más usas y "Ver todas las
preguntas", que despliega todos los botones agrupados en **Ventas** (venta de hoy, de ayer, de la
semana, semana pasada, "¿Cuánto se vendió el…?"), **Estadística** (venta
promedio por día, "¿Qué día se vende más?", venta promedio semanal y mejor
día de venta), **Dinero** (efectivo a
entregar hoy, gastos de la semana, utilidad de la semana), **Nómina**
(nómina actual, nómina de la semana pasada, "¿Cuánto le toca a…?", "¿A
quién falta pagar?", adelantos y descuentos) y **Propinas** (propinas de
hoy, de la semana, de la semana pasada y por mesero). Hasta arriba
salen **"Las que más preguntas"**: las 3 que más usas (al inicio: venta de
hoy, nómina actual y venta de la semana); cuántas veces usas cada una se
guarda en tu cuenta (en Supabase Auth), así que es igual en el celular y en
la computadora, y el orden se acomoda la siguiente vez que abres la
pantalla (no mientras la usas, para que los botones no se muevan).

No usa IA: reconoce palabras clave. El tema: venta/vendí, efectivo/
entregar/sobre, gastos, propinas, utilidad/ganancia/margen y nómina/sueldo.
El cuándo: hoy, ayer, antier, un día de la semana ("el martes" = el martes
más reciente que ya pasó; "el martes pasado" = el de la semana anterior),
un número de día ("el 15", "el 3 de octubre"), "esta semana" o "semana
pasada". Y un nombre: si la pregunta trae el nombre (o solo el primer
nombre) de alguien del personal, la nómina es solo de esa persona ("nómina
de Aldair", "¿cuánto le toca a Jenny?"); si trae el de un mesero, las
propinas son solo de ese mesero ("propinas de Dana", "propinas de Jenny el
martes"). Si el nombre no está en el horario de esa semana lo dice, no
responde de otra persona. Sin cuándo, venta, efectivo y propinas responden por hoy y gastos
por la semana; utilidad y nómina siempre son de la semana. Cada número sale
de los mismos cálculos que ya usan Corte, Dashboard y Nómina, así que nunca
da otra cifra:

- **Venta de un día**: total con su desglose (local · apps, tarjetas ·
  efectivo) y "Ver el corte de ese día". Debajo vienen los días Lun–Dom de
  esa semana para cambiar la respuesta con un toque (los días que no han
  llegado se ven apagados). Igual para propinas (cuántos meseros y la más
  alta), gastos y efectivo de un día.
- **Efectivo a entregar**: desde el 21/10/2026 es el mismo de "Efectivo del
  día" (sin lo de la apertura, más lo que se dejó el día anterior, menos lo
  que se deja), con su desglose; antes, el efectivo del día.
- **Venta de la semana**: total hasta hoy, cuántos días con venta, local ·
  apps y el mejor día, con "Ver el resumen de la semana".
- **Gastos de la semana**: total en efectivo, cuántos son, las 3 categorías
  más altas y los pendientes de ingresar.
- **Utilidad de la semana**: la del Dashboard (con la nómina generada hasta
  hoy), venta − gastos, margen y nómina con su %, con "Ver Dashboard".
- **Nómina actual**: lo generado hasta hoy (como en el Dashboard), del lunes
  a hoy, cuántas personas y la semana completa proyectada. **Semana
  pasada**: el bruto completo, el neto a pagar y cuántas ya están pagadas.
  Ambas con "Ver nómina" (abre esa semana).
- **¿Cuánto le toca a…?**: la nómina de una persona en la semana — su "a
  recibir hasta hoy" igual que en Nómina (generado hasta hoy, más extras,
  menos adelantos y descuentos, cada uno en su renglón), cuántos días lleva,
  su semana completa y su sueldo por día, y si ya está pagada. El botón
  empieza con la primera persona del horario; debajo vienen los nombres de
  esa semana para cambiar de persona con un toque.
- **¿A quién falta pagar?**: de la semana pasada (o "esta semana" si se
  dice), el total que falta pagar, quién sigue en Pendiente con lo que le
  toca (de mayor a menor) y un renglón con las ya pagadas y lo que se les
  pagó.
- **Adelantos y descuentos**: el total de la semana y cada uno con su
  persona (los capturados en Nómina y los gastos del corte vinculados).
- **Propinas de la semana** (o de la semana pasada): el total, el mejor día
  y el reparto en tercios entre Cocina, Barra y Gerencia (el mismo de la
  pantalla de Propinas), con "Ver propinas".
- **Propinas por mesero**: de mayor a menor, con cuántos cortes tuvo cada
  quien; tocando un nombre se ven solo las suyas, día por día.

**Estadística** (con todo lo capturado): solo cuentan los días con venta
capturada — los cerrados o vacíos no bajan el promedio — y nunca el día de
hoy, que todavía no termina; por semana solo cuentan las semanas ya
cerradas. Los promedios se redondean al peso. Se pregunta con "promedio",
"normalmente", "por lo general", "qué día se vende más", "el mejor día" o
"récord", y sirve para venta, propinas y gastos ("propinas promedio de los
viernes", "gastos promedio por semana"):

- **Promedio de un día de la semana** ("venta promedio del martes", "cuánto
  vendemos normalmente los sábados"): el promedio, de cuántos días sale y
  desde cuándo, el promedio de los últimos 4, el mejor con su fecha, cuánto
  arriba o abajo del promedio quedó el último, y barras con los últimos 8
  (el más reciente en naranja). Debajo vienen Lun–Dom para ver el promedio
  de otro día. El botón arranca con el día de hoy.
- **¿Qué día se vende más?** (o "venta promedio" sin día): el promedio de
  cada día de la semana, de mayor a menor, con barras; arriba el día más
  fuerte y cuántas veces vende lo del más flojo.
- **Promedio semanal**: el promedio de las semanas cerradas, el de las
  últimas 4 y cómo quedó la más reciente contra el promedio, con barras de
  las últimas 8.
- **Mejor día** ("récord", "cuándo vendimos más"): el día con más venta (con
  local y apps), el 2º y el 3º, y "Ver el corte de ese día".

Si un día o semana no tiene nada capturado, lo dice ("Todavía no hay nada
capturado ese día"). Si no entiende la pregunta, responde "No entendí…" con
un ejemplo y las 3 preguntas más usadas para tocarlas. El dueño también
puede preguntar por cualquier receta ("cómo se prepara la Margarita", o
solo su nombre): responde con el vaso o presentación, ingredientes,
utensilios, preparación paso a paso y notas; el grupo **Recetario** sale en
"Ver todas las preguntas" en cuanto hay recetas. La lógica vive en
`src/lib/preguntas.ts` (dueño) y `src/lib/preguntasEquipo.ts` (personal) y
la pantalla en `src/components/PreguntasSheet.tsx`.

**Mi perfil (cuentas de equipo)**: arriba a la derecha, junto a cerrar
sesión, cada quien ve su foto en un círculo (sin foto, sus iniciales) en
todas sus pantallas, también en su corte; tocarla abre **Mi perfil**, que
también está como última opción de su inicio (que ahora saluda "Hola,
Luis"). Ahí ve su nombre, su puesto con su área ("Cocinero · Cocina") y
sus secciones, sin poder cambiarlos — los asigna el dueño en Personal — y
puede cambiar solo dos cosas: su **foto** (al tocar el círculo o "Cambiar
foto": "Tomar foto" con la cámara, "Elegir de la galería" o "Quitar foto")
y una **descripción** corta (hasta 200 letras, ej. "Me encanta preparar
las alitas"), con "Guardar". La foto se recorta sola en cuadro al centro
y se guarda chica (192 px en JPEG, ~10 KB) dentro de los datos, sin pasos
extra en Supabase; en el historial de Actividad el cambio sale como "Foto
de perfil" sin copiar la imagen. El dueño ve la foto de cada quien en
Equipo > Personal y, al abrir a alguien, su foto y su descripción con la
opción "Quitar foto" (por si subieron algo que no va). Al editar a alguien
en Personal ya no se pierde lo que el formulario no muestra (su foto, su
descripción ni su usuario del sistema del corte de apertura). Al entrar,
al personal le sale la novedad "Tu perfil".

**Datos para tu pago (Mi perfil del personal)**: abajo de la descripción,
cada quien pone a dónde depositarle su nómina: **banco** (de una lista:
BBVA, Banorte, Santander, Banamex, HSBC, Scotiabank, Banco Azteca,
BanCoppel, Inbursa, Banregio, BanBajío, Afirme, Nu, Mercado Pago, Spin by
OXXO, Hey Banco, Klar, Stori u Otro), **número de tarjeta (16 dígitos) o
CLABE (18)** — se escribe de 4 en 4, dice cuántos dígitos lleva, y no deja
guardar si faltan o sobran o si el número no es válido (revisa el dígito
de control de la tarjeta y de la CLABE, para atrapar errores de dedo) —,
**a nombre de quién** está (sale su nombre de Personal, editable) y la
casilla "Confirmo que estos datos son correctos y son míos". Nunca se pide
NIP, CVV ni fecha de vencimiento. Ya guardados se ven tapados ("BBVA ·
•••• 4321 · Tarjeta · confirmado el 22 oct") con "Cambiar". Tú los ves
completos con un botón **Copiar**: en Equipo > Nómina, debajo de cada
persona (o "Sin datos de pago todavía" si tiene cuenta y no los ha puesto),
y al abrir a alguien en Personal, con el titular y cuándo los confirmó.
Cada cambio queda en Actividad ("Mi perfil · Datos de pago"), sin el número
completo. Viven en su propia tabla de Supabase (`datos_pago`, fuera de los
datos de la app) que **solo pueden leer la persona y su dueño** — ninguna
otra cuenta del equipo, ni con conocimientos técnicos —; solo la persona
los guarda o cambia, y el dueño solo los lee. Para activarla hay que correr
una vez [`supabase/migration_009_datos_pago.sql`](./supabase/migration_009_datos_pago.sql)
en el SQL Editor de Supabase; mientras no se corra, al personal le dice
"Esta sección todavía no está activa" y a ti Nómina te avisa qué correr.
Al entrar, al personal le sale la novedad "Datos para tu pago".

**Ranking de meseros**: un puntaje por semana (lunes a domingo) con la venta
y las cancelaciones de cada mesero del corte — sin el usuario de para
llevar ni las apps —, con su foto de Personal (se liga por su usuario del
sistema o por su nombre). Solo cuentan personas: meseros del corte ligados
a alguien de Personal o el dueño (no "Domicilio", "Otro" ni usuarios
genéricos). **Puntos**: la venta promedio **por turno** da hasta 100 (100 =
quien más vende por turno en ese periodo). Cada día con venta es 1 turno y
un día con **Z (dobla)** en el horario cuenta 2 turnos solo si su puesto es
de mesero (un bar tender que dobla sigue contando 1). Cada 1% de
cancelaciones sobre su venta (gastos del corte con categoría Cancelaciones
ligados al mesero) resta 10. Cada **encuesta contestada válida** suma +3
sin importar la calificación, y además por las estrellas de atención: 5⭐
+2, 4⭐ +1, 3⭐ 0, 2⭐ −2, 1⭐ −4; las encuestas de un día (de trabajo: lo
de antes de las 5 am es del día anterior) suman solo cuando ya se le hizo
el corte a ese mesero ese día — mientras, en su desglose sale "2 encuestas
más suman en cuanto se haga tu corte" y en el ranking de encuestas, si solo
tiene esas, "3 contestadas esperan su corte". La venta y las
cancelaciones se actualizan en vivo en cuanto se captura el corte de cada
mesero, sin esperar a guardar el corte del día. Nunca baja de 0. Se aparece desde el
primer turno (con la etiqueta "1 turno"); para **ganar la semana** y sus
monedas hacen falta 2 turnos. Empates comparten lugar. **El personal del área Piso** (por el
área de su puesto en Personal) y quien tenga cortes como mesero en los
últimos 3 meses aunque sea de otra área (ej. de barra) lo ve sin ningún
monto (y también tiene Encuestas y Puntos): en su inicio una
tarjeta con su lugar de la semana ("3º de 8 meseros · 82 puntos" y cuántos
puntos le faltan para subir, o "¡Vas en primer lugar!") que abre la
sección **Ranking** — arriba el ganador de la última semana cerrada ("Ganó
la semana del 12–18: Jennifer" y "¡Felicidades, fuiste tú!" si fue esa
persona) y "⭐ En encuestas: …" con el ganador del ranking de encuestas,
"Esta semana" / "Semana pasada", el desglose de sus puntos (venta +N con
sus turnos y dobles, cancelaciones con su % −N, encuestas contestadas × 3
y calificación ±N; "Llevas 1 turno: con 2 ya puedes ganar la semana") y
dos rankings principales: **🏆 Ranking general** (debajo dice "Venta
por turno · cancelaciones · encuestas", para que se vea que no solo cuenta
vender; lugar, foto, nombre, barra y puntaje, una › y su fila resaltada con "Tú") y **⭐ Ranking de
encuestas** (solo los puntos de encuestas, con sus estrellas a media
estrella, el promedio y cuántas contestadas; al final, en gris, quien
generó pero no tiene contestadas — "Ninguna contestada todavía" — y quien
no ha generado — "No ha generado encuestas"). Debajo, **Ver más
rankings** abre cuatro listas chicas: 💰 Venta por turno (el personal ve
solo lugar y barra, "sin montos"; tú ves $/turno y turnos), 🧼 Menos
cancelaciones (%; tú además el monto), 📝 Más encuestas contestadas y ⭐
Mejor calificación (mínimo 3 encuestas). Al final, "¿Cómo se calcula?"
explica las reglas. **Tocar a alguien** abre su perfil público: foto, nombre, puesto ·
área, su descripción, su lugar y sus puntos en el periodo que se ve ("2º
esta semana · de 8", "95 puntos esta semana"), su calificación de
encuestas **desde el inicio** en estrellas (redondeada a media estrella,
con el promedio y el total de encuestas válidas: "4.6 · 23 encuestas"; con
menos de 3 sale "⭐ —"), sus logros y cuántas semanas ha ganado — sin sus
Monedas Anubis ni montos. Con el
ranking, una cuenta de Piso siempre entra a su inicio aunque tenga una sola
sección. **Tú** lo ves en Equipo > Ranking con la misma lista (y además el
del **mes**); en el perfil de cada quien te sale además "Solo tú" con su
venta por turno, turnos, cancelaciones en dinero y en % y sus Monedas
Anubis. En Pregúntale a
Cortes: el personal de Piso pregunta "¿en qué lugar voy?" (su lugar y la
lista, sin montos) y tú "ranking de meseros" o "¿quién va primero?" (con
montos). Al entrar, a las cuentas de Piso les salen las novedades "Ranking
de meseros", "Nuevo ranking: por turno y con encuestas" y "Tus encuestas suman
con tu corte". Las encuestas de cada quien por día de trabajo vienen de la
función `ranking_encuestas_dias` (ver
[`supabase/migration_020_encuestas_por_dia.sql`](./supabase/migration_020_encuestas_por_dia.sql),
ya aplicada, sobre
[`supabase/migration_019_ranking_encuestas.sql`](./supabase/migration_019_ranking_encuestas.sql):
solo conteos y estrellas, del negocio de quien pregunta, sin las de prueba
ni las sospechosas). Cálculo en `src/lib/ranking.ts`.

**Encuestas con QR**: las cuentas del área Piso tienen en su inicio
**Encuesta para el cliente**: escriben el total de la cuenta y la mesa
(las dos obligatorias: si falta una sale "Escribe el total de la cuenta."
o "Escribe la mesa." y no se genera), tocan "Generar QR" y le muestran al cliente un QR grande con un
contador ("Vence en 29:41") y "Cancelar esta encuesta"; cuando el cliente
la envía, en su celular sale "¡Gracias! Encuesta recibida" y "Generar
otra". Ahí mismo ven cuántas llevan hoy (máximo 15 al día), su
calificación de la semana (⭐ promedio y cuántas válidas) y, abajo, **Tus
encuestas de esta semana**: las que cuentan para su calificación (no las
sospechosas ni las descartadas), de la más nueva a la más vieja, cada una
con sus estrellas de atención, día y hora, mesa, total y "con comentario"
si dejó uno. Al tocar una ("Ver encuesta ›") se abre **la encuesta tal
cual la vio el cliente, ya respondida**: el logo, "¿Cómo te atendimos?",
"Te atendió …", una franja verde "✓ Contestada el [día y hora] · Mesa
[n]", el total que escribió, las estrellas que marcó en atención, comida
y rapidez, y su comentario (o "Sin comentario"), sin poder cambiar nada;
"Cerrar" regresa. Su usuario del sistema tiene que estar ligado a su
persona (por usuario del sistema o por nombre) para poder generarla. El
cliente escanea y se abre la encuesta en la misma dirección de la app
(`/?e=<código>`) sin iniciar sesión ni descargar nada, con Anubis. Primero
solo ve "Para empezar, escribe el total de tu cuenta (como viene en tu
ticket)" y el botón **Empezar** (sin total no avanza); después, arriba
queda "Total de tu cuenta: $…" con "Cambiar" (regresa a escribirlo), y
califica **atención de su mesero**, **comida** y **rapidez** de 1 a 5
estrellas, deja un comentario opcional y envía; es anónima. Si el total
no coincide con el del mesero no se le avisa: la encuesta queda como
sospechosa (ver abajo). **Para que no se ayuden entre
ellos**, una respuesta solo cuenta si: el total que escribe el cliente
coincide (±$1) con el que anotó el mesero; no se contesta desde un celular
donde alguien del equipo haya iniciado sesión (la app lo marca al entrar)
ni desde un celular que ya contestó otra en los últimos 7 días; se contesta
en 10 segundos o más; no es fuera de horario (de 3 a 10 de la mañana); y la
suma de los totales con encuesta de ese mesero en un día no pasa su venta
de ese día en el corte (esto lo revisa la app del dueño al abrir
Encuestas, y solo cuando el corte de ese mesero de ese día ya está
guardado: mientras no, la encuesta cuenta normal y se revisa después; lo
contestado antes de las 5 am cuenta para el día anterior, porque es del
mismo turno; si después ya no pasa, por ejemplo porque se corrigió el
corte, se le quita esa marca sola). Cada QR vale 30 minutos y una sola respuesta. Las que no
cumplen quedan como **sospechosas** y no cuentan hasta que el dueño las
aprueba. **En el ranking** cada encuesta contestada válida suma puntos
(+3 y lo de sus estrellas, ver Ranking de meseros) y tienen su propio
**Ranking de encuestas**. **El dueño**, en Equipo > Encuestas ("Esta semana",
"Semana pasada" o "Mes"): **Respuestas** (las válidas, con estrellas,
comida, rapidez, mesa, total y comentario), **Por mesero** (promedios y
cuántas) y **Sospechosas** (con el motivo y "Aprobar" / "Descartar"). Tocar una
tarjeta de Respuestas o de Sospechosas ("Ver encuesta ›") abre la misma
encuesta respondida que ve el mesero, tal cual la llenó el cliente
(Aprobar y Descartar no la abren). Se
guarda en Supabase en tablas protegidas (`encuestas` y
`encuesta_respuestas`, ver
[`supabase/migration_011_encuestas.sql`](./supabase/migration_011_encuestas.sql),
ya aplicada): el cliente solo puede ver el nombre del mesero y enviar su
respuesta una vez, sin leer nada; el personal ve los promedios y cada
mesero, solo sus propias respuestas que cuentan (con comentario, sin los
motivos de sospecha ni el celular, por la función `mis_encuestas`, ver
[`supabase/migration_014_mis_encuestas.sql`](./supabase/migration_014_mis_encuestas.sql),
ya aplicada); todas las respuestas, solo el dueño. Al entrar, a las cuentas de Piso les
sale la novedad "Encuestas para tus clientes".

**Seguimiento de encuestas (solo el dueño)**: en Equipo > Encuestas, la
cuarta pestaña **Seguimiento** (con el mismo periodo de arriba) muestra
cada paso de cada encuesta. Se guarda todo para siempre, sin poder
editarlo ni borrarlo (salvo las encuestas de prueba, ver abajo): cada **intento del mesero que no se generó** y por
qué (no escribió el total, no escribió la mesa, no está ligado a su usuario en Personal, ya
tenía las 15 del día o sin conexión; si no había conexión se guarda en su
celular y se manda en el siguiente intento), cuando se **genera**, cuando
el cliente la **abre** (y si la vuelve a abrir, ya contestada, vencida o
cancelada), cuando **empieza a contestar** (primera estrella o el total),
cuando la **envía** (válida, o sospechosa y por qué), cuando intenta
enviarla y ya no se podía, cuando el mesero la **cancela**, cuando se le
marca la venta del corte y cuando el dueño la **aprueba o descarta**; que
**venció** se sabe por su hora de vencimiento. La pestaña tiene: el
**embudo** (generadas → el cliente la abrió → empezó a contestar → la
envió → válidas, con su porcentaje), **Dónde se quedaron** (vencieron sin
abrirse, la abrieron y no la terminaron, canceladas, abiertas ahora,
sospechosas por revisar e intentos que no se generaron) y el tiempo típico
para abrirla y contestarla; **Por mesero** (cuántas generó, enviadas con
su porcentaje, sin abrir y fallidos; tocar un mesero muestra su resumen,
los intentos fallidos por motivo y solo su bitácora; "Ver a todos"
regresa) y la **Bitácora**: cada encuesta (mesero, mesa y total) con una
etiqueta de cómo terminó (Enviada, Sospechosa, Descartada, Se quedó a
medias, Nadie la abrió, Cancelada, Abierta ahora o No se generó) y cada
paso con su hora; de 30 en 30 con "Ver más". Se guarda en la tabla
protegida `encuesta_eventos` (ver
[`supabase/migration_012_seguimiento_encuestas.sql`](./supabase/migration_012_seguimiento_encuestas.sql),
ya aplicada): solo la lee el dueño y nadie escribe en ella directo; los
eventos del cliente tienen un tope por encuesta para que no la llenen
abriendo el enlace muchas veces. El mesero y el cliente no ven nada
distinto.

**QR de prueba (dueño)**: arriba de las pestañas de Equipo > Encuestas está
**"Generar QR de prueba"**: abre la misma pantalla del mesero ("QR de
prueba", regresa a "Encuestas") con un aviso de que es prueba; escribes el
total y la mesa (obligatorios, igual que el mesero) y sale el QR de 30 minutos con su cuenta
regresiva y "Cancelar esta encuesta". Al cliente le sale "Te atendió Prueba
(tu nombre)" y se contesta con los mismos candados (si la contestas desde
tu celular sale sospechosa por "celular del personal"; para verla como
cliente usa otro celular). Queda marcada **Prueba**: sale con esa etiqueta
en Respuestas, Sospechosas y la Bitácora de Seguimiento, pero no cuenta en
las calificaciones, el ranking, "Por mesero", el embudo ni "Dónde se
quedaron", ni en la revisión contra la venta del corte. Máximo 30 al día
(ver
[`supabase/migration_013_encuesta_prueba.sql`](./supabase/migration_013_encuesta_prueba.sql),
ya aplicada). La mesa obligatoria también la revisa Supabase al generar
cualquiera de las dos (ver
[`supabase/migration_015_mesa_obligatoria.sql`](./supabase/migration_015_mesa_obligatoria.sql),
ya aplicada).

**Borrar encuestas de prueba (dueño)**: debajo de "Generar QR de prueba"
sale **"Borrar todas las de prueba (n)"** (solo si hay alguna); al tocarlo
pregunta "¿Borrar las n encuestas de prueba? No se puede deshacer." con
"Sí, borrar" / "No". Para borrar una sola, cada encuesta de prueba trae
**"Borrar esta prueba"** (con la misma confirmación) en Respuestas,
Sospechosas y la Bitácora de Seguimiento — ahí también salen las que
nunca se contestaron. Se borra la encuesta con su respuesta y todos sus
pasos del seguimiento; las de los meseros no tienen el botón y Supabase
no deja borrarlas (ver
[`supabase/migration_016_borrar_pruebas.sql`](./supabase/migration_016_borrar_pruebas.sql),
ya aplicada). El máximo de 30 pruebas al día cuenta las que existen: si
borras, ese día puedes generar más.

**Monedas Anubis y logros**: "puntos" es solo lo del ranking (público);
lo que se junta para canjear son las **Monedas Anubis 🪙** (privadas). Al
**guardar el corte del domingo** la app cierra la semana (lunes a domingo)
con el ranking de esa semana (solo quienes tienen 2 turnos o más, con los
lugares recalculados entre ellos): guarda al ganador (o ganadores si
empatan), suma las monedas de cada quien y revisa los logros. Monedas por
semana: 1º lugar 100, 2º 70, 3º 50, los demás que aparecen en el ranking
20; **ranking de encuestas** 1º 50, 2º 30, 3º 20 (solo con puntos de
encuestas positivos); sin
cancelaciones +30; cada encuesta válida +5 (sin las de prueba ni las
sospechosas sin aprobar); promedio de atención de 4.5⭐ o más con 3 o más
encuestas +30. **Logros** (monedas extra la primera vez que se gana cada
nivel): 🏆 Primer lugar (ganar una semana, +50); 🔥 Racha de campeón (2, 4
y 8 semanas seguidas en 1er lugar: +100, +200, +400); 🧼 Manos limpias (2,
4 y 8 semanas seguidas sin cancelaciones: +50, +100, +200); 😊 Clientes
felices (2, 4 y 8 semanas seguidas sin malas encuestas —1 o 2⭐ de
atención— con 3 o más encuestas: +50, +100, +200); 🥉 Siempre en el podio
(3, 6 y 12 semanas seguidas en el top 3: +75, +150, +300); 13 en total.
Una semana sin cerrar o en la que no aparece corta la racha. Las monedas se
**acumulan** para canjearse más adelante. **Cada persona** (de Piso o con
cortes) las ve en **Mi perfil**: la tarjeta dorada "🪙 Mis monedas Anubis"
con el total, lo que ganó la última semana y el historial (cada suma con
su motivo y 🪙; "Ver todo"), y **Mis logros · N de 13** con los ganados en
color y los que siguen en gris con sus monedas y cuánto lleva ("llevas
2"). Las monedas de los demás no las ve nadie más que tú; los logros y el
ganador sí, en el ranking (el ganador arriba y los logros en el perfil de
cada quien). **Tú**, en Equipo > **Monedas y logros**: la semana pasada
(cerrada y quién ganó, o "Cerrar semana" si no se cerró; "Recalcular
semana" si corregiste un corte de esa semana: anula lo que esa semana
había dado y lo vuelve a calcular, sin duplicar), "Monedas de cada quien"
(lo de la última semana y el total; tocar a alguien muestra sus logros y
su historial), **Ajustar monedas** (persona, monedas con − para quitar y
motivo; aquí irán los canjes) y las semanas cerradas con "Recalcular". Se
guarda en tablas protegidas (ver
[`supabase/migration_015_puntos.sql`](./supabase/migration_015_puntos.sql),
ya aplicada): las monedas son un historial de movimientos que nadie edita
ni borra; cada quien lee solo las suyas (la app del dueño liga cada cuenta
de equipo con su mesero del corte en `meseros_cuentas`), y solo el dueño
escribe. Al entrar, al personal de Piso y con cortes le salen las
novedades "Puntos y logros" y "Monedas Anubis". **Carga inicial**: la
primera vez que el dueño abre su app con esta versión, se cierran solas
(una sola vez, `monedasCargaInicial`) todas las semanas pasadas que no
estén cerradas, desde la primera con cortes hasta la semana pasada, de la
más vieja a la más reciente, con las mismas reglas (así las rachas y los
logros salen como si el sistema hubiera existido desde el inicio; las
encuestas empezaron el 22 de octubre). No sale ningún aviso más que la
novedad "Ya tienes monedas de semanas pasadas", que le aparece a quien
juega el ranking solo cuando la carga ya se hizo. Cálculo en
`src/lib/puntos.ts`.

**Acceso de invitado (solo lectura, con recorrido)**: para enseñarle Cortes
a alguien (ej. un jefe) con los números reales sin que pueda cambiar nada.
**Tú**, en Equipo > Personal, abajo, en **Acceso de invitado**: "▶ Probar
el recorrido como lo verá" (abre la bienvenida y el recorrido en tu
cuenta en solo lectura, con la franja "Vista de invitado (prueba) · Ver
recorrido · Salir"; ahí la opinión no se guarda) y el formulario con
nombre, PIN de 4 números y vencimiento (en 3, 7, 14 o 30 días, a las
11:59 pm) → "Crear acceso" (entra igual que el personal: su nombre en
"¿Quién eres?" y su PIN). Cada invitado sale con cuántos días le quedan,
su último uso y qué pantallas vio (de la Actividad), su opinión y "Quitar
acceso" (con confirmación). **El invitado** entra a la app como la ves tú
—todas las secciones, sin ocultar nada— con la franja "Solo lectura ·
puedes ver todo, no se guarda nada · Ver recorrido". Los botones que
guardan, borran o cambian algo siguen a la vista pero deshabilitados con
🔒 (al tocarlos sale "Solo lectura: aquí se puede ver todo, pero no se
guarda nada"); la app no guarda nada en ese modo y la base rechaza
cualquier escritura de esa cuenta (candado doble). Al entrar le sale la
**bienvenida** (cortes capturados, personas en el equipo, semanas de
historial y encuestas de clientes, reales) con "Empezar recorrido (3 min)"
o "Explorar por mi cuenta". El **recorrido** son 11 pasos; cada uno abre
la pantalla real, oscurece lo demás e ilumina la sección, con qué es y
"Para el negocio: …": Inicio, Corte del día y efectivo, Gastos en efectivo
y transferencias, Dashboard (el reporte al momento), Tendencias y
diagnósticos, Horarios → nómina automática, Pregúntale a Cortes, Ranking
de meseros, Encuestas con QR, Inventario/pedidos/recetarios y Seguridad y
Actividad ("Siguiente", "‹", "Saltar" y los puntos de avance). Al terminar,
**su opinión**: de 1 a 5 estrellas, "¿Qué fue lo que más te gustó?"
(varias), "¿La usarías en otras sucursales?" (Sí / Tal vez / No) y "¿Qué
le mejorarías o qué te gustaría que tuviera?"; si no la deja, puede
hacerlo después desde "Ver recorrido". Al vencer, al entrar le sale "Tu
acceso de invitado ya venció" y la base ya no le deja leer nada. Lo que
abre queda en Actividad. Ver
[`supabase/migration_017_invitados.sql`](./supabase/migration_017_invitados.sql)
(ya aplicada): el invitado es una cuenta de equipo con `invitado_hasta`;
mientras está vigente lee todo el negocio de su dueño y no escribe en
ninguna tabla; su opinión va a `invitado_opiniones` (solo la lee el
dueño). De paso, una cuenta de equipo ya no puede cambiarse a sí misma el
rol, los permisos, su persona de Personal ni el vencimiento.

**Notificaciones en tu iPhone (solo el dueño)**: en **Mi perfil**, abajo,
"🔔 Notificaciones en este iPhone". En iPhone solo funcionan con Cortes
instalado en la pantalla de inicio (Safari → Compartir → "Agregar a
pantalla de inicio"); si no, sale cómo instalarla. Con la app instalada,
"Activar en este iPhone" pide el permiso y guarda el dispositivo
("✓ Activadas en este iPhone", "Mandar notificación de prueba" y "Apagar
en este iPhone"). Interruptores: **Conteo de Cocina** y **Conteo de Bar**
(si no se ha hecho a su hora límite), **Al guardar un conteo** (quién lo
hizo y qué productos quedaron en 0 o sin contar, o "✅ Completo"; llega
cuando lleva 10 minutos sin cambios) y **Gastos pendientes** (todos los
días a la hora elegida si hay 1 o más, con cuántos, el total y los
primeros). En "Hora límite de cada conteo" eliges la hora de cada día para
Cocina y para Bar (de 6:00 pm a 7:30 am; de 12:00 am en adelante es ya la
madrugada siguiente — de inicio: lunes a jueves 1:00 am, viernes y sábado
2:00 am, domingo 12:00 am), cada cuánto se repite si sigue sin hacerse
(3, 6, 9 —de inicio—, 12 o 24 horas, hasta que se haga; se revisan los
últimos 3 días) y a qué hora llegan los gastos pendientes (11:00 am de
inicio). Al guardar un conteo la app anota quién y a qué hora
(`conteosEditados`). Llegan aunque la app esté cerrada: en Supabase,
pg_cron llama cada 5 minutos a la función `notificaciones`
(`supabase/functions/notificaciones`), que revisa qué toca con
`src/lib/notificacionesLogica.ts` (empaquetado como `logica.js`:
`npx esbuild src/lib/notificacionesLogica.ts --bundle --format=esm
--target=es2022 --outfile=supabase/functions/notificaciones/logica.js`),
manda cada aviso una sola vez (`notif_enviadas`) por Web Push cifrado
(`webpush.ts`, sin dependencias) y deja de usar un dispositivo que ya no
existe. Ver
[`supabase/migration_018_notificaciones.sql`](./supabase/migration_018_notificaciones.sql)
(ya aplicada); la llave privada VAPID y el secreto de pg_cron viven en
Supabase Vault, no en el código. La app ya se instala en pantalla
completa (`manifest.webmanifest` con `display: standalone` y
`public/sw.js`, que solo recibe las notificaciones y no guarda caché). Es
una app web: el iPhone no le permite alertas "críticas" que suenen en
silencio; para que se noten más, en Ajustes › Notificaciones › Cortes pon
sonido y avisos "Persistentes", y agrega Cortes a las apps permitidas de
No molestar / Dormir.

**Tu perfil (dueño)**: si también tienes cortes como mesero (tu usuario
del corte se liga por tu persona en Personal o por tu nombre), arriba de
tus datos sale **🏆 Mi ranking** —tu lugar y tus puntos de esta semana,
tus encuestas desde el inicio en estrellas, cuántas semanas has ganado y
"Ver el ranking ›"— y debajo tus **Monedas Anubis** y **logros**, igual
que el personal. Además, arriba a la derecha, en todas tus pantallas, está
tu foto en un círculo (sin foto, tus iniciales); tocarla abre **Mi
perfil**: ahí cambias tu foto (igual que el personal: cámara, galería o
quitarla), tu **nombre** y una descripción, y ves "Cuenta: Dueño · acceso a
todo". No hay que ligar nada a mano: si en Personal hay alguien que se llama
igual que el nombre de tu perfil (sin importar mayúsculas ni acentos), la
app sabe que eres tú — en tu perfil sale su puesto ("Gerente · Gerencia") y
en Personal esa fila lleva tu foto y la etiqueta "Tú". Si nadie se llama
igual, tu perfil no muestra puesto. Tu perfil se guarda aparte del de esa
persona; no cambia nada de tu acceso ni lo ve el personal.

**Pregúntale a Cortes para el personal**: todas las cuentas de equipo tienen
el mismo botón verde 💬 (abajo a la derecha, en todas sus pantallas: su
inicio, cada sección y su corte), con el mismo autocompletado y micrófono.
Cada quien solo pregunta de las secciones a las que ya tiene acceso — sus
permisos y sus días de corte asignados — y las respuestas salen de su
propia información; nunca de venta de la semana, utilidad, la nómina de
otra persona ni días que no tiene asignados. Si pregunta algo de fuera,
responde "Eso no está en tus secciones" con las secciones de las que sí
puede preguntar. Una cuenta que no está ligada a nadie en Personal (p. ej.
un mesero con días asignados) solo pregunta de su corte; y cualquier cuenta
que no sea la del dueño, aunque algo falle al armar sus secciones, nunca ve
las preguntas del dueño. Además cada respuesta revisa otra vez que el tema
sea de sus secciones antes de contestar. Por sección:

- **Corte** (solo sus días asignados; arranca en hoy si se lo asignaron, si
  no en el último que ya pasó): efectivo a entregar (igual que "Efectivo
  del día", con la apertura y lo que se dejó), qué falta para guardar el
  corte (lo mismo que avisa "Guardar corte", o "Ya está guardado"),
  tarjetas del día por mesero, gastos del día con su etiqueta
  Pendiente/Ingresado y quién abre (X o Z del horario). Si tiene varios
  días, debajo vienen para cambiar; "Ir a mi corte" abre ese día.
- **Nómina** (solo la suya): cuánto llevo esta semana (su "a recibir hasta
  hoy" con bruto, extras, adelantos y descuentos), ¿ya me pagaron la
  semana pasada? (con la etiqueta Pagada/Pendiente), mis adelantos y
  descuentos y qué días trabajo esta semana (su renglón del horario: X
  abre, Z dobla, OFF descansa).
- **Propinas**: solo las ven las cuentas de **Bar y Cocina** (por su
  puesto) que tengan el permiso; el dueño las sigue viendo como siempre.
  Hoy, ayer, esta semana o la pasada: lo que le toca a su área (su tercio)
  y el total del que sale — nunca las propinas por mesero.
- **Horarios** (solo su área): quién trabaja, quién descansa y quién abre
  hoy, mañana o cualquier día de la semana (con Lun–Dom para cambiar), y
  su propio horario de la semana.
- **Conteo diario** (su área): qué falta por contar hoy (los productos sin
  cantidad en el conteo de hoy, o si todavía no se guarda), qué hay que
  pedir (el último pedido guardado; Bar no hace pedido diario) y cuánto
  había de un producto en el último conteo (el autocompletado trae los
  productos de ese conteo).
- **Inventario**: si ya se guardó el de esta semana (jueves y domingo, con
  el mismo estado que su pantalla) y el último pedido del inventario.
- **Recetario** (solo las recetas de su área): "Cómo se prepara…" con la
  lista de recetas para tocar, o directo por nombre.

Arriba salen sus 3 preguntas más usadas; mientras no tenga, una de cada
sección empezando por la que más abre (cada cuenta cuenta en su propia
cuenta cuántas veces entra a cada sección, sin tablas nuevas). Los enlaces
de cada respuesta lo llevan a esa sección. Cada pregunta del personal queda
en **Actividad** como "Preguntó: “cuánto llevo esta semana”" (con su nombre
y hora, igual que las pantallas que abre), para ver qué le interesa a cada
quien; lo que pregunta el dueño no se registra. Al entrar, al personal le
sale la novedad "Pregúntale a Cortes" (de toda la app: le sale a cualquiera
que ya entraba antes).

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
8. Corre también [`supabase/migration_009_datos_pago.sql`](./supabase/migration_009_datos_pago.sql).
   Crea la tabla protegida de los datos para el pago de nómina (Mi perfil),
   que solo pueden ver cada persona y su dueño.
9. Ve a **Authentication → Sign In / Providers → Email** y **apaga "Confirm
   email"**. Es obligatorio: las cuentas del equipo usan un correo técnico
   que no es real, así que nunca podrían confirmarse por correo.
10. Ve a **Authentication → Users → Add user** y crea **un solo usuario para
   ti** (el dueño), con tu correo y una contraseña. Copia su **User UID** (lo
   verás en la lista de usuarios). A tu compañero **no** lo crees aquí — eso
   se hace desde la app en el paso 4 más abajo.
11. Vuelve a **SQL Editor** y da de alta tu perfil de dueño, reemplazando el
   UUID por el que copiaste:

   ```sql
   insert into public.profiles (id, role, display_name)
     values ('UUID-DEL-DUEÑO', 'owner', 'Tu nombre');
   ```

12. Ve a **Project Settings → API** y copia:
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

## Ícono de la app

El ícono es un **Anubis geométrico** de perfil (cabeza negra con facetas,
interior de orejas y collar en dorado, y el ojo de Horus en trazos dorados
finos) sobre fondo **rojo sólido**: Anubis es el que pesa y cuadra, y el
ojo de Horus el que todo lo ve — el guardián de las cuentas. Vive en
`public/`: `favicon.svg` (pestaña del navegador, con esquinas
redondeadas), `apple-touch-icon.png` (180 px, el que usa el iPhone al
agregar la app a la pantalla de inicio), `icon-192.png` e `icon-512.png`
(Android) e `icon-maskable-512.png` (Android, con margen para que el
celular lo recorte en círculo o en la forma que use), declarados en
`manifest.webmanifest` y en `index.html`. Para que un celular que ya tenía
la app en su pantalla de inicio muestre el ícono nuevo, hay que quitar ese
acceso y volver a agregarlo.

El mismo ícono (`favicon.svg`) es el logo dentro de la app: va arriba a la
izquierda en lugar de la palabra "Cortes" (38 px, con esquinas redondeadas),
en todas las pantallas del dueño y del personal — al lado sigue el mes en
Corte o el área del personal —, y en grande (84 px) en lugar del título en
la pantalla de entrar con correo. La pestaña del navegador y el nombre de
la app en el celular siguen diciendo "Cortes".

**Barra de arriba**: junto al logo va el nombre de la pantalla en la que
estás y, si se puede regresar, una flecha **‹** antes (hace lo mismo que el
"← Inicio" / "← Equipo" / "← Negocio" que antes iba abajo) — en todas las
pantallas del dueño y del personal. En las pestañas principales no hay
flecha: Inicio (el saludo), Corte (con el mes debajo), Equipo, Negocio,
Dashboard y el inicio del personal ("Hola, Luis", con su área debajo). Los
botones que iban junto al título (como el + de Personal) se quedan abajo,
en su fila. Los nombres largos nunca se cortan: pasan completos al siguiente
renglón, partiendo solo en los espacios (y con letra un poco más chica si
son muy largos). Cada pantalla pone su título con `<TituloPagina>` (ver
`src/components/BarraTitulo.tsx`) y este se dibuja en la barra.

## Estructura del proyecto

```
src/
  lib/            dataModel (lógica pura), types, supabaseClient, auth, useAppData,
                  gastosBusqueda (búsqueda de tickets, historial de nombres, ortografía)
  components/
    ui.tsx        Sheet, Field, inputs, Toggle, Empty
    ConceptoInput.tsx  cuadro de concepto de gasto con autocompletado y ortografía
    panels/InicioPanel.tsx  Inicio del dueño (alertas); cálculo en lib/inicio.ts y lib/consumo.ts
    panels/ImportarCatalogoPanel.tsx  Negocio > Compras > Importar catálogo; lectura del Excel en lib/excelPrecios.ts
    EncuestaRespondida.tsx  la encuesta del cliente ya respondida (dueño y mesero)
    lib/nominaVenta.ts  Tendencias > Nómina vs. venta (meta 15–16%, por día y sugerencias)
    lib/avanceImage.ts  Dashboard > Copiar avance al momento (imagen de mitad de semana)
    panels/CargarPedidosPanel.tsx  Pedidos pegados de WhatsApp (permiso "Pedidos"); lectura y suma en lib/pedidosCargados.ts
    panels/RecetarioPanel.tsx  Recetario (dueño edita y carga varias, equipo consulta); formato en lib/recetasTexto.ts
    NovedadesAlEntrar.tsx  slider de novedades al entrar (cuentas de equipo); lista en lib/novedades.ts
    modals/       un modal por acción (mesero, gasto, transferencia, etc.)
    modals/CorteMeseroAsistente.tsx  corte de mesero paso por paso (el "+" de meseros en Corte)
    modals/GastoAsistente.tsx, TransferAsistente.tsx  gasto y transferencia paso por paso
    modals/asistente.tsx  piezas compartidas de los pasos (marco, formulario de gasto, "¿Se rebaja de algún corte?")
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
  migration_009_datos_pago.sql         datos de pago de nómina (solo la persona y su dueño)
  migration_010_cerrar_rls_auto_enable.sql  quita el acceso público a una función interna de Supabase
  migration_011_encuestas.sql          encuestas con QR por mesero (tablas protegidas y funciones)
  migration_012_seguimiento_encuestas.sql  seguimiento de cada paso de las encuestas (solo el dueño)
  migration_013_encuesta_prueba.sql    QR de prueba del dueño (no cuenta en calificaciones)
  migration_014_mis_encuestas.sql      el mesero ve sus encuestas contestadas
  migration_015_puntos.sql             Monedas Anubis y logros semanales (cada quien ve solo las suyas)
  migration_015_mesa_obligatoria.sql   la mesa es obligatoria para generar la encuesta
  migration_016_borrar_pruebas.sql     el dueño borra sus encuestas de prueba
  migration_017_invitados.sql          acceso de invitado de solo lectura y su opinión
  migration_018_notificaciones.sql     notificaciones del dueño en su iPhone (y pg_cron)
  migration_019_ranking_encuestas.sql  encuestas por mesero para el ranking (conteos y estrellas)
  migration_020_encuestas_por_dia.sql  lo mismo por día de trabajo (suman con el corte del mesero)
```
