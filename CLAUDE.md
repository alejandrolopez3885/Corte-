# Instrucciones para Claude

- App personal para el restaurante del dueño. Se trabaja paso por paso:
  antes de cualquier cambio visible en la app, generar un PNG con la vista
  previa de cómo se vería y esperar el visto bueno del dueño.
- Ya aprobado e implementado (build sin errores con `npm run build`), se
  publica directo en la rama principal `claude/proyecto-supabase-deploy-pp3x0q`,
  que es la que despliega la app live — sin PR. Si se trabaja en otra rama,
  al final también se empuja a la principal.
- Los PNG de vista previa no se suben al repo.
- Para cualquier cambio visible usar la skill `ui-ux-pro-max`
  (`.claude/skills/ui-ux-pro-max`) como guía de UX/UI (accesibilidad,
  botones grandes para celular, jerarquía, formularios), sin cambiar el
  estilo que ya tiene la app (colores verdes, títulos en Fraunces) y sin
  saltarse la vista previa en PNG.
- Todo en español (textos de la app, README, commits).
- El README describe cada pantalla a detalle: actualizarlo junto con el código.
- Si un cambio lo ve el personal (cuentas de equipo), agregar en el mismo
  cambio su novedad en `src/lib/novedades.ts` (fecha y hora de publicación,
  sección, título corto, una frase y su dibujito) para que se le avise al
  entrar.
- Las novedades de cambios del corte que tienen que ver con Johnster Bot
  (revisiones contra el bot, comprobantes, etc.) llevan `soloDueno: true`:
  solo las ve el dueño, el personal no.
