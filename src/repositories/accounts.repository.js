import { pool } from '../config/db.js';

const ACCOUNT_SELECT = `
  SELECT
    a.id_cuenta AS id,
    a.iban,
    a.id_cliente AS clientId,
    c.nombres AS holderNames,
    c.primer_apellido AS holderFirstSurname,
    c.segundo_apellido AS holderSecondSurname,
    e.nombre AS bankName,
    e.codigo AS bankCode,
    a.moneda AS currency,
    a.saldo AS balance,
    a.estado AS status,
    a.fecha_apertura AS openedAt
  FROM cuenta_iban a
  JOIN cliente c ON c.id_cliente = a.id_cliente
  JOIN entidad_financiera e ON e.id_entidad = a.id_entidad`;

export async function findAll() {
  const [rows] = await pool.query(`${ACCOUNT_SELECT} ORDER BY a.iban`);
  return rows;
}

export async function findByIban(iban) {
  const [rows] = await pool.query(`${ACCOUNT_SELECT} WHERE a.iban = ?`, [iban]);
  return rows[0] ?? null;
}

/** Totals for the hero panel: accounts, active accounts, accounts in colones. */
export async function getStats() {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN estado = 'ACTIVA' THEN 1 END) AS active,
      COUNT(CASE WHEN moneda = 'CRC' THEN 1 END) AS crc
    FROM cuenta_iban`);
  return rows[0];
}

export async function create({ clientId, bankId, currency, iban, balance, openedAt, status }) {
  await pool.query('CALL sp_registrar_cuenta(?, ?, ?, ?, ?, ?, ?)', [
    clientId,
    bankId,
    currency,
    iban,
    balance,
    openedAt,
    status,
  ]);
}
