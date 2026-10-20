-- Bitácora (Negocio > Análisis > Historial de cambios): quién cambió qué y
-- cuándo en la app, más los inicios y cierres de sesión.
-- Ejecuta esto una vez en el SQL Editor de tu proyecto de Supabase.
--
-- A diferencia de app_data (que cualquier cuenta del negocio reescribe
-- completo en cada guardado), aquí solo se pueden AGREGAR renglones: no hay
-- policies de update ni delete, así que nadie puede editar ni borrar el
-- historial desde la app — ni el equipo ni el dueño.
--
-- actor_id no es llave foránea a profiles a propósito: si se le quita el
-- acceso a alguien (se borra su perfil), su historial se queda.
create table if not exists public.bitacora (
  id bigserial primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null default auth.uid(),
  actor_nombre text,
  tipo text not null check (tipo in ('cambio', 'login', 'logout')),
  seccion text,
  donde text,
  detalle jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists bitacora_owner_fecha on public.bitacora (owner_id, creado_en desc);

alter table public.bitacora enable row level security;

-- Cualquiera del negocio (dueño o equipo) agrega renglones a nombre propio,
-- solo en el negocio al que pertenece.
create policy "bitacora_insert" on public.bitacora
  for insert
  with check (
    actor_id = auth.uid()
    and (
      owner_id = auth.uid()
      or owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid())
    )
  );

-- Solo el dueño la consulta.
create policy "bitacora_select" on public.bitacora
  for select
  using (owner_id = auth.uid());
