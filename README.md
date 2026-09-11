# Cortes

App para llevar el corte de caja diario de un restaurante: por mesero (venta,
tarjetas, propina, gastos y transferencias), organizado por mes → semana →
día, con resúmenes semanales y conciliación de efectivo.

- **Frontend**: React + Vite + TypeScript.
- **Backend**: Supabase (Auth + Postgres).
- **Hosting sugerido**: Vercel.

Hay 2 tipos de cuenta:

- **Dueño (`owner`)**: acceso completo — todos los meses, semanas y días,
  catálogo de meseros, resúmenes. Inicia sesión con correo y contraseña.
- **Staff (`staff`)**: solo puede capturar el corte del **día que el dueño le
  asigne** (por fecha, desde el ícono de calendario en la barra superior).
  El dueño da de alta a esta persona **desde la misma app** (nombre + PIN de
  4 dígitos, sin correo) — no hace falta crearla en el dashboard de Supabase.
  Esa persona entra desde "Soy del equipo, tengo un PIN" en la pantalla de
  inicio, elige su nombre y teclea su PIN.

  Por debajo sigue siendo una cuenta real de Supabase Auth (con un correo
  técnico invisible tipo `xxxx@cortes.local` y el PIN como contraseña), así
  que reutiliza toda la seguridad y sesiones ya construidas. La restricción a
  un solo día vive en la interfaz, no en la base de datos: a nivel de base de
  datos el staff puede leer y escribir el mismo registro que el dueño. Si en
  el futuro necesitas que esa restricción sea también a nivel de base de
  datos, hay que pasar a tablas relacionales por día — puedes pedírmelo
  cuando quieras.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**.
2. Cuando esté listo, entra a **SQL Editor** → **New query**, pega todo el
   contenido de [`supabase/schema.sql`](./supabase/schema.sql) y dale **Run**.
   Esto crea las tablas `profiles` y `app_data` con sus políticas de acceso
   (RLS).
3. Corre también [`supabase/migration_002_staff_pin.sql`](./supabase/migration_002_staff_pin.sql)
   de la misma forma (New query → pegar → Run). Esto crea la tabla que
   permite dar de alta a tu equipo con PIN desde la app.
4. Ve a **Authentication → Sign In / Providers → Email** y **apaga "Confirm
   email"**. Es obligatorio: las cuentas del equipo usan un correo técnico
   que no es real, así que nunca podrían confirmarse por correo.
5. Ve a **Authentication → Users → Add user** y crea **un solo usuario para
   ti** (el dueño), con tu correo y una contraseña. Copia su **User UID** (lo
   verás en la lista de usuarios). A tu compañero **no** lo crees aquí — eso
   se hace desde la app en el paso 4 más abajo.
6. Vuelve a **SQL Editor** y da de alta tu perfil de dueño, reemplazando el
   UUID por el que copiaste:

   ```sql
   insert into public.profiles (id, role, display_name)
     values ('UUID-DEL-DUEÑO', 'owner', 'Tu nombre');
   ```

7. Ve a **Project Settings → API** y copia:
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

## 4. Dar de alta a tu equipo y asignarle un día

Inicia sesión como dueño y toca el ícono de calendario ("Tu equipo") en la
barra superior:

1. La primera vez verás un formulario: **Nombre + PIN de 4 dígitos** (lo
   escribes dos veces para confirmarlo). Al guardar, se crea la cuenta.
2. Después verás el campo **Fecha asignada** — elige la fecha que le toca
   capturar a tu compañero. La app calcula sola a qué mes/semana/día
   corresponde esa fecha.
3. Tu compañero entra desde la pantalla de inicio, con "Soy del equipo,
   tengo un PIN" → toca su nombre → teclea su PIN.

## 5. Desplegar en Vercel

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
  schema.sql                    tablas y políticas RLS base
  migration_002_staff_pin.sql   tabla de directorio para el login por PIN
```
