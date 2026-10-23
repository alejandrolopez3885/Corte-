-- Encuestas en el ranking. Ejecuta esto una vez en el SQL Editor de
-- Supabase después de migration_018 (ya está aplicado en el proyecto de
-- Cortes con el conector).
--
-- Por mesero, entre dos fechas (de Monterrey) y del negocio de quien
-- pregunta (dueño, personal o invitado vigente): cuántas encuestas generó,
-- cuántas le contestaron (válidas: sin sospecha o aprobadas, no
-- descartadas) y cuántas de 1 a 5 estrellas de atención. Sin comentarios
-- ni nada que identifique al cliente. Las de prueba no cuentan.
create or replace function public.ranking_encuestas(p_desde date, p_hasta date)
returns table (mesero_id text, mesero_nombre text, generadas bigint, contestadas bigint,
               e1 bigint, e2 bigint, e3 bigint, e4 bigint, e5 bigint, promedio numeric)
language sql stable security definer set search_path = public as $$
  with yo as (
    select coalesce(p.owner_id, p.id) as dueno from public.profiles p
    where p.id = auth.uid() and (p.invitado_hasta is null or p.invitado_hasta > now())
  ),
  gen as (
    select e.mesero_id, max(e.mesero_nombre) as nombre, count(*) as n
    from public.encuestas e, yo
    where e.owner_id = yo.dueno and not e.prueba
      and (e.creado_en at time zone 'America/Monterrey')::date between p_desde and p_hasta
    group by e.mesero_id
  ),
  resp as (
    select r.mesero_id, max(r.mesero_nombre) as nombre, count(*) as n,
      count(*) filter (where r.atencion = 1) as e1, count(*) filter (where r.atencion = 2) as e2,
      count(*) filter (where r.atencion = 3) as e3, count(*) filter (where r.atencion = 4) as e4,
      count(*) filter (where r.atencion = 5) as e5, round(avg(r.atencion)::numeric, 2) as promedio
    from public.encuesta_respuestas r
    join public.encuestas e on e.id = r.encuesta_id and not e.prueba, yo
    where r.owner_id = yo.dueno
      and (r.respondida_en at time zone 'America/Monterrey')::date between p_desde and p_hasta
      and public.encuesta_valida(r.motivos, r.revision)
    group by r.mesero_id
  )
  select coalesce(g.mesero_id, r.mesero_id), coalesce(r.nombre, g.nombre), coalesce(g.n, 0), coalesce(r.n, 0),
    coalesce(r.e1, 0), coalesce(r.e2, 0), coalesce(r.e3, 0), coalesce(r.e4, 0), coalesce(r.e5, 0), r.promedio
  from gen g full join resp r on r.mesero_id = g.mesero_id;
$$;
revoke all on function public.ranking_encuestas(date, date) from public, anon;
grant execute on function public.ranking_encuestas(date, date) to authenticated;
