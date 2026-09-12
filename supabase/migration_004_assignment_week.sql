-- Migración: la semana de cada día asignado ya no se adivina por fecha.
-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Las pestañas "Semana 1/2/3/4" de tu corte son manuales (no están atadas a
-- fechas reales) — dependen de cuándo empezaste a capturar ese mes, no del
-- número de día del calendario. Antes, la app adivinaba la semana de una
-- fecha asignada con una regla fija (días 1-7 = Semana 1, 8-14 = Semana 2,
-- ...), lo que podía no coincidir con la semana real donde tú ya habías
-- capturado esa fecha. Ahora tú eliges la semana al asignar el día.
alter table public.staff_assignments add column if not exists week_index smallint check (week_index between 0 and 3);
