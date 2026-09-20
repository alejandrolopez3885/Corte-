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

- **Frontend**: React + Vite + TypeScript.
- **Backend**: Supabase (Auth + Postgres).
- **Hosting sugerido**: Vercel.

La vista del dueño se organiza en 4 secciones, accesibles desde la barra de
navegación de abajo — tocar una pestaña siempre regresa al inicio de esa
sección, aunque ya estés adentro de una de sus páginas (ej. tocar "Equipo"
estando en Nómina te regresa al menú de Equipo):

- **Corte**: la pantalla principal — mes, semana, día, meseros, gastos,
  transferencias, ventas de apps y sus resúmenes.
- **Equipo**: menú con 5 opciones — "Tu equipo" (dar de alta a quien te
  apoya con PIN y asignarle días, como modal), "Meseros" (catálogo de
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
  y tocar a alguien lo abre para editar o eliminar), "Horarios" (arma el horario
  semanal en dos áreas fijas, PISO y COCINA — no se pueden crear, renombrar
  ni borrar áreas — usando las mismas semanas de Corte; un toque en la
  celda cicla OFF → O → X → Z, y al llegar a Z se abre un modal para
  capturar una hora de entrada en su lugar; al abrir una semana nueva se
  precarga con la última semana capturada para solo ajustar lo que cambió)
  y "Nómina" (calculada sola a partir de Horarios y el sueldo diario de
  cada quien: Z paga doble, O/X y cualquier hora capturada pagan 1x, y el
  descanso OFF solo se paga si esa semana se trabajaron los otros 6 días —
  el sueldo semanal completo, sueldo diario × 7, solo se alcanza así. Ahí
  mismo, por persona, se capturan descuentos itemizados — tardanza,
  adelanto de efectivo, comida u otro, cada uno con su propio concepto y
  monto — y la tarjeta de cada quien muestra bruto, cada descuento y el
  neto a pagar; el total de la semana también se ve en bruto/descuentos/
  neto. Un gasto del corte diario categorizado "Nómina" o "Comida
  empleado" también se puede vincular a un empleado de Personal — por
  ejemplo, un adelanto que sale del corte de otra persona —, y ese gasto
  aparece solo como descuento en la nómina del empleado elegido, marcado
  "Corte" y sin poder borrarse desde ahí — se edita o se quita desde el
  gasto mismo en Corte. Cada quien también muestra "Generada hasta hoy",
  el bruto acumulado solo de los días de esa semana cuya fecha ya pasó (o
  es hoy) — útil para ver a media semana cuánta nómina llevas, sin esperar
  a que termine; en una semana ya cerrada equivale al bruto completo, y en
  una futura es $0 —, con su propio total para todo el personal). Un botón
  "Descargar imagen del desglose (sueldo bruto)" genera y descarga un PNG
  con la nómina de esa semana sin descuentos, agrupada por área con
  subtotales y un total general al final, imitando la hoja de cálculo que
  se usaba antes para esto — pensado para compartirlo por WhatsApp con
  quien paga. Personal
  sigue siendo una lista aparte del catálogo de Meseros — este es solo
  nombre, sin sueldo, para el corte.
