-- Control de gastos en transferencia: los gastos en transferencia de la
-- sucursal en Johnster (operación, gastos fijos, comisión bancaria y
-- comisiones de apps), para compararlos con lo de la app.
alter table public.johnster_datos add column if not exists transferencias jsonb not null default '[]'::jsonb;
