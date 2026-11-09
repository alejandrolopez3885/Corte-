-- Respaldo del catálogo antes de la limpieza única de noviembre 2026
-- (insumos, proveedores y capturas por insumo). Sin políticas: solo se
-- lee desde el SQL Editor; la app no la usa.
create table if not exists public.respaldo_catalogo (
  creado timestamptz default now(),
  owner_id uuid,
  data jsonb
);
alter table public.respaldo_catalogo enable row level security;
