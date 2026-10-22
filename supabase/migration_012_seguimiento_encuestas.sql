-- Seguimiento de encuestas (logs). Ejecuta esto una vez en el SQL Editor
-- de Supabase después de migration_011 (ya está aplicado en el proyecto de
-- Cortes con el conector).
--
-- Guarda cada paso de cada encuesta en encuesta_eventos, para siempre (no
-- se puede editar ni borrar desde la app) y solo lo lee el dueño:
--   fallida     el mesero intentó generar y no se pudo (detalle = por qué)
--   generada    se creó el QR
--   abierta     el cliente abrió el enlace por primera vez
--   reabierta   lo volvieron a abrir (detalle = abierta/respondida/vencida/cancelada)
--   empezada    el cliente empezó a contestar
--   enviada     la envió (detalle = motivos de sospecha separados por coma, vacío si es válida)
--   tarde       intentó enviarla cuando ya no se podía (detalle = respondida/vencida/cancelada)
--   cancelada   el mesero la canceló
--   aprobada / descartada   el dueño revisó una sospechosa
--   marcada     se le agregó un motivo después (detalle = motivos)
-- Que venció se sabe por vence_en, sin evento.

create table if not exists public.encuesta_eventos (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  encuesta_id uuid references public.encuestas (id) on delete cascade,
  creado_por uuid references public.profiles (id) on delete set null,
  mesero_id text,
  mesero_nombre text,
  tipo text not null check (tipo in ('fallida', 'generada', 'abierta', 'reabierta', 'empezada', 'enviada', 'tarde',
                                     'cancelada', 'aprobada', 'descartada', 'marcada')),
  detalle text check (char_length(detalle) <= 200),
  creado_en timestamptz not null default now()
);
create index if not exists encuesta_eventos_owner_creado on public.encuesta_eventos (owner_id, creado_en);
create index if not exists encuesta_eventos_encuesta on public.encuesta_eventos (encuesta_id, tipo);
create index if not exists encuesta_eventos_creado_por on public.encuesta_eventos (creado_por, tipo, creado_en);

alter table public.encuesta_eventos enable row level security;

-- Solo el dueño lee; nadie escribe directo (todo entra por las funciones).
create policy "encuesta_eventos_select" on public.encuesta_eventos
  for select using (owner_id = auth.uid());

-- Intento fallido del mesero (lo que la app ya sabe: sin total, sin ligar
-- a Personal, límite, sin conexión). p_cuando permite mandar después los
-- que pasaron sin conexión; se acepta de los últimos 2 días. Máximo 60 al
-- día por cuenta para que no se llene de basura.
create or replace function public.registrar_intento_encuesta(p_motivo text, p_mesero_id text, p_mesero_nombre text, p_cuando timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_cuando timestamptz := least(greatest(coalesce(p_cuando, now()), now() - interval '2 days'), now());
begin
  select p.owner_id into v_owner from public.profiles p where p.id = auth.uid() and p.role = 'staff';
  if v_owner is null then return; end if;
  if (select count(*) from public.encuesta_eventos e
      where e.creado_por = auth.uid() and e.tipo = 'fallida' and e.creado_en > now() - interval '1 day') >= 60 then
    return;
  end if;
  insert into public.encuesta_eventos (owner_id, creado_por, mesero_id, mesero_nombre, tipo, detalle, creado_en)
  values (v_owner, auth.uid(), left(p_mesero_id, 80), left(p_mesero_nombre, 80), 'fallida', left(coalesce(p_motivo, 'otro'), 40), v_cuando);
end $$;

create or replace function public.crear_encuesta(p_total numeric, p_mesa text, p_mesero_id text, p_mesero_nombre text)
returns table (id uuid, token text, vence_en timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_hoy int;
  v_id uuid;
  v_token text;
  v_vence timestamptz;
begin
  select p.owner_id into v_owner from public.profiles p where p.id = auth.uid() and p.role = 'staff';
  if v_owner is null then raise exception 'Solo las cuentas de equipo generan encuestas'; end if;
  if p_total is null or p_total <= 0 then raise exception 'Escribe el total de la cuenta'; end if;
  select count(*) into v_hoy from public.encuestas e
    where e.creado_por = auth.uid()
      and (e.creado_en at time zone 'America/Monterrey')::date = (now() at time zone 'America/Monterrey')::date;
  if v_hoy >= 15 then raise exception 'Ya generaste las 15 encuestas de hoy'; end if;
  insert into public.encuestas (token, owner_id, creado_por, mesero_id, mesero_nombre, total, mesa, vence_en)
  values (replace(gen_random_uuid()::text, '-', ''), v_owner, auth.uid(), p_mesero_id, left(p_mesero_nombre, 80),
          round(p_total, 2), nullif(left(coalesce(p_mesa, ''), 20), ''), now() + interval '30 minutes')
  returning encuestas.id, encuestas.token, encuestas.vence_en into v_id, v_token, v_vence;
  insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo)
  values (v_owner, v_id, auth.uid(), p_mesero_id, left(p_mesero_nombre, 80), 'generada');
  return query select v_id, v_token, v_vence;
end $$;

create or replace function public.cancelar_encuesta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e public.encuestas%rowtype;
begin
  update public.encuestas set cancelada = true
    where encuestas.id = p_id and creado_por = auth.uid() and respondida_en is null and not cancelada
    returning * into e;
  if found then
    insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo)
    values (e.owner_id, e.id, auth.uid(), e.mesero_id, e.mesero_nombre, 'cancelada');
  end if;
end $$;

