# Instrucciones para Claude

- App personal para el restaurante del dueño. Se trabaja paso por paso:
  antes de cualquier cambio visible en la app, generar un PNG con la vista
  previa de cómo se vería y esperar el visto bueno del dueño.
- Ya aprobado e implementado (build sin errores con `npm run build`), se
  publica directo en la rama principal `claude/proyecto-supabase-deploy-pp3x0q`,
  que es la que despliega la app live — sin PR. Si se trabaja en otra rama,
  al final también se empuja a la principal.
- Los PNG de vista previa no se suben al repo.
- Todo en español (textos de la app, README, commits).
- El README describe cada pantalla a detalle: actualizarlo junto con el código.
- Si un cambio lo ve el personal (cuentas de equipo), agregar en el mismo
  cambio su novedad en `src/lib/novedades.ts` (fecha y hora de publicación,
  sección, título corto, una frase y su dibujito) para que se le avise al
  entrar.
