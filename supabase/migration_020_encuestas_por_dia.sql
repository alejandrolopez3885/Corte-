-- Encuestas del ranking por día de trabajo. Ejecuta esto una vez en el SQL
-- Editor de Supabase después de migration_019 (ya está aplicado en el
-- proyecto de Cortes con el conector).
--
-- Igual que ranking_encuestas pero por mesero y por día, para que la app
-- sume las encuestas de un día solo cuando ya se le hizo el corte a ese
-- mesero ese día. El día es el de trabajo: lo de antes de las 5 am (hora de
-- Monterrey) es del día anterior.
create or replace function public.ranking_encuestas_dias(p_desde date, p_hasta date)
returns table (mesero_id text, mesero_nombre text, dia date, generadas bigint, contestadas bigint,
               e1 bigint, e2 bigint, e3 bigint, e4 bigint, e5 bigint)
language sql stable security definer set search_path = public as $$
  with yo as (
    select coalesce(p.owner_id, p.id) as dueno from public.profiles p
    where p.id = auth.uid() and (p.invitado_hasta is null or p.invitado_hasta > now())
  ),
  gen as (
    select e.mesero_id, ((e.creado_en at time zone 'America/Monterrey') - interval '5 hours')::date as dia,
      max(e.mesero_nombre) as nombre, count(*) as n
    from public.encuestas e, yo
    where e.owner_id = yo.dueno and not e.prueba
      and ((e.creado_en at time zone 'America/Monterrey') - interval '5 hours')::date between p_desde and p_hasta
    group by 1, 2
  ),
  resp as (
    select r.mesero_id, ((r.respondida_en at time zone 'America/Monterrey') - interval '5 hours')::date as dia,
      max(r.mesero_nombre) as nombre, count(*) as n,
      count(*) filter (where r.atencion = 1) as e1, count(*) filter (where r.atencion = 2) as e2,
      count(*) filter (where r.atencion = 3) as e3, count(*) filter (where r.atencion = 4) as e4,
      count(*) filter (where r.atencion = 5) as e5
    from public.encuesta_respuestas r
    join public.encuestas e on e.id = r.encuesta_id and not e.prueba, yo
    where r.owner_id = yo.dueno
      and ((r.respondida_en at time zone 'America/Monterrey') - interval '5 hours')::date between p_desde and p_hasta
      and public.encuesta_valida(r.motivos, r.revision)
    group by 1, 2
  )
  select coalesce(g.mesero_id, r.mesero_id), coalesce(r.nombre, g.nombre), coalesce(g.dia, r.dia), coalesce(g.n, 0), coalesce(r.n, 0),
    coalesce(r.e1, 0), coalesce(r.e2, 0), coalesce(r.e3, 0), coalesce(r.e4, 0), coalesce(r.e5, 0)
  from gen g full join resp r on r.mesero_id = g.mesero_id and r.dia = g.dia;
$$;
revoke all on function public.ranking_encuestas_dias(date, date) from public, anon;
grant execute on function public.ranking_encuestas_dias(date, date) to authenticated;
