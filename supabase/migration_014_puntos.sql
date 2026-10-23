-- Puntos y logros semanales. Ejecuta esto una vez en el SQL Editor de
-- Supabase después de migration_013 (ya está aplicado en el proyecto de
-- Cortes con el conector).
--
-- Al guardar el corte del domingo, la app del dueño cierra la semana: el
-- ganador, los puntos de cada quien y los logros nuevos. Los puntos son un
-- historial de movimientos (nadie los edita ni los borra): sumar es un
-- movimiento positivo y el día que haya canjes, uno negativo. Recalcular
-- una semana anula (anulado = true) lo que esa semana había dado y agrega
-- lo nuevo, así queda el rastro.
--   puntos_semanas      la "foto" de cada semana cerrada (ganador y resultados)
--   puntos_movimientos  cada suma o resta, con su motivo
--   puntos_logros       los logros que ganó cada quien
--   meseros_cuentas     qué cuenta de equipo es qué mesero del corte (la
--                       llena la app del dueño), para que cada quien vea
--                       solo sus puntos
-- Los puntos los ve solo su dueño (la persona) y el dueño del negocio; el
-- ganador y los logros los ve todo el equipo. Solo el dueño escribe.

create table if not exists public.meseros_cuentas (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  mesero_id text not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (owner_id, mesero_id)
);
create index if not exists meseros_cuentas_profile on public.meseros_cuentas (profile_id);

create table if not exists public.puntos_semanas (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  lunes date not null,
  cerrada_en timestamptz not null default now(),
  ganador_mesero_id text,
  ganador_nombre text,
  resultados jsonb not null default '[]',
  primary key (owner_id, lunes)
);

create table if not exists public.puntos_movimientos (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  mesero_id text not null,
  nombre text not null,
  puntos integer not null check (puntos between -100000 and 100000),
  motivo text not null check (char_length(motivo) <= 200),
  tipo text not null check (tipo in ('semana', 'logro', 'ajuste', 'canje')),
  lunes date,
  anulado boolean not null default false,
  creado_por uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists puntos_movimientos_owner on public.puntos_movimientos (owner_id, mesero_id, creado_en);

create table if not exists public.puntos_logros (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  mesero_id text not null,
  nombre text not null,
  logro text not null,
  nivel integer not null,
  lunes date not null,
  anulado boolean not null default false,
  ganado_en timestamptz not null default now(),
  primary key (owner_id, mesero_id, logro, nivel)
);

alter table public.meseros_cuentas enable row level security;
alter table public.puntos_semanas enable row level security;
alter table public.puntos_movimientos enable row level security;
alter table public.puntos_logros enable row level security;

-- Del mismo negocio: el dueño o una cuenta de equipo suya.
create or replace function public.es_de_mi_negocio(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.owner_id = p_owner)
$$;

create policy "meseros_cuentas_select" on public.meseros_cuentas
  for select using (owner_id = auth.uid() or profile_id = auth.uid());
create policy "meseros_cuentas_insert" on public.meseros_cuentas
  for insert with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));
create policy "meseros_cuentas_update" on public.meseros_cuentas
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));

create policy "puntos_semanas_select" on public.puntos_semanas
  for select using (public.es_de_mi_negocio(owner_id));
create policy "puntos_logros_select" on public.puntos_logros
  for select using (public.es_de_mi_negocio(owner_id));

-- Puntos: el dueño todos; cada persona, solo los del mesero que es ella.
create policy "puntos_movimientos_select" on public.puntos_movimientos
  for select using (
    owner_id = auth.uid()
    or exists (select 1 from public.meseros_cuentas c
               where c.owner_id = puntos_movimientos.owner_id and c.mesero_id = puntos_movimientos.mesero_id and c.profile_id = auth.uid())
  );
-- Ajustes (y más adelante canjes) a mano del dueño.
create policy "puntos_movimientos_insert" on public.puntos_movimientos
  for insert with check (owner_id = auth.uid() and creado_por = auth.uid() and tipo in ('ajuste', 'canje'));

-- Cerrar (o recalcular) una semana: anula lo que esa semana había dado (sus
-- puntos de semana y de logro y sus logros) y guarda lo nuevo, todo junto.
create or replace function public.cerrar_semana_puntos(p_lunes date, p_semana jsonb, p_movimientos jsonb, p_logros jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner') then
    raise exception 'Solo el dueño cierra la semana';
  end if;
  update public.puntos_movimientos set anulado = true
    where owner_id = auth.uid() and lunes = p_lunes and tipo in ('semana', 'logro') and not anulado;
  update public.puntos_logros set anulado = true where owner_id = auth.uid() and lunes = p_lunes and not anulado;
  insert into public.puntos_semanas (owner_id, lunes, cerrada_en, ganador_mesero_id, ganador_nombre, resultados)
  values (auth.uid(), p_lunes, now(), p_semana->>'ganadorMeseroId', left(p_semana->>'ganadorNombre', 120), coalesce(p_semana->'resultados', '[]'))
  on conflict (owner_id, lunes) do update
    set cerrada_en = now(), ganador_mesero_id = excluded.ganador_mesero_id, ganador_nombre = excluded.ganador_nombre, resultados = excluded.resultados;
  insert into public.puntos_movimientos (owner_id, mesero_id, nombre, puntos, motivo, tipo, lunes, creado_por)
  select auth.uid(), m->>'meseroId', left(m->>'nombre', 80), (m->>'puntos')::int, left(m->>'motivo', 200), m->>'tipo', p_lunes, auth.uid()
  from jsonb_array_elements(coalesce(p_movimientos, '[]')) m
  where m->>'tipo' in ('semana', 'logro');
  insert into public.puntos_logros (owner_id, mesero_id, nombre, logro, nivel, lunes)
  select auth.uid(), l->>'meseroId', left(l->>'nombre', 80), left(l->>'logro', 40), (l->>'nivel')::int, p_lunes
  from jsonb_array_elements(coalesce(p_logros, '[]')) l
  on conflict (owner_id, mesero_id, logro, nivel) do update
    set anulado = false, lunes = excluded.lunes, nombre = excluded.nombre, ganado_en = now()
    where public.puntos_logros.anulado;
end $$;

revoke all on function public.cerrar_semana_puntos(date, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.cerrar_semana_puntos(date, jsonb, jsonb, jsonb) to authenticated;
revoke all on function public.es_de_mi_negocio(uuid) from public, anon;
grant execute on function public.es_de_mi_negocio(uuid) to authenticated;
grant select, insert, update on public.meseros_cuentas to authenticated;
grant select on public.puntos_semanas, public.puntos_logros to authenticated;
grant select, insert on public.puntos_movimientos to authenticated;