- **Negocio**: catálogo de proveedores (nombre y la
  marca de "también se pide los jueves" — el mismo proveedor que se elige
  en el Catálogo de Bar/Cocina y que agrupa la lista en Inventario; no se
  puede eliminar un proveedor mientras tenga algún insumo asignado, para
  no perder esa referencia ni el historial ya guardado en Inventario);
  agrupadas bajo "Control de gastos",
  Control de gastos en efectivo y Control de gastos en transferencia; y
  bajo "Análisis", "Tendencias" — comparativo semana tras semana de todo
  el historial capturado (sin importar el mes) con una proyección de
  venta para la próxima semana (promedio ponderado de las últimas hasta 4
  semanas, con más peso a las recientes, ajustado por la tendencia
  promedio de esa ventana; con menos de 3 semanas de base se marca como
  poco confiable), una cuadrícula de KPIs con su cambio semana a semana y
  minigráfica (Venta total, Utilidad, Margen, Gastos totales, Nómina), una
  gráfica de venta con la proyección marcada aparte, y una tabla detallada
  por semana; bajo "Bar", "Control de Bar"; y bajo "Cocina", "Control de
  Cocina" — las dos abren primero a un menú propio (para poder ir sumando
  ahí compras como opción hermana más adelante), con dos piezas
  construidas, en este orden: "Conteo diario" primero (lista solo los
  insumos de esa área marcados de alta rotación en el catálogo, agrupados
  por proveedor igual que el Catálogo y que Inventario, con un campo para
  capturar cuánto queda; usa los mismos filtros de Mes/Semana y los
  mismos chips de día que ya se usan en Corte, así que se puede entrar y
  revisar o capturar el conteo de cualquier día, no solo el de hoy, y
  cada día se guarda por separado por su fecha real. En cuanto se
  guarda un conteo, sus campos quedan bloqueados para evitar ediciones
  accidentales; para corregirlo hay que tocar "Editar", confirmar un
  aviso de que no debería modificarse salvo que sea necesario, y recién
  ahí se desbloquea) y "Catálogo" después: cada insumo tiene nombre, un
  precio de referencia opcional y un proveedor opcional (el mismo
  catálogo de proveedores en ambas áreas, y se puede crear uno nuevo al
  vuelo desde el propio insumo), agrupados en la lista por proveedor, y
  una marca de "alta rotación" para que aparezca en el Conteo diario. La
  unidad de medida es un selector con solo dos opciones, Kg o Pieza — en
  Cocina se elige libremente (Kg por default), y en Bar queda fijo en
  Pieza y el selector se ve bloqueado, porque ahí siempre se cuenta por
  pieza; bajo "General", "Control General" — mismo Catálogo (nombre,
  unidad libre entre Kg/Pieza, precio, proveedor), pero sin Conteo diario
  ni la marca de "alta rotación" (que no aplica sin conteo diario propio):
  abre directo al catálogo, sin menú intermedio, porque es su única
  función. Es para insumos que gerencia maneja aparte, sin ser de Bar ni
  de Cocina — desechables, limpieza y similares; y bajo "Compras", "Inventario" — la lista de insumos de
  Bar, Cocina y General agrupada por proveedor (reemplaza la hoja de cálculo que
  se usaba antes para esto), con los mismos filtros de Mes/Semana y un
  campo de cantidad por insumo. Un switch "Completo" (domingo, cuenta
  todos los proveedores) / "Jueves" (solo los proveedores marcados con
  "también se cuenta los jueves", editable desde ahí mismo con un atajo
  al catálogo de Proveedores) decide qué insumos se muestran — se evita
  a propósito la palabra "pedido" en esta pantalla, porque todavía es
  solo un conteo de inventario, no un manejo real de pedidos. Debajo hay
  otro filtro, "Todas/Bar/Cocina/General", para contar un área a la vez
  sin tener que ver la lista completa. Ya no se
  guarda cada campo solo al salir de él: hay un botón "Guardar
  inventario" para lo que esté visible en ese momento (semana + modo +
  área), y en cuanto se guarda, esos campos quedan bloqueados para evitar
  ediciones accidentales — para corregir hay que tocar "Editar", confirmar
  un aviso de que no debería modificarse salvo que sea necesario, y recién
  ahí se desbloquea; igual que ya funciona Conteo diario. El bloqueo es
  por área dentro de la semana (compartido entre los modos Completo y
  Jueves, pero independiente entre Bar/Cocina/General) — así guardar Bar
  no bloquea Cocina ni General de la misma semana, y guardar cualquier
  área nunca borra lo ya capturado en las demás. El manejo de
  compras/pedidos en sí (qué se pidió,
  cuánto, si llegó) se deja para más adelante, como una sección aparte.
