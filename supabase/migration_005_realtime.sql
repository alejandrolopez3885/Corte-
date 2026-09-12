-- Habilita actualizaciones en vivo (Realtime): los cambios que hagas en un
-- dispositivo se reflejan solos en los demás, sin recargar la página.
-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
--
-- Si alguna de las dos líneas marca error porque la tabla "ya es miembro de
-- la publicación", ignóralo — significa que esa tabla ya estaba habilitada.
alter publication supabase_realtime add table public.app_data;
alter publication supabase_realtime add table public.staff_assignments;
