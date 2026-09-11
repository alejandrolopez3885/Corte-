-- Migración: acceso de staff por PIN (sin correo), creado desde la misma app.
-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Cómo funciona: cuando el dueño crea a una persona del equipo desde la app,
-- por debajo se crea una cuenta real de Supabase Auth con un correo técnico
-- invisible (ej. "a1b2c3d4@cortes.local") y el PIN como contraseña. Esta
-- tabla solo guarda lo necesario para que la pantalla de login pueda mostrar
-- el nombre y reconstruir ese correo técnico — nunca guarda el PIN.
create table if not exists public.staff_login_directory (
  id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  login_slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.staff_login_directory enable row level security;

-- Cualquiera puede leer la lista (es la pantalla de login, antes de iniciar
-- sesión) pero solo se exponen nombre + slug técnico, nunca datos sensibles.
create policy "staff_login_directory_select" on public.staff_login_directory
  for select
  using (true);

-- Solo un usuario ya autenticado (el dueño, creando a su equipo desde la
-- app) puede agregar filas.
create policy "staff_login_directory_insert" on public.staff_login_directory
  for insert
  with check (auth.uid() is not null);

create policy "staff_login_directory_delete" on public.staff_login_directory
  for delete
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- IMPORTANTE: paso manual único en el dashboard de Supabase.
-- Ve a Authentication -> Sign In / Providers -> Email, y apaga
-- "Confirm email". Los correos técnicos que genera esta función no son
-- reales, así que nunca podrían confirmarse por correo; si dejas esa opción
-- prendida, las cuentas del equipo quedarán bloqueadas sin poder entrar.
-- ---------------------------------------------------------------------------
