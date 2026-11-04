import { pool } from '../config/db.js';

/** Every AFILIACION / DESAFILIACION event of a phone on accounts of the entity, oldest first. */
export async function findEnrollmentHistory(entityId, number) {
  const [rows] = await pool.query(
    `SELECT h.fecha_evento AS date, h.accion AS action, c.iban
     FROM historial_afiliacion h
     JOIN telefono_cliente t ON t.id_telefono = h.id_telefono
     JOIN cuenta_iban c ON c.id_cuenta = h.id_cuenta
     WHERE t.numero = ? AND c.id_entidad = ?
     ORDER BY h.fecha_evento, h.id_historial`,
    [number, entityId],
  );
  return rows;
}

/** Phones currently enrolled in SINPE Móvil to an account of the entity. */
export async function findAccountPhones(entityId, iban) {
  const [rows] = await pool.query(
    `SELECT t.numero AS number, af.fecha_afiliacion AS enrolledAt
     FROM afiliacion_sinpe af
     JOIN telefono_cliente t ON t.id_telefono = af.id_telefono
     JOIN cuenta_iban c ON c.id_cuenta = af.id_cuenta
     WHERE c.iban = ? AND c.id_entidad = ?
     ORDER BY af.fecha_afiliacion, t.id_telefono`,
    [iban, entityId],
  );
  return rows;
}
