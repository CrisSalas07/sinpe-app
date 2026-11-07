import { pool } from '../config/db.js';

const ACCOUNT_SELECT = `
  SELECT
    a.id_cuenta AS id,
    a.iban,
    a.id_cliente AS clientId,
    c.nombres AS holderNames,
    c.primer_apellido AS holderFirstSurname,
    c.segundo_apellido AS holderSecondSurname,
    e.codigo AS bankCode,
    a.moneda AS currency,
    a.saldo AS balance,
    a.estado AS status,
    a.fecha_apertura AS openedAt
  FROM cuenta_iban a
  JOIN cliente c ON c.id_cliente = a.id_cliente
  JOIN entidad_financiera e ON e.id_entidad = a.id_entidad`;

export async function findAll(entityId) {
  const [rows] = await pool.query(`${ACCOUNT_SELECT} WHERE a.id_entidad = ? ORDER BY a.iban`, [
    entityId,
  ]);
  return rows;
}

export async function findByIban(iban) {
  const [rows] = await pool.query(`${ACCOUNT_SELECT} WHERE a.iban = ?`, [iban]);
  return rows[0] ?? null;
}

/** Totals for the hero panel: accounts, active accounts, accounts in colones. */
export async function getStats(entityId) {
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN estado = 'ACTIVA' THEN 1 END) AS active,
      COUNT(CASE WHEN moneda = 'CRC' THEN 1 END) AS crc
    FROM cuenta_iban
    WHERE id_entidad = ?`,
    [entityId],
  );
  return rows[0];
}

export async function create(entityId, { clientId, currency, iban, balance, openedAt }) {
  await pool.query('CALL sp_registrar_cuenta(?, ?, ?, ?, ?, ?)', [
    entityId,
    clientId,
    currency,
    iban,
    balance,
    openedAt,
  ]);
}

/**
 * Suggested IBAN for a new account of the entity: "CR12" (the fixed check digits of the seed data),
 * "0" + the entity's IBAN code, and the next account number of that entity in 14 digits.
 * shortcut: two admins generating at the same moment get the same IBAN; sp_registrar_cuenta rejects
 * the second one ("El IBAN ya está registrado") and generating again fixes it. Fine for this demo.
 */
export async function findNextIban(entityId) {
  const [rows] = await pool.query(
    `SELECT CONCAT('CR12', '0', e.codigo_iban,
                   LPAD(COALESCE(MAX(CAST(SUBSTRING(c.iban, 9) AS UNSIGNED)), 0) + 1, 14, '0')) AS iban
     FROM entidad_financiera e
     LEFT JOIN cuenta_iban c ON c.id_entidad = e.id_entidad
     WHERE e.id_entidad = ?
     GROUP BY e.id_entidad, e.codigo_iban`,
    [entityId],
  );
  return rows[0]?.iban ?? null;
}

export async function changeStatus(entityId, iban, status) {
  await pool.query('CALL sp_cambiar_estado_cuenta(?, ?, ?)', [entityId, iban, status]);
}
