import { pool } from '../config/db.js';

const ENTITY_PHONES = `
  FROM telefono_cliente t
  JOIN cliente_entidad ce ON ce.id_cliente = t.id_cliente AND ce.id_entidad = ?`;

/**
 * Phones of the clients of an entity. A phone can be enrolled in another entity: then enrolled is
 * true and enrolledBankCode says where, but enrolledIban stays null (it is data of that entity).
 */
export async function findAll(entityId) {
  const [rows] = await pool.query(
    `SELECT
      t.id_telefono AS id,
      t.numero AS number,
      c.identificacion AS ownerIdentification,
      c.nombres AS ownerNames,
      c.primer_apellido AS ownerFirstSurname,
      c.segundo_apellido AS ownerSecondSurname,
      af.id_afiliacion IS NOT NULL AS enrolled,
      e.codigo AS enrolledBankCode,
      CASE WHEN cu.id_entidad = ? THEN cu.iban END AS enrolledIban
    ${ENTITY_PHONES}
    JOIN cliente c ON c.id_cliente = t.id_cliente
    LEFT JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono
    LEFT JOIN cuenta_iban cu ON cu.id_cuenta = af.id_cuenta
    LEFT JOIN entidad_financiera e ON e.id_entidad = cu.id_entidad
    ORDER BY t.id_cliente, t.id_telefono`,
    [entityId, entityId],
  );
  return rows.map((row) => ({ ...row, enrolled: Boolean(row.enrolled) }));
}

/** Totals for the hero panel: phones, enrolled phones (in any entity), phones not enrolled. */
export async function getStats(entityId) {
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      COUNT(af.id_afiliacion) AS enrolled,
      COUNT(*) - COUNT(af.id_afiliacion) AS notEnrolled
    ${ENTITY_PHONES}
    LEFT JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono`,
    [entityId],
  );
  return rows[0];
}

export async function create(clientId, number) {
  await pool.query('CALL sp_registrar_telefono(?, ?)', [clientId, number]);
}

export async function changeOwner(entityId, number, identification) {
  await pool.query('CALL sp_cambiar_titular_telefono(?, ?, ?)', [entityId, number, identification]);
}