-- Guarda un evento de la encuesta a nombre del cliente (sin cuenta). Tope
-- de 10 por tipo y encuesta: el enlace es público y lo pueden abrir mil veces.
create or replace function public.evento_cliente(e public.encuestas, p_tipo text, p_detalle text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.encuesta_eventos x where x.encuesta_id = e.id and x.tipo = p_tipo) >= 10 then return; end if;
  insert into public.encuesta_eventos (owner_id, encuesta_id, mesero_id, mesero_nombre, tipo, detalle)
  values (e.owner_id, e.id, e.mesero_id, e.mesero_nombre, p_tipo, p_detalle);
end $$;
revoke all on function public.evento_cliente(public.encuestas, text, text) from public, anon, authenticated;

create or replace function public.estado_de(e public.encuestas)
returns text language sql stable set search_path = '' as $$
  select case when e.respondida_en is not null then 'respondida'
              when e.cancelada then 'cancelada'
              when now() > e.vence_en then 'vencida'
              else 'abierta' end
$$;

-- Ahora es volátil: abrir el enlace queda guardado.
create or replace function public.encuesta_publica(p_token text)
returns table (mesero_nombre text, estado text)
language plpgsql volatile security definer set search_path = public as $$
declare
  e public.encuestas%rowtype;
  v_estado text;
begin
  select * into e from public.encuestas x where x.token = p_token;
  if not found then return; end if;
  v_estado := public.estado_de(e);
  if v_estado = 'abierta' and not exists (select 1 from public.encuesta_eventos x where x.encuesta_id = e.id and x.tipo = 'abierta') then
    perform public.evento_cliente(e, 'abierta', null);
  else
    perform public.evento_cliente(e, 'reabierta', v_estado);
  end if;
  return query select e.mesero_nombre, v_estado;
end $$;

-- El cliente tocó la primera estrella o escribió el total.
create or replace function public.empezar_encuesta(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare
  e public.encuestas%rowtype;
begin
  select * into e from public.encuestas x where x.token = p_token;
  if not found or public.estado_de(e) <> 'abierta' then return; end if;
  if exists (select 1 from public.encuesta_eventos x where x.encuesta_id = e.id and x.tipo = 'empezada') then return; end if;
  perform public.evento_cliente(e, 'empezada', null);
end $$;

create or replace function public.responder_encuesta(
  p_token text, p_total numeric, p_atencion int, p_comida int, p_rapidez int,
  p_comentario text, p_dispositivo text, p_dispositivo_personal boolean, p_segundos int
) returns text
language plpgsql security definer set search_path = public as $$
declare
  e public.encuestas%rowtype;
  v_motivos text[] := '{}';
  v_hora int;
  v_estado text;
begin
  select * into e from public.encuestas where token = p_token for update;
  if not found then return 'no-existe'; end if;
  v_estado := public.estado_de(e);
  if v_estado <> 'abierta' then
    perform public.evento_cliente(e, 'tarde', v_estado);
    return v_estado;
  end if;
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
  insert into public.encuesta_eventos (owner_id, encuesta_id, mesero_id, mesero_nombre, tipo, detalle)
  values (e.owner_id, e.id, e.mesero_id, e.mesero_nombre, 'enviada', array_to_string(v_motivos, ','));
  return 'ok';
end $$;

-- Cuando el dueño aprueba, descarta o se le agrega un motivo a una respuesta.
create or replace function public.evento_revision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.revision is distinct from old.revision and new.revision is not null then
    insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo)
    values (new.owner_id, new.encuesta_id, auth.uid(), new.mesero_id, new.mesero_nombre, new.revision);
  end if;
  if new.motivos is distinct from old.motivos then
    insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo, detalle)
    values (new.owner_id, new.encuesta_id, auth.uid(), new.mesero_id, new.mesero_nombre, 'marcada', left(array_to_string(new.motivos, ','), 200));
  end if;
  return new;
end $$;
revoke all on function public.evento_revision() from public, anon, authenticated;
drop trigger if exists encuesta_respuestas_evento on public.encuesta_respuestas;
create trigger encuesta_respuestas_evento after update on public.encuesta_respuestas
  for each row execute function public.evento_revision();

-- Las encuestas de antes del seguimiento: su "generada", "enviada" y "cancelada".
insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo, creado_en)
select e.owner_id, e.id, e.creado_por, e.mesero_id, e.mesero_nombre, 'generada', e.creado_en
from public.encuestas e
where not exists (select 1 from public.encuesta_eventos x where x.encuesta_id = e.id);
insert into public.encuesta_eventos (owner_id, encuesta_id, mesero_id, mesero_nombre, tipo, detalle, creado_en)
select r.owner_id, r.encuesta_id, r.mesero_id, r.mesero_nombre, 'enviada', array_to_string(r.motivos, ','), r.respondida_en
from public.encuesta_respuestas r
where not exists (select 1 from public.encuesta_eventos x where x.encuesta_id = r.encuesta_id and x.tipo = 'enviada');
insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo, creado_en)
select e.owner_id, e.id, e.creado_por, e.mesero_id, e.mesero_nombre, 'cancelada', e.creado_en
from public.encuestas e
where e.cancelada and not exists (select 1 from public.encuesta_eventos x where x.encuesta_id = e.id and x.tipo = 'cancelada');

revoke all on function public.registrar_intento_encuesta(text, text, text, timestamptz) from public, anon;
grant execute on function public.registrar_intento_encuesta(text, text, text, timestamptz) to authenticated;
revoke all on function public.encuesta_publica(text) from public;
grant execute on function public.encuesta_publica(text) to anon, authenticated;
grant execute on function public.empezar_encuesta(text) to anon, authenticated;
