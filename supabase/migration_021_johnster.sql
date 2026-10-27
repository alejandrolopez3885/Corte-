-- Cuadrar con Johnster (Corte › ⚖︎ Cuadrar). Ejecuta esto una vez después
-- de migration_020 (ya está aplicado en el proyecto de Cortes con el conector).
--
--   johnster_datos  lo último que se trajo de Johnster Bot para la sucursal
--                   del dueño: ingresos por día (venta, tarjetas,
--                   transferencias, efectivo) y gastos en efectivo. Lo llena
--                   la función "johnster" (supabase/functions/johnster): cada
--                   mañana con pg_cron y cuando el dueño toca ↻.
-- El usuario y la contraseña de Johnster viven en Supabase Vault (no en el
-- código): 'johnster_usuario', 'johnster_password' (los guarda la función
-- cuando el dueño toca "Conectar con Johnster" en la app). 'johnster_cron'
-- es el que manda pg_cron.

create table if not exists public.johnster_datos (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  sucursal text,
  ingresos jsonb not null default '[]'::jsonb,
  gastos jsonb not null default '[]'::jsonb,
  actualizado_en timestamptz,
  error text
);
alter table public.johnster_datos enable row level security;
create policy "johnster_select" on public.johnster_datos for select using (owner_id = auth.uid());

-- Solo la función (con la llave de servicio) lee y guarda los secretos.
create or replace function public.secreto_johnster(p_nombre text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nombre and p_nombre like 'johnster\_%'
$$;
revoke all on function public.secreto_johnster(text) from public, anon, authenticated;
grant execute on function public.secreto_johnster(text) to service_role;

create or replace function public.guardar_secreto_johnster(p_nombre text, p_valor text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_nombre not like 'johnster\_%' then raise exception 'nombre no permitido'; end if;
  select id into v_id from vault.secrets where name = p_nombre;
  if v_id is null then perform vault.create_secret(p_valor, p_nombre);
  else perform vault.update_secret(v_id, p_valor, p_nombre); end if;
end $$;
revoke all on function public.guardar_secreto_johnster(text, text) from public, anon, authenticated;
grant execute on function public.guardar_secreto_johnster(text, text) to service_role;

-- Cada mañana a las 7:05 (Monterrey, 13:05 UTC).
select cron.schedule('johnster', '5 13 * * *', $cron$
  select net.http_post(
    url := 'https://eozjpmvrfkzguevqpfke.supabase.co/functions/v1/johnster',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'johnster_cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);

-- Los secretos se guardan aparte (no van en este archivo):
--   select public.guardar_secreto_johnster('johnster_cron', '<texto al azar>');
-- y el usuario/contraseña los guarda la función con { accion: "conectar" }.
