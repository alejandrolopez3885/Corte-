-- Esquema de Supabase para la app de Cortes.
-- Ejecuta este archivo completo en el SQL Editor de tu proyecto de Supabase
-- (Project > SQL Editor > New query > pega esto > Run).

-- ---------------------------------------------------------------------------
-- profiles: un perfil por usuario autenticado.
--   role = 'owner' -> dueño/encargado, ve y edita todo su negocio.
--   role = 'staff' -> solo tiene acceso (a nivel de cuenta) a los datos del
--                      owner al que está vinculado vía owner_id. Qué día
--                      específico puede ver/editar lo decide la app
--                      (columna assigned_date), no la base de datos.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  display_name text,
  owner_id uuid references public.profiles (id) on delete cascade,
  assigned_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
  for select
  using (id = auth.uid() or owner_id = auth.uid());

create policy "profiles_insert" on public.profiles
  for insert
  with check (id = auth.uid() or owner_id = auth.uid());

create policy "profiles_update" on public.profiles
  for update
  using (id = auth.uid() or owner_id = auth.uid())
  with check (id = auth.uid() or owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- app_data: un solo JSON por negocio (por owner), igual a la estructura que
-- ya usaba la app (meseros, months, weeks, days...). El staff vinculado
-- puede leer y escribir el mismo JSON que su owner; la restricción a un solo
-- día es responsabilidad del frontend, no de esta tabla.
-- ---------------------------------------------------------------------------
create table if not exists public.app_data (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

create policy "app_data_select" on public.app_data
  for select
  using (
    owner_id = auth.uid()
    or owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid())
  );

create policy "app_data_insert" on public.app_data
  for insert
  with check (owner_id = auth.uid());

create policy "app_data_update" on public.app_data
  for update
  using (
    owner_id = auth.uid()
    or owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid())
  )
  with check (
    owner_id = auth.uid()
    or owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Después de crear los 2 usuarios en Authentication > Users, dales perfil.
-- Reemplaza los UUID por los "User UID" reales de cada usuario creado.
-- ---------------------------------------------------------------------------
-- insert into public.profiles (id, role, display_name)
--   values ('UUID-DEL-DUEÑO', 'owner', 'Tu nombre');
--
-- insert into public.profiles (id, role, display_name, owner_id)
--   values ('UUID-DEL-STAFF', 'staff', 'Nombre del encargado del día', 'UUID-DEL-DUEÑO');
