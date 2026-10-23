-- Notificaciones del dueño en su iPhone (Web Push). Ejecuta esto una vez en
-- el SQL Editor de Supabase después de migration_017 (ya está aplicado en
-- el proyecto de Cortes con el conector).
--
--   push_suscripciones  el iPhone (o navegador) del dueño donde llegan; las
--                       guarda la app al tocar "Activar en este iPhone"
--   notif_enviadas      cada aviso que ya se mandó (para no repetirlo)
-- La función de Supabase "notificaciones" (supabase/functions/notificaciones)
-- corre cada 5 minutos con pg_cron, revisa qué toca (conteo sin hacer a su
-- hora límite, conteo guardado con productos en 0 o sin contar, gastos
-- pendientes) y lo manda. Sus dos secretos viven en Supabase Vault (no en
-- el código): 'notif_vapid_privada' (la llave privada VAPID, JWK) y
-- 'notif_cron' (el que manda pg_cron para que nadie más la dispare).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.push_suscripciones (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  origen text,
  agente text,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table public.push_suscripciones enable row level security;
create policy "push_select" on public.push_suscripciones for select using (owner_id = auth.uid());
create policy "push_insert" on public.push_suscripciones for insert
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'));
create policy "push_update" on public.push_suscripciones for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'));

create table if not exists public.notif_enviadas (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  clave text not null,
  titulo text,
  enviado_en timestamptz not null default now(),
  primary key (owner_id, clave)
);
alter table public.notif_enviadas enable row level security;
create policy "notif_enviadas_select" on public.notif_enviadas for select using (owner_id = auth.uid());

-- Solo la función (con la llave de servicio) lee los secretos.
create or replace function public.secreto_notificaciones(p_nombre text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nombre and p_nombre like 'notif\_%'
$$;
revoke all on function public.secreto_notificaciones(text) from public, anon, authenticated;
grant execute on function public.secreto_notificaciones(text) to service_role;

-- Cada 5 minutos.
select cron.schedule('notificaciones', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://eozjpmvrfkzguevqpfke.supabase.co/functions/v1/notificaciones',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'notif_cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);

-- Los secretos se guardan aparte (no van en este archivo):
--   select vault.create_secret('<jwk>', 'notif_vapid_privada');
--   select vault.create_secret('<texto al azar>', 'notif_cron');
