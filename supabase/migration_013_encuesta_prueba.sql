-- QR de prueba del dueño. Ejecuta esto una vez en el SQL Editor de Supabase
-- después de migration_012 (ya está aplicado en el proyecto de Cortes con
-- el conector).
--
-- El dueño genera una encuesta desde su cuenta para probar el camino
-- completo. Queda marcada como prueba: el cliente la ve y la contesta igual
-- (con los mismos candados), pero no cuenta en las calificaciones ni en el
-- ranking; la app tampoco la cuenta en las estadísticas.

alter table public.encuestas add column if not exists prueba boolean not null default false;

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
  select count(*) into v_hoy from public.encuestas e
    where e.creado_por = auth.uid() and e.prueba
      and (e.creado_en at time zone 'America/Monterrey')::date = (now() at time zone 'America/Monterrey')::date;
  if v_hoy >= 30 then raise exception 'Ya generaste las 30 encuestas de prueba de hoy'; end if;
  insert into public.encuestas (token, owner_id, creado_por, mesero_id, mesero_nombre, total, mesa, vence_en, prueba)
  values (replace(gen_random_uuid()::text, '-', ''), auth.uid(), auth.uid(), 'prueba', v_nombre,
          round(p_total, 2), nullif(left(coalesce(p_mesa, ''), 20), ''), now() + interval '30 minutes', true)
  returning encuestas.id, encuestas.token, encuestas.vence_en into v_id, v_token, v_vence;
  insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo)
  values (auth.uid(), v_id, auth.uid(), 'prueba', v_nombre, 'generada');
  return query select v_id, v_token, v_vence;
end $$;

-- Las de prueba no cuentan en las calificaciones (ni en el ranking).
create or replace function public.calificaciones(p_desde date, p_hasta date)
returns table (mesero_id text, mesero_nombre text, promedio numeric, cantidad bigint)
language sql security definer set search_path = public as $$
  select r.mesero_id, max(r.mesero_nombre), round(avg(r.atencion)::numeric, 1), count(*)
  from public.encuesta_respuestas r
  join public.encuestas e on e.id = r.encuesta_id and not e.prueba
  where r.owner_id = (select coalesce(p.owner_id, p.id) from public.profiles p where p.id = auth.uid())
    and (r.respondida_en at time zone 'America/Monterrey')::date between p_desde and p_hasta
    and public.encuesta_valida(r.motivos, r.revision)
  group by r.mesero_id;
$$;

revoke all on function public.crear_encuesta_prueba(numeric, text, text) from public, anon;
grant execute on function public.crear_encuesta_prueba(numeric, text, text) to authenticated;
