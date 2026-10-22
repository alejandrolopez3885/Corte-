-- Encuestas con QR por mesero. Ejecuta esto una vez en el SQL Editor de
-- Supabase (ya está aplicado en el proyecto de Cortes con el conector).
--
-- El mesero (cuenta de equipo) genera una encuesta con el total de la
-- cuenta y muestra un QR; el cliente la contesta sin iniciar sesión. Nadie
-- lee ni escribe estas tablas directo desde la app salvo lo que permiten
-- las políticas; crear, contestar y sacar promedios va por funciones que
-- revisan todo:
--   crear_encuesta        cuenta de equipo; máximo 15 por día; vence en 30 min
--   encuesta_publica      cualquiera con el código: solo el nombre del mesero y si sigue vigente
--   responder_encuesta    cualquiera con el código: una sola vez; marca lo sospechoso
--   cancelar_encuesta     quien la creó
--   calificaciones        promedio y cuántas (válidas) por mesero, sin comentarios
-- Los comentarios y las respuestas completas solo los lee el dueño.

create table if not exists public.encuestas (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  creado_por uuid not null references public.profiles (id) on delete cascade,
  mesero_id text not null,
  mesero_nombre text not null,
  total numeric(12, 2) not null check (total > 0 and total < 1000000),
  mesa text check (char_length(mesa) <= 20),
  creado_en timestamptz not null default now(),
  vence_en timestamptz not null,
  cancelada boolean not null default false,
  respondida_en timestamptz
);
create index if not exists encuestas_owner_creado on public.encuestas (owner_id, creado_en);
create index if not exists encuestas_creado_por on public.encuestas (creado_por, creado_en);

