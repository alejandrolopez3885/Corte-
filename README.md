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
navegación de abajo:

- **Corte**: la pantalla principal — mes, semana, día, meseros, gastos,
  transferencias, ventas de apps y sus resúmenes.
- **Equipo**: dar de alta a tu personal y asignarle días.
- **Negocio**: catálogo de meseros y, agrupadas bajo "Control de gastos",
  Control de gastos en efectivo y Control de gastos en transferencia.
- **Dashboard**: reporte de resultados de la semana, solo para leer (con
  porcentajes sobre la venta total): Venta total, Gastos operativos (suma
  los de efectivo categorizados como Operación más los de transferencia),
  Gastos fijos, las 3 comisiones de apps, el resto de categorías de gastos
  en efectivo desglosadas una por una (Nómina, Cortesía, Retiro,
  Mantenimiento, Comida empleado, Envíos, Cancelaciones, Otro, Sin
  categoría) y Nómina — hasta que exista un generador de nómina, esta
  última se captura a mano ahí mismo — y al final la Utilidad (Venta total
  menos todo lo anterior).

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
