-- La mesa es obligatoria para generar la encuesta (del mesero y la de
-- prueba del dueño). Ejecuta esto una vez en el SQL Editor de Supabase (ya
-- está aplicado en el proyecto de Cortes con el conector). Las funciones
-- quedan igual que antes, solo con la revisión de la mesa.

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
  if nullif(trim(coalesce(p_mesa, '')), '') is null then raise exception 'Escribe la mesa'; end if;
  select count(*) into v_hoy from public.encuestas e
    where e.creado_por = auth.uid()
      and (e.creado_en at time zone 'America/Monterrey')::date = (now() at time zone 'America/Monterrey')::date;
  if v_hoy >= 15 then raise exception 'Ya generaste las 15 encuestas de hoy'; end if;
  insert into public.encuestas (token, owner_id, creado_por, mesero_id, mesero_nombre, total, mesa, vence_en)
  values (replace(gen_random_uuid()::text, '-', ''), v_owner, auth.uid(), p_mesero_id, left(p_mesero_nombre, 80),
          round(p_total, 2), left(trim(p_mesa), 20), now() + interval '30 minutes')
  returning encuestas.id, encuestas.token, encuestas.vence_en into v_id, v_token, v_vence;
  insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo)
  values (v_owner, v_id, auth.uid(), p_mesero_id, left(p_mesero_nombre, 80), 'generada');
  return query select v_id, v_token, v_vence;
end $$;

create or replace function public.crear_encuesta_prueba(p_total numeric, p_mesa text, p_nombre text)
returns table (id uuid, token text, vence_en timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_hoy int;
  v_id uuid;
  v_token text;
  v_vence timestamptz;
  v_nombre text := 'Prueba (' || coalesce(nullif(left(trim(coalesce(p_nombre, '')), 40), ''), 'dueño') || ')';
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner') then
    raise exception 'Solo el dueño genera encuestas de prueba';
  end if;
  if p_total is null or p_total <= 0 then raise exception 'Escribe el total de la cuenta'; end if;
  if nullif(trim(coalesce(p_mesa, '')), '') is null then raise exception 'Escribe la mesa'; end if;
  select count(*) into v_hoy from public.encuestas e
    where e.creado_por = auth.uid() and e.prueba
      and (e.creado_en at time zone 'America/Monterrey')::date = (now() at time zone 'America/Monterrey')::date;
  if v_hoy >= 30 then raise exception 'Ya generaste las 30 encuestas de prueba de hoy'; end if;
  insert into public.encuestas (token, owner_id, creado_por, mesero_id, mesero_nombre, total, mesa, vence_en, prueba)
  values (replace(gen_random_uuid()::text, '-', ''), auth.uid(), auth.uid(), 'prueba', v_nombre,
          round(p_total, 2), left(trim(p_mesa), 20), now() + interval '30 minutes', true)
  returning encuestas.id, encuestas.token, encuestas.vence_en into v_id, v_token, v_vence;
  insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo)
  values (auth.uid(), v_id, auth.uid(), 'prueba', v_nombre, 'generada');
  return query select v_id, v_token, v_vence;
end $$;
