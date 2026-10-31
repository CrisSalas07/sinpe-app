import { pool } from '../config/db.js';

/** Current SINPE Móvil enrollments with phone owner and enrolled account. */
export async function findAll() {
  const [rows] = await pool.query(`
    SELECT
      t.id_telefono AS phoneId,
      t.numero AS number,
      c.nombres AS ownerNames,
      c.primer_apellido AS ownerFirstSurname,
      cu.id_cuenta AS accountId,
      cu.iban,
      e.codigo AS bankCode,
      cu.moneda AS currency,
      af.fecha_afiliacion AS enrolledAt
    FROM afiliacion_sinpe af
    JOIN telefono_cliente t ON t.id_telefono = af.id_telefono
    JOIN cliente c ON c.id_cliente = t.id_cliente
    JOIN cuenta_iban cu ON cu.id_cuenta = af.id_cuenta
    JOIN entidad_financiera e ON e.id_entidad = cu.id_entidad
    ORDER BY t.id_cliente, t.id_telefono`);
  return rows;
}

/** Totals for the hero panel: enrolled phones, phones not enrolled, history events. */
export async function getStats() {
  const [rows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM afiliacion_sinpe) AS enrolled,
      (SELECT COUNT(*) FROM telefono_cliente) - (SELECT COUNT(*) FROM afiliacion_sinpe) AS notEnrolled,
      (SELECT COUNT(*) FROM historial_afiliacion) AS events`);
  return rows[0];
}

export async function enroll(phoneId, accountId) {
  await pool.query('CALL sp_afiliar_sinpe(?, ?)', [phoneId, accountId]);
}

export async function unenroll(number) {
  await pool.query('CALL sp_desafiliar_sinpe(?)', [number]);
}

export async function changeAccount(phoneId, accountId) {
  await pool.query('CALL sp_cambiar_cuenta_sinpe(?, ?)', [phoneId, accountId]);
}
