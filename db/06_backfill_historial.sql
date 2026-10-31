-- Backfills one AFILIACION event per current enrollment.
-- The seed enrollments in 01 were inserted before the triggers in 02 existed, so they have no history.
-- Safe to run more than once: an event that already exists is not inserted again.
-- Run as root (the app user has no INSERT privilege).
USE sinpe_movil;

INSERT INTO historial_afiliacion (id_telefono, id_cuenta, accion, fecha_evento)
SELECT a.id_telefono, a.id_cuenta, 'AFILIACION', a.fecha_afiliacion
FROM afiliacion_sinpe a
WHERE NOT EXISTS (
    SELECT 1
    FROM historial_afiliacion h
    WHERE h.id_telefono = a.id_telefono
      AND h.id_cuenta = a.id_cuenta
      AND h.accion = 'AFILIACION'
      AND h.fecha_evento = a.fecha_afiliacion
);