create table if not exists public.encuesta_respuestas (
  encuesta_id uuid primary key references public.encuestas (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  mesero_id text not null,
  mesero_nombre text not null,
  atencion smallint not null check (atencion between 1 and 5),
  comida smallint not null check (comida between 1 and 5),
  rapidez smallint not null check (rapidez between 1 and 5),
  comentario text check (char_length(comentario) <= 500),
  total_cliente numeric(12, 2) not null,
  dispositivo text,
  segundos integer,
  motivos text[] not null default '{}',
  revision text check (revision in ('aprobada', 'descartada')),
  respondida_en timestamptz not null default now()
);
create index if not exists encuesta_respuestas_owner on public.encuesta_respuestas (owner_id, respondida_en);
create index if not exists encuesta_respuestas_dispositivo on public.encuesta_respuestas (owner_id, dispositivo, respondida_en);

alter table public.encuestas enable row level security;
alter table public.encuesta_respuestas enable row level security;

-- Quien la creó ve las suyas (para saber cuándo la contestaron); el dueño, todas.
create policy "encuestas_select" on public.encuestas
  for select using (creado_por = auth.uid() or owner_id = auth.uid());

-- Respuestas completas (con comentario): solo el dueño. Él también puede
-- aprobar o descartar las sospechosas y marcar las que pasan la venta.
create policy "encuesta_respuestas_select" on public.encuesta_respuestas
  for select using (owner_id = auth.uid());
create policy "encuesta_respuestas_update" on public.encuesta_respuestas
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Válida = sin motivos de sospecha (o aprobada por el dueño) y no descartada.
create or replace function public.encuesta_valida(motivos text[], revision text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(revision, '') <> 'descartada' and (cardinality(motivos) = 0 or revision = 'aprobada')
$$;

create or replace function public.crear_encuesta(p_total numeric, p_mesa text, p_mesero_id text, p_mesero_nombre text)
returns table (id uuid, token text, vence_en timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_hoy int;
begin
  select p.owner_id into v_owner from public.profiles p where p.id = auth.uid() and p.role = 'staff';
  if v_owner is null then raise exception 'Solo las cuentas de equipo generan encuestas'; end if;
  if p_total is null or p_total <= 0 then raise exception 'Escribe el total de la cuenta'; end if;
  select count(*) into v_hoy from public.encuestas e
    where e.creado_por = auth.uid()
      and (e.creado_en at time zone 'America/Monterrey')::date = (now() at time zone 'America/Monterrey')::date;
  if v_hoy >= 15 then raise exception 'Ya generaste las 15 encuestas de hoy'; end if;
  return query
    insert into public.encuestas (token, owner_id, creado_por, mesero_id, mesero_nombre, total, mesa, vence_en)
    values (replace(gen_random_uuid()::text, '-', ''), v_owner, auth.uid(), p_mesero_id, left(p_mesero_nombre, 80),
            round(p_total, 2), nullif(left(coalesce(p_mesa, ''), 20), ''), now() + interval '30 minutes')
    returning encuestas.id, encuestas.token, encuestas.vence_en;
end $$;

create or replace function public.cancelar_encuesta(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.encuestas set cancelada = true where id = p_id and creado_por = auth.uid() and respondida_en is null;
$$;

create or replace function public.encuesta_publica(p_token text)
returns table (mesero_nombre text, estado text)
language sql security definer set search_path = public as $$
  select e.mesero_nombre,
    case when e.respondida_en is not null then 'respondida'
         when e.cancelada then 'cancelada'
         when now() > e.vence_en then 'vencida'
         else 'abierta' end
  from public.encuestas e where e.token = p_token;
$$;

create or replace function public.responder_encuesta(
  p_token text, p_total numeric, p_atencion int, p_comida int, p_rapidez int,
  p_comentario text, p_dispositivo text, p_dispositivo_personal boolean, p_segundos int
) returns text
language plpgsql security definer set search_path = public as $$
declare
  e public.encuestas%rowtype;
  v_motivos text[] := '{}';
  v_hora int;
begin
  select * into e from public.encuestas where token = p_token for update;
  if not found then return 'no-existe'; end if;
  if e.respondida_en is not null then return 'respondida'; end if;
  if e.cancelada then return 'cancelada'; end if;
  if now() > e.vence_en then return 'vencida'; end if;
  if p_total is null or abs(p_total - e.total) > 1 then v_motivos := array_append(v_motivos, 'total'); end if;
  if coalesce(p_dispositivo_personal, false) then v_motivos := array_append(v_motivos, 'personal'); end if;
  if coalesce(p_segundos, 0) < 10 then v_motivos := array_append(v_motivos, 'rapida'); end if;
  if p_dispositivo is not null and exists (
    select 1 from public.encuesta_respuestas r
    where r.owner_id = e.owner_id and r.dispositivo = p_dispositivo and r.respondida_en > now() - interval '7 days'
  ) then v_motivos := array_append(v_motivos, 'repetido'); end if;
  v_hora := extract(hour from now() at time zone 'America/Monterrey');
  if v_hora >= 3 and v_hora < 10 then v_motivos := array_append(v_motivos, 'horario'); end if;
  insert into public.encuesta_respuestas (encuesta_id, owner_id, mesero_id, mesero_nombre, atencion, comida, rapidez,
    comentario, total_cliente, dispositivo, segundos, motivos)
  values (e.id, e.owner_id, e.mesero_id, e.mesero_nombre, p_atencion, p_comida, p_rapidez,
    nullif(left(coalesce(p_comentario, ''), 500), ''), coalesce(p_total, 0), left(p_dispositivo, 64), p_segundos, v_motivos);
  update public.encuestas set respondida_en = now() where id = e.id;
  return 'ok';
end $$;

-- Promedio de atención y cuántas encuestas válidas por mesero entre dos
-- fechas (de Monterrey), del negocio de quien pregunta. Sin comentarios.
create or replace function public.calificaciones(p_desde date, p_hasta date)
returns table (mesero_id text, mesero_nombre text, promedio numeric, cantidad bigint)
language sql security definer set search_path = public as $$
  select r.mesero_id, max(r.mesero_nombre), round(avg(r.atencion)::numeric, 1), count(*)
  from public.encuesta_respuestas r
  where r.owner_id = (select coalesce(p.owner_id, p.id) from public.profiles p where p.id = auth.uid())
    and (r.respondida_en at time zone 'America/Monterrey')::date between p_desde and p_hasta
    and public.encuesta_valida(r.motivos, r.revision)
  group by r.mesero_id;
$$;

revoke all on function public.crear_encuesta(numeric, text, text, text) from public, anon;
grant execute on function public.crear_encuesta(numeric, text, text, text) to authenticated;
revoke all on function public.cancelar_encuesta(uuid) from public, anon;
grant execute on function public.cancelar_encuesta(uuid) to authenticated;
revoke all on function public.calificaciones(date, date) from public, anon;
grant execute on function public.calificaciones(date, date) to authenticated;
grant execute on function public.encuesta_publica(text) to anon, authenticated;
grant execute on function public.responder_encuesta(text, numeric, int, int, int, text, text, boolean, int) to anon, authenticated;
