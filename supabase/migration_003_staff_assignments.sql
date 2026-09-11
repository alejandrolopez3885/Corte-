-- Migración: varias fechas asignadas por persona del equipo.
-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Reemplaza el campo único profiles.assigned_date por una tabla de varias
-- filas, para poder asignar (y quitar) más de un día por persona. Quitar una
-- fila revoca el acceso a ese día de inmediato: la app del staff revisa
-- periódicamente esta tabla mientras está abierta.
create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  assigned_date date not null,
  created_at timestamptz not null default now(),
  unique (staff_id, assigned_date)
);

alter table public.staff_assignments enable row level security;

-- El propio staff puede ver sus fechas asignadas; el dueño puede ver las de
-- su equipo.
create policy "staff_assignments_select" on public.staff_assignments
  for select
  using (
    staff_id = auth.uid()
    or staff_id in (select id from public.profiles where owner_id = auth.uid())
  );

-- Solo el dueño puede asignar o quitar fechas a su equipo.
create policy "staff_assignments_insert" on public.staff_assignments
  for insert
  with check (
    staff_id in (select id from public.profiles where owner_id = auth.uid())
  );

create policy "staff_assignments_delete" on public.staff_assignments
  for delete
  using (
    staff_id in (select id from public.profiles where owner_id = auth.uid())
  );

-- El campo viejo de una sola fecha ya no se usa.
alter table public.profiles drop column if exists assigned_date;
