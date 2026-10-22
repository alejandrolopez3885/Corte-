-- Datos para el pago de nómina (Mi perfil): banco, número de tarjeta o
-- CLABE y titular de cada cuenta de equipo. Ejecuta esto una vez en el SQL
-- Editor de Supabase (New query → pegar → Run).
--
-- Van en su propia tabla, fuera de app_data, para que solo los vean la
-- persona misma y su dueño — ninguna otra cuenta del equipo, ni con
-- conocimientos técnicos. Solo la persona los guarda o los cambia; el dueño
-- solo los lee. Nunca se guarda NIP, CVV ni fecha de vencimiento.
create table if not exists public.datos_pago (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  empleado_id text,
  banco text not null,
  numero text not null check (numero ~ '^[0-9]{16}$' or numero ~ '^[0-9]{18}$'),
  titular text not null,
  confirmado_en timestamptz not null default now()
);

alter table public.datos_pago enable row level security;

drop policy if exists "datos_pago_select" on public.datos_pago;
create policy "datos_pago_select" on public.datos_pago
  for select
  using (profile_id = auth.uid() or owner_id = auth.uid());

drop policy if exists "datos_pago_insert" on public.datos_pago;
create policy "datos_pago_insert" on public.datos_pago
  for insert
  with check (
    profile_id = auth.uid()
    and owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "datos_pago_update" on public.datos_pago;
create policy "datos_pago_update" on public.datos_pago
  for update
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and owner_id = (select p.owner_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "datos_pago_delete" on public.datos_pago;
create policy "datos_pago_delete" on public.datos_pago
  for delete
  using (profile_id = auth.uid());
