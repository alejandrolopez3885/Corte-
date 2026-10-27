-- "Volver a antes de este cambio" (Corte › Historial de este día). Ejecuta
-- esto una vez después de migration_021 (ya está aplicado en el proyecto de
-- Cortes con el conector).
--
-- Cada vez que se guarda un cambio en el corte de un día, la app guarda en
-- su renglón de la bitácora cómo estaba ese día justo antes (dia_antes), y
-- el dueño puede regresar el día a ese momento.
alter table public.bitacora add column if not exists dia_antes jsonb;
