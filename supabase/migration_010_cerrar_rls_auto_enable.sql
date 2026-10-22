-- Supabase instala la función public.rls_auto_enable() (la usa el event
-- trigger ensure_rls para activar RLS en cada tabla nueva de public), pero
-- quedaba llamable por cualquiera desde la API (/rest/v1/rpc). Solo el
-- disparador la necesita: se le quita el permiso a todos los demás. El
-- disparador sigue funcionando igual. Ya se aplicó en el proyecto de
-- Cortes; si la función no existe en tu proyecto, no hace falta correrlo.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
