-- Actividad (Negocio > Análisis > Actividad): amplía la bitácora para
-- estudiar el uso de la app. Ejecuta esto una vez en el SQL Editor de
-- Supabase, después de migration_007_bitacora.sql.
--
-- 1. Nuevo tipo 'vista': qué pantalla abrió cada quien (sin guardar nada
--    de lo que vio) — para saber qué secciones se usan y cuáles no.
-- 2. ref_fecha: la fecha del corte (o del día) al que se refiere un
--    cambio — para avisar cuando un corte se edita días después.
alter table public.bitacora drop constraint if exists bitacora_tipo_check;
alter table public.bitacora
  add constraint bitacora_tipo_check check (tipo in ('cambio', 'login', 'logout', 'vista'));

alter table public.bitacora add column if not exists ref_fecha date;
