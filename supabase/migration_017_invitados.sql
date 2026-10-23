-- Acceso de invitado (solo lectura). Ejecuta esto una vez en el SQL Editor
-- de Supabase después de migration_016 (ya está aplicado en el proyecto de
-- Cortes con el conector).
--
-- Un invitado es una cuenta de equipo (role 'staff', entra con PIN) con
-- invitado_hasta: hasta ese momento puede LEER todo el negocio de su dueño
-- (con números reales) y nada más; no puede escribir en ninguna tabla. Al
-- vencer ya no lee nada. Al final del recorrido deja su opinión en
-- invitado_opiniones, que solo lee el dueño.
--
-- De paso: una cuenta de equipo ya no puede cambiarse a sí misma el rol, el
-- dueño, los permisos, su persona de Personal ni el vencimiento (antes la
-- política de profiles lo permitía); eso solo lo cambia el dueño.

alter table public.profiles add column if not exists invitado_hasta timestamptz;

-- El dueño cuyo negocio puede ver este invitado (null si no es invitado o
-- ya venció).
create or replace function public.invitado_de()
returns uuid language sql stable security definer set search_path = public as $$
  select p.owner_id from public.profiles p
  where p.id = auth.uid() and p.invitado_hasta is not null and p.invitado_hasta > now()
$$;
revoke all on function public.invitado_de() from public, anon;
grant execute on function public.invitado_de() to authenticated;

-- Si quien pregunta es un invitado (vigente o no).
create or replace function public.soy_invitado()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.invitado_hasta is not null)
$$;
revoke all on function public.soy_invitado() from public, anon;
grant execute on function public.soy_invitado() to authenticated;

-- Que nadie se edite a sí mismo lo que solo decide el dueño.
create or replace function public.proteger_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and old.role <> 'owner' and (
    new.role is distinct from old.role or new.owner_id is distinct from old.owner_id
    or new.permisos is distinct from old.permisos or new.empleado_id is distinct from old.empleado_id
    or new.invitado_hasta is distinct from old.invitado_hasta
  ) then
    raise exception 'Eso solo lo puede cambiar el dueño';
  end if;
  return new;
end $$;
revoke all on function public.proteger_perfil() from public, anon, authenticated;
create trigger profiles_proteger before update on public.profiles
  for each row execute function public.proteger_perfil();

-- app_data: el invitado vigente lee; ningún invitado escribe.
alter policy "app_data_select" on public.app_data
  using ((owner_id = auth.uid()) or (owner_id = (select p.owner_id from public.profiles p
    where p.id = auth.uid() and (p.invitado_hasta is null or p.invitado_hasta > now()))));
alter policy "app_data_update" on public.app_data
  using ((owner_id = auth.uid()) or (owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid() and p.invitado_hasta is null)))
  with check ((owner_id = auth.uid()) or (owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid() and p.invitado_hasta is null)));

-- Datos de pago: el invitado no guarda los suyos.
alter policy "datos_pago_insert" on public.datos_pago
  with check ((profile_id = auth.uid()) and not public.soy_invitado()
    and (owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid())));
alter policy "datos_pago_update" on public.datos_pago
  using ((profile_id = auth.uid()) and not public.soy_invitado())
  with check ((profile_id = auth.uid()) and not public.soy_invitado()
    and (owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid())));

-- Lo que el invitado vigente puede leer, igual que su dueño.
create policy "invitado_bitacora" on public.bitacora for select using (owner_id = public.invitado_de());
create policy "invitado_datos_pago" on public.datos_pago for select using (owner_id = public.invitado_de());
create policy "invitado_encuestas" on public.encuestas for select using (owner_id = public.invitado_de());
create policy "invitado_encuesta_respuestas" on public.encuesta_respuestas for select using (owner_id = public.invitado_de());
create policy "invitado_encuesta_eventos" on public.encuesta_eventos for select using (owner_id = public.invitado_de());
create policy "invitado_puntos_movimientos" on public.puntos_movimientos for select using (owner_id = public.invitado_de());
create policy "invitado_meseros_cuentas" on public.meseros_cuentas for select using (owner_id = public.invitado_de());
create policy "invitado_profiles" on public.profiles for select using (owner_id = public.invitado_de() or id = public.invitado_de());
create policy "invitado_staff_assignments" on public.staff_assignments for select
  using (staff_id in (select p.id from public.profiles p where p.owner_id = public.invitado_de()));

-- Generar encuestas: no los invitados (igual que migration_015_mesa_obligatoria, con la mesa obligatoria).
create or replace function public.crear_encuesta(p_total numeric, p_mesa text, p_mesero_id text, p_mesero_nombre text)
returns table (id uuid, token text, vence_en timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_hoy int;
  v_id uuid;
  v_token text;
  v_vence timestamptz;
begin
  select p.owner_id into v_owner from public.profiles p where p.id = auth.uid() and p.role = 'staff' and p.invitado_hasta is null;
  if v_owner is null then raise exception 'Solo las cuentas de equipo generan encuestas'; end if;
  if p_total is null or p_total <= 0 then raise exception 'Escribe el total de la cuenta'; end if;
  if nullif(trim(coalesce(p_mesa, '')), '') is null then raise exception 'Escribe la mesa'; end if;
  select count(*) into v_hoy from public.encuestas e
    where e.creado_por = auth.uid()
      and (e.creado_en at time zone 'America/Monterrey')::date = (now() at time zone 'America/Monterrey')::date;
  if v_hoy >= 15 then raise exception 'Ya generaste las 15 encuestas de hoy'; end if;
  insert into public.encuestas (token, owner_id, creado_por, mesero_id, mesero_nombre, total, mesa, vence_en)
  values (replace(gen_random_uuid()::text, '-', ''), v_owner, auth.uid(), p_mesero_id, left(p_mesero_nombre, 80),
          round(p_total, 2), left(trim(p_mesa), 20), now() + interval '30 minutes')
  returning encuestas.id, encuestas.token, encuestas.vence_en into v_id, v_token, v_vence;
  insert into public.encuesta_eventos (owner_id, encuesta_id, creado_por, mesero_id, mesero_nombre, tipo)
  values (v_owner, v_id, auth.uid(), p_mesero_id, left(p_mesero_nombre, 80), 'generada');
  return query select v_id, v_token, v_vence;
end $$;

-- La opinión del invitado al final del recorrido.
create table if not exists public.invitado_opiniones (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  nombre text not null check (char_length(nombre) <= 80),
  estrellas smallint not null check (estrellas between 1 and 5),
  gusto text[] not null default '{}',
  sucursales text check (sucursales in ('si', 'tal vez', 'no')),
  mejoras text check (char_length(mejoras) <= 1000),
  creado_en timestamptz not null default now()
);
create index if not exists invitado_opiniones_owner on public.invitado_opiniones (owner_id, creado_en);
alter table public.invitado_opiniones enable row level security;
create policy "invitado_opiniones_select" on public.invitado_opiniones for select using (owner_id = auth.uid());
create policy "invitado_opiniones_insert" on public.invitado_opiniones for insert
  with check (profile_id = auth.uid() and owner_id = public.invitado_de() and cardinality(gusto) <= 12);