- **Dashboard**: reporte de resultados de la semana, solo para leer (con
  porcentajes sobre la venta total): Venta total, Gastos operativos (suma
  los de efectivo categorizados como Operación más los de transferencia),
  Gastos fijos, las 3 comisiones de apps, el resto de categorías de gastos
  en efectivo desglosadas una por una (Nómina, Cortesía, Retiro,
  Mantenimiento, Comida empleado, Envíos, Cancelaciones — con su propio
  desglose por mesero, nombre y total de la semana, porque un gasto de
  Cancelaciones en Corte se le puede asignar a un mesero del catálogo —,
  Otro, Sin categoría) y Nómina "(hasta hoy)" (el bruto de Equipo > Nómina
  generado solo hasta hoy en esa semana — no la semana completa, para que
  el reporte sea en tiempo real —, sin restar los descuentos, con un link
  directo al desglose) — y al final la Utilidad (Venta
  total menos todo lo anterior).

Hay 2 tipos de cuenta:

- **Dueño (`owner`)**: acceso completo — todos los meses, semanas y días,
  catálogo de meseros, resúmenes. Inicia sesión con correo y contraseña.
- **Staff (`staff`)**: solo puede capturar el corte de **los días que el
  dueño le asigne** (una o varias fechas, desde la sección "Equipo"). El
  dueño da de alta a esta persona **desde la misma app**
  (nombre + PIN de 4 dígitos, sin correo) — no hace falta crearla en el
  dashboard de Supabase. Esa persona entra desde "Soy del equipo, tengo un
  PIN" en la pantalla de inicio, elige su nombre y teclea su PIN; si tiene
  varios días asignados, primero elige cuál va a capturar.

  Por debajo sigue siendo una cuenta real de Supabase Auth (con un correo
  técnico invisible tipo `xxxx@cortes.local` y el PIN como contraseña), así
  que reutiliza toda la seguridad y sesiones ya construidas. Las fechas
  asignadas sí viven en su propia tabla con permisos (RLS): el staff solo
  puede leer sus propias fechas, y solo el dueño puede asignarlas o
  quitarlas. Al quitar una fecha, esa persona pierde acceso a ese día de
  inmediato — la app revisa sus fechas asignadas cada ~20 segundos mientras
  está abierta, así que no necesita cerrar sesión ni recargar para que la
  revocación tome efecto. Lo que sigue viviendo solo en la interfaz es el
  acceso al resto del negocio (catálogo, otros meses/semanas): a nivel de
  base de datos el staff puede leer y escribir el mismo registro `app_data`
  que el dueño.

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
7. Ve a **Authentication → Sign In / Providers → Email** y **apaga "Confirm
   email"**. Es obligatorio: las cuentas del equipo usan un correo técnico
   que no es real, así que nunca podrían confirmarse por correo.
8. Ve a **Authentication → Users → Add user** y crea **un solo usuario para
   ti** (el dueño), con tu correo y una contraseña. Copia su **User UID** (lo
   verás en la lista de usuarios). A tu compañero **no** lo crees aquí — eso
   se hace desde la app en el paso 4 más abajo.
9. Vuelve a **SQL Editor** y da de alta tu perfil de dueño, reemplazando el
   UUID por el que copiaste:

   ```sql
   insert into public.profiles (id, role, display_name)
     values ('UUID-DEL-DUEÑO', 'owner', 'Tu nombre');
   ```

10. Ve a **Project Settings → API** y copia:
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
  lib/            dataModel (lógica pura), types, supabaseClient, auth, useAppData
  components/
    ui.tsx        Sheet, Field, inputs, Toggle, Empty
    modals/       un modal por acción (mesero, gasto, transferencia, etc.)
  pages/
    Login.tsx
    CortesApp.tsx vista principal (dueño y staff)
supabase/
  schema.sql                        tablas y políticas RLS base
  migration_002_staff_pin.sql       tabla de directorio para el login por PIN
  migration_003_staff_assignments.sql  fechas asignadas (varias por persona)
  migration_004_assignment_week.sql    semana elegida a mano por asignación
  migration_005_realtime.sql           activa la sincronización en vivo
```
