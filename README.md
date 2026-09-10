# Cortes

App para llevar el corte de caja diario de un restaurante: por mesero (venta,
tarjetas, propina, gastos y transferencias), organizado por mes → semana →
día, con resúmenes semanales y conciliación de efectivo.

- **Frontend**: React + Vite + TypeScript.
- **Backend**: Supabase (Auth + Postgres).
- **Hosting sugerido**: Vercel.

Hay 2 tipos de cuenta:

- **Dueño (`owner`)**: acceso completo — todos los meses, semanas y días,
  catálogo de meseros, resúmenes.
- **Staff (`staff`)**: solo puede capturar el corte del **día que el dueño le
  asigne** (por fecha, desde el botón del calendario en la barra superior).
  Esta restricción vive en la interfaz, no en la base de datos: ambas cuentas
  comparten el mismo negocio y, a nivel de base de datos, el staff puede leer
  y escribir el mismo registro que el dueño. Si en el futuro necesitas que
  esa restricción sea también a nivel de base de datos, hay que pasar a
  tablas relacionales por día — puedes pedírmelo cuando quieras.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**.
2. Cuando esté listo, entra a **SQL Editor** → **New query**, pega todo el
   contenido de [`supabase/schema.sql`](./supabase/schema.sql) y dale **Run**.
   Esto crea las tablas `profiles` y `app_data` con sus políticas de acceso
   (RLS).
3. Ve a **Authentication → Users → Add user** y crea 2 usuarios (uno para ti,
   otro para la persona de apoyo), con email y contraseña. Copia el **User
   UID** de cada uno (lo verás en la lista de usuarios).
4. Vuelve a **SQL Editor** y da de alta los perfiles, reemplazando los UUID
   por los que copiaste:

   ```sql
   insert into public.profiles (id, role, display_name)
     values ('UUID-DEL-DUEÑO', 'owner', 'Tu nombre');

   insert into public.profiles (id, role, display_name, owner_id)
     values ('UUID-DEL-STAFF', 'staff', 'Nombre de tu compañero', 'UUID-DEL-DUEÑO');
   ```

5. Ve a **Project Settings → API** y copia:
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

## 4. Asignar el día al staff

Inicia sesión como dueño, toca el ícono de calendario en la barra superior y
elige la fecha que le toca capturar a tu compañero. La app calcula sola a qué
mes/semana/día corresponde esa fecha.

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
  schema.sql      tablas y políticas RLS
```
