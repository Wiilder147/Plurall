-- ============================================================
-- PLURALL — Migración 15: Corrección tipo_input en preguntas con opciones
-- Ejecutar después de 14_catalogos.sql
-- ============================================================
-- Hallazgo de la prueba end-to-end: las preguntas de antigüedad del
-- negocio y nivel de educación tienen opciones predefinidas con puntaje
-- (opcion_pregunta.valor_puntos: hasta 500 y 250 pts). Deben ser SELECT:
-- el cliente responde vía id_opcion y no aplica validación numérica.
-- ============================================================

UPDATE pregunta SET tipo_input = 'SELECT',
       enunciado = '¿Cuánto tiempo lleva operando su negocio?'
WHERE enunciado = '¿Cuántos meses lleva operando su negocio?';

UPDATE pregunta SET tipo_input = 'SELECT'
WHERE enunciado = '¿Cuál es su nivel de educación?' AND tipo_input = 'TEXTO';

-- El puntaje de antigüedad viene de sus opciones: desactivar los rangos
UPDATE rango_puntaje_pregunta r
SET activo = false
FROM pregunta p
WHERE p.id_pregunta = r.id_pregunta
  AND p.enunciado = '¿Cuánto tiempo lleva operando su negocio?';
