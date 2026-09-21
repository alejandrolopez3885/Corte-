-- Acceso por PIN con permisos por sección, para dar de alta cuentas de
-- equipo adicionales (ej. jefe de cocina) desde Equipo > Personal, además
-- de la cuenta de meseros que ya existía en "Tu equipo".
-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- empleado_id: a qué persona del catálogo de Personal (Equipo > Personal,
-- vive en app_data.empleados, no es una tabla) corresponde esta cuenta —
-- así la app sabe su puesto/área sin duplicar esos datos aquí.
-- permisos: lista de secciones habilitadas para esta cuenta (ej.
-- 'horarios'). Vacío = sin acceso a nada todavía.
alter table public.profiles add column if not exists empleado_id text;
alter table public.profiles add column if not exists permisos text[] not null default '{}';

-- Ya existían policies de select/insert/update para profiles, pero
-- ninguna de delete — sin esta, "Quitar acceso" no puede borrar la cuenta
-- de un empleado (staff_login_directory se borra solo, por el ON DELETE
-- CASCADE que ya tenía hacia profiles).
create policy "profiles_delete" on public.profiles
  for delete
  using (owner_id = auth.uid());
