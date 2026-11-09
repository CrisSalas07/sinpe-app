import { pool } from '../config/db.js';

/** Current SINPE Móvil enrollments in an entity, with phone owner and enrolled account. */
export async function findAll(entityId) {
  const [rows] = await pool.query(
    `SELECT
      t.id_telefono AS phoneId,
      t.numero AS number,
      c.id_cliente AS ownerId,
      c.nombres AS ownerNames,
      c.primer_apellido AS ownerFirstSurname,
      cu.id_cuenta AS accountId,
      cu.iban,
      e.codigo AS bankCode,
      cu.moneda AS currency,
      cu.estado AS accountStatus,
      af.fecha_afiliacion AS enrolledAt
    FROM afiliacion_sinpe af
    JOIN telefono_cliente t ON t.id_telefono = af.id_telefono
    JOIN cliente c ON c.id_cliente = t.id_cliente
    JOIN cuenta_iban cu ON cu.id_cuenta = af.id_cuenta
    JOIN entidad_financiera e ON e.id_entidad = cu.id_entidad
    WHERE cu.id_entidad = ?
    ORDER BY t.id_cliente, t.id_telefono`,
    [entityId],
  );
  return rows;
}

/**
 * Totals for the hero panel: phones enrolled in this entity, phones of its clients not enrolled
 * anywhere, and history events on its accounts.
 */
export async function getStats(entityId) {
  const [rows] = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM afiliacion_sinpe af
       JOIN cuenta_iban cu ON cu.id_cuenta = af.id_cuenta
       WHERE cu.id_entidad = ?) AS enrolled,
      (SELECT COUNT(*) FROM telefono_cliente t
       JOIN cliente_entidad ce ON ce.id_cliente = t.id_cliente AND ce.id_entidad = ?
       LEFT JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono
       WHERE af.id_afiliacion IS NULL) AS notEnrolled,
      (SELECT COUNT(*) FROM historial_afiliacion h
       JOIN cuenta_iban cu ON cu.id_cuenta = h.id_cuenta
       WHERE cu.id_entidad = ?) AS events`,
    [entityId, entityId, entityId],
  );
  return rows[0];
}

export async function enroll(entityId, phoneId, accountId) {
  await pool.query('CALL sp_afiliar_sinpe(?, ?, ?)', [entityId, phoneId, accountId]);
}

export async function unenroll(entityId, number) {
  await pool.query('CALL sp_desafiliar_sinpe(?, ?)', [entityId, number]);
}

export async function changeAccount(entityId, phoneId, accountId) {
  await pool.query('CALL sp_cambiar_cuenta_sinpe(?, ?, ?)', [entityId, phoneId, accountId]);
}
