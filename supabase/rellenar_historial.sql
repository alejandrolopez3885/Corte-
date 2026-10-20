-- Rellena el Historial de cambios (tabla bitacora) con lo que ya existía en
-- Supabase antes de activarlo. Todo queda marcado con "(recuperado)" en la
-- sección, para distinguirlo de lo que se registra en vivo.
-- Requiere haber corrido antes migration_007_bitacora.sql.
-- Pega todo en el SQL Editor de Supabase y dale Run. Solo se puede correr
-- una vez: si ya hay renglones recuperados, no hace nada.
--
-- Qué recupera:
--   1. Creación de cada cuenta (dueño y equipo), con su fecha y hora.
--   2. El ÚLTIMO inicio de sesión de cada cuenta (Supabase no guarda los
--      anteriores).
--   3. Los días asignados a alguien del equipo, con fecha y hora.
--   4. "Corte hecho por" de cada día del corte — sin hora exacta: queda a
--      las 23:59 de ese día.
--   5. Las confirmaciones de "Recibí mi nómina correcta", con fecha y hora.
do $$
declare
  dueno_id uuid;
  dueno_nombre text;
  dias text[] := array['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
begin
  if exists (select 1 from public.bitacora where seccion like '%(recuperado)') then
    raise notice 'El historial ya se había rellenado; no se hizo nada.';
    return;
  end if;

  select id, coalesce(display_name, 'Dueño') into dueno_id, dueno_nombre
  from public.profiles where role = 'owner' order by created_at limit 1;

  -- 1. Cuentas creadas.
  insert into public.bitacora (owner_id, actor_id, actor_nombre, tipo, seccion, donde, detalle, creado_en)
  select dueno_id, dueno_id, dueno_nombre, 'cambio', 'Equipo (recuperado)',
         'Acceso a la app · ' || coalesce(p.display_name, 'Cuenta'),
         jsonb_build_array(jsonb_build_object('accion', 'agregó',
           'texto', case when p.role = 'owner' then 'Cuenta del dueño' else 'Cuenta con PIN' end)),
         p.created_at
  from public.profiles p;

  -- 2. Último inicio de sesión de cada cuenta.
  insert into public.bitacora (owner_id, actor_id, actor_nombre, tipo, seccion, donde, detalle, creado_en)
  select dueno_id, u.id, coalesce(p.display_name, 'Cuenta eliminada'), 'cambio', 'Sesiones (recuperado)',
         'Último inicio de sesión registrado',
         jsonb_build_array(jsonb_build_object('accion', 'agregó',
           'texto', 'Inició sesión (Supabase solo conserva el último de cada cuenta)')),
         u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.last_sign_in_at is not null;

  -- 3. Días asignados.
  insert into public.bitacora (owner_id, actor_id, actor_nombre, tipo, seccion, donde, detalle, creado_en)
  select dueno_id, dueno_id, dueno_nombre, 'cambio', 'Corte (recuperado)',
         'Asignación de día · ' || to_char(a.assigned_date, 'DD/MM/YYYY'),
         jsonb_build_array(jsonb_build_object('accion', 'agregó',
           'texto', 'Día asignado a ' || coalesce(p.display_name, 'alguien del equipo'))),
         a.created_at
  from public.staff_assignments a
  left join public.profiles p on p.id = a.staff_id;

  -- 4. "Corte hecho por" de cada día (sin hora: 23:59 de ese día).
  insert into public.bitacora (owner_id, actor_id, actor_nombre, tipo, seccion, donde, detalle, creado_en)
  select dueno_id,
         coalesce(pe.id, dueno_id),
         d.value->'hechoPor'->>'nombre',
         'cambio', 'Corte (recuperado)',
         'Corte ' || left(d.key, 3) || ' ' || to_char(fecha, 'DD/MM/YYYY'),
         jsonb_build_array(jsonb_build_object('accion', 'agregó',
           'texto', 'Capturó el corte de este día (hora no registrada)')),
         (fecha + time '23:59') at time zone 'America/Mexico_City'
  from public.app_data ad
  cross join lateral jsonb_each(ad.data->'months') m
  cross join lateral jsonb_array_elements(m.value->'weeks') with ordinality w(semana, n)
  cross join lateral jsonb_each(w.semana->'days') d
  cross join lateral (
    select coalesce((m.value->>'week1StartDate')::date, date_trunc('week', (m.key || '-01')::date)::date)
           + ((w.n - 1) * 7)::int + (array_position(dias, d.key) - 1) as fecha
  ) f
  left join public.profiles pe on pe.empleado_id = d.value->'hechoPor'->>'empleadoId'
  where d.value ? 'hechoPor';

  -- 5. Confirmaciones de nómina.
  insert into public.bitacora (owner_id, actor_id, actor_nombre, tipo, seccion, donde, detalle, creado_en)
  select dueno_id,
         coalesce(pe.id, dueno_id),
         c.value->>'nombre',
         'cambio', 'Nómina (recuperado)',
         'Nómina Semana ' || w.n || ' (' || coalesce(ad.data->'months'->m.key->>'label', m.key) || ')',
         jsonb_build_array(jsonb_build_object('accion', 'agregó', 'texto', 'Recibí mi nómina correcta')),
         (c.value->>'confirmadoEn')::timestamptz
  from public.app_data ad
  cross join lateral jsonb_each(ad.data->'nominaDescuentos') m
  cross join lateral jsonb_array_elements(m.value->'weeks') with ordinality w(semana, n)
  cross join lateral jsonb_array_elements(coalesce(w.semana->'confirmaciones', '[]'::jsonb)) c
  left join public.profiles pe on pe.empleado_id = c.value->>'empleadoId'
  where jsonb_typeof(w.semana) = 'object';

  raise notice 'Historial rellenado.';
end $$;
