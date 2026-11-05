import { pool } from '../config/db.js';

const ENTITY_PHONES = `
  FROM telefono_cliente t
  JOIN cliente_entidad ce ON ce.id_cliente = t.id_cliente AND ce.id_entidad = ?
  JOIN cliente c ON c.id_cliente = t.id_cliente
  LEFT JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono`;

const NOT_ENROLLED_ELSEWHERE = `
  LEFT JOIN cuenta_iban cu ON cu.id_cuenta = af.id_cuenta
  WHERE af.id_afiliacion IS NULL OR cu.id_entidad = ?`;

/**
 * Phones an entity manages: those of its clients that are enrolled in it or not enrolled at all.
 * A bank does not get to list where its clients keep their SINPE Móvil in another entity.
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
      cu.iban AS enrolledIban
    ${ENTITY_PHONES}
    ${NOT_ENROLLED_ELSEWHERE}
    ORDER BY t.id_cliente, t.id_telefono`,
    [entityId, entityId],
  );
  return rows.map((row) => ({ ...row, enrolled: Boolean(row.enrolled) }));
}

/**
 * Every phone of the entity's clients, for the Afiliar and Informes selects: Afiliar must offer
 * phones enrolled elsewhere so the database can reject them. It says nothing about where.
 */
export async function findOptions(entityId) {
  const [rows] = await pool.query(
    `SELECT
      t.id_telefono AS id,
      t.numero AS number,
      c.nombres AS ownerNames,
      c.primer_apellido AS ownerFirstSurname,
      af.id_afiliacion IS NOT NULL AS enrolled
    ${ENTITY_PHONES}
    ORDER BY t.id_cliente, t.id_telefono`,
    [entityId],
  );
  return rows.map((row) => ({ ...row, enrolled: Boolean(row.enrolled) }));
}

/** Totals for the hero panel, over the same phones as findAll. */
export async function getStats(entityId) {
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      COUNT(af.id_afiliacion) AS enrolled,
      COUNT(*) - COUNT(af.id_afiliacion) AS notEnrolled
    ${ENTITY_PHONES}
    ${NOT_ENROLLED_ELSEWHERE}`,
    [entityId, entityId],
  );
  return rows[0];
}

export async function create(clientId, number) {
  await pool.query('CALL sp_registrar_telefono(?, ?)', [clientId, number]);
}

export async function changeOwner(entityId, number, identification) {
  await pool.query('CALL sp_cambiar_titular_telefono(?, ?, ?)', [entityId, number, identification]);
}
