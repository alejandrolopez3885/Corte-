-- El mesero ve sus encuestas contestadas, tal cual las llenó el cliente
-- (con su comentario). Ejecuta esto una vez en el SQL Editor de Supabase
-- (ya está aplicado en el proyecto de Cortes con el conector).
--
-- Solo las que generó con su cuenta, que cuentan para su calificación
-- (válidas o aprobadas por el dueño) y no son de prueba. No ve las
-- sospechosas ni sus motivos, ni el celular del cliente.

create or replace function public.mis_encuestas(p_desde date, p_hasta date)
returns table (
  encuesta_id uuid, mesero_nombre text, atencion smallint, comida smallint, rapidez smallint,
  comentario text, total_cliente numeric, mesa text, respondida_en timestamptz
)
language sql security definer set search_path = public as $$
  select r.encuesta_id, r.mesero_nombre, r.atencion, r.comida, r.rapidez,
    r.comentario, r.total_cliente, e.mesa, r.respondida_en
  from public.encuesta_respuestas r
  join public.encuestas e on e.id = r.encuesta_id and not e.prueba
  where e.creado_por = auth.uid()
    and (r.respondida_en at time zone 'America/Monterrey')::date between p_desde and p_hasta
    and public.encuesta_valida(r.motivos, r.revision)
  order by r.respondida_en desc;
$$;

revoke all on function public.mis_encuestas(date, date) from public, anon;
grant execute on function public.mis_encuestas(date, date) to authenticated;
