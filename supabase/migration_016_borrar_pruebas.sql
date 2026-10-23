-- Borrar encuestas de prueba (solo el dueño). Ejecuta esto una vez en el
-- SQL Editor de Supabase (ya está aplicado en el proyecto de Cortes con el
-- conector).
--
-- Solo las de prueba del propio dueño: las de los meseros no se pueden
-- borrar. Al borrar la encuesta se van con ella su respuesta y sus pasos
-- del seguimiento (on delete cascade). Sin p_id borra todas las de prueba.
-- Devuelve cuántas borró.

create or replace function public.borrar_encuestas_prueba(p_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_borradas integer;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner') then
    raise exception 'Solo el dueño borra encuestas de prueba';
  end if;
  delete from public.encuestas e
    where e.owner_id = auth.uid() and e.prueba and (p_id is null or e.id = p_id);
  get diagnostics v_borradas = row_count;
  return v_borradas;
end $$;

revoke all on function public.borrar_encuestas_prueba(uuid) from public, anon;
grant execute on function public.borrar_encuestas_prueba(uuid) to authenticated;
