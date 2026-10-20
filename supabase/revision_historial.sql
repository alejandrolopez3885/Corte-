-- Revisión (SOLO LECTURA): qué historial existe en Supabase de antes de
-- que se activara la bitácora (Historial de cambios). No cambia nada.
-- Pega todo en el SQL Editor de Supabase y dale Run; manda el resultado.
select concepto, cantidad, desde, hasta
from (
  -- Registro de autenticación de Supabase, por tipo de evento.
  select 1 as orden,
         'Auth: ' || coalesce(payload->>'action', '(sin tipo)') as concepto,
         count(*)::text as cantidad,
         min(created_at)::text as desde,
         max(created_at)::text as hasta
  from auth.audit_log_entries
  group by payload->>'action'

  union all
  -- Último inicio de sesión de cada cuenta (solo el último, no historial).
  select 2, 'Cuentas con último inicio de sesión', count(*)::text,
         min(last_sign_in_at)::text, max(last_sign_in_at)::text
  from auth.users
  where last_sign_in_at is not null

  union all
  -- Cuentas del negocio (dueño y equipo) y cuándo se crearon.
  select 3, 'Cuentas: ' || role, count(*)::text, min(created_at)::text, max(created_at)::text
  from public.profiles
  group by role

  union all
  -- Días asignados a alguien del equipo.
  select 4, 'Días asignados (staff_assignments)', count(*)::text, min(created_at)::text, max(created_at)::text
  from public.staff_assignments

  union all
  -- Días del corte con "Corte hecho por" (quién lo capturó, sin hora).
  select 5, 'Días del corte con "hecho por"', count(*)::text, null, null
  from public.app_data, jsonb_path_query(data, '$.months.*.weeks[*].days.*.hechoPor') as h

  union all
  -- Confirmaciones de "Recibí mi nómina correcta" (con fecha y hora).
  select 6, 'Confirmaciones de nómina', count(*)::text,
         min(c->>'confirmadoEn'), max(c->>'confirmadoEn')
  from public.app_data, jsonb_path_query(data, '$.nominaDescuentos.*.weeks[*].confirmaciones[*]') as c

  union all
  -- Último guardado de los datos de la app.
  select 7, 'Último guardado de la app', count(*)::text, null, max(updated_at)::text
  from public.app_data

  union all
  -- Lo que ya registró la bitácora (si ya se activó).
  select 8, 'Bitácora: ' || tipo, count(*)::text, min(creado_en)::text, max(creado_en)::text
  from public.bitacora
  group by tipo
) r
order by orden, concepto;
