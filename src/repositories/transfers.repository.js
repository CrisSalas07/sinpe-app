import { pool } from '../config/db.js';

// Balances are read after the CALL; "before" is computed in SQL so DECIMAL stays exact.
const RECEIPT_SQL = `
  SELECT
    t.id_transferencia AS id,
    t.fecha AS date,
    t.tipo AS type,
    t.monto AS amount,
    t.detalle AS detail,
    o.moneda AS currency,
    o.iban AS originIban,
    o.saldo + t.monto AS originBefore,
    o.saldo AS originAfter,
    d.iban AS destinationIban,
    d.saldo - t.monto AS destinationBefore,
    d.saldo AS destinationAfter
  FROM transferencia t
  JOIN cuenta_iban o ON o.id_cuenta = t.id_cuenta_origen
  JOIN cuenta_iban d ON d.id_cuenta = t.id_cuenta_destino
  WHERE t.id_transferencia = ?`;

/**
 * Runs a transfer procedure and reads its receipt on the SAME connection:
 * the procedures do not return the id, and LAST_INSERT_ID() is per connection.
 */
async function callAndReadReceipt(callSql, params) {
  const conn = await pool.getConnection();
  try {
    await conn.query(callSql, params);
    const [[{ id }]] = await conn.query('SELECT LAST_INSERT_ID() AS id');
    const [[receipt]] = await conn.query(RECEIPT_SQL, [id]);
    return receipt;
  } finally {
    conn.release();
  }
}

export function transferBySinpe(
  { entityId, clientId },
  { originIban, destinationNumber, amount, detail },
) {
  return callAndReadReceipt('CALL sp_transferir_sinpe(?, ?, ?, ?, ?, ?)', [
    entityId,
    clientId,
    originIban,
    destinationNumber,
    amount,
    detail,
  ]);
}

export function transferByIban(
  { entityId, clientId },
  { originIban, destinationIban, amount, detail },
) {
  return callAndReadReceipt('CALL sp_transferir_iban(?, ?, ?, ?, ?, ?)', [
    entityId,
    clientId,
    originIban,
    destinationIban,
    amount,
    detail,
  ]);
}

/** Owner of a phone; entity is null if it has no SINPE Móvil enrollment. */
export async function findRecipientByNumber(number) {
  const [rows] = await pool.query(
    `SELECT c.nombres AS names, c.primer_apellido AS firstSurname, e.codigo AS entity
     FROM telefono_cliente t
     JOIN cliente c ON c.id_cliente = t.id_cliente
     LEFT JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono
     LEFT JOIN cuenta_iban cu ON cu.id_cuenta = af.id_cuenta
     LEFT JOIN entidad_financiera e ON e.id_entidad = cu.id_entidad
     WHERE t.numero = ?`,
    [number],
  );
  return rows[0] ?? null;
}

export async function findRecipientByIban(iban) {
  const [rows] = await pool.query(
    `SELECT c.nombres AS names, c.primer_apellido AS firstSurname, e.codigo AS entity
     FROM cuenta_iban cu
     JOIN cliente c ON c.id_cliente = cu.id_cliente
     JOIN entidad_financiera e ON e.id_entidad = cu.id_entidad
     WHERE cu.iban = ?`,
    [iban],
  );
  return rows[0] ?? null;
}

/** Daily SINPE Móvil limit of an account of the client, or null. DECIMAL math stays in SQL. */
export async function findDailyLimit(entityId, clientId, iban) {
  const [rows] = await pool.query(
    `SELECT
      limits.limitAmount AS \`limit\`,
      limits.usedToday,
      GREATEST(limits.limitAmount - limits.usedToday, 0) AS available
    FROM (
      SELECT
        e.limite_diario_sinpe AS limitAmount,
        (SELECT COALESCE(SUM(t.monto), 0)
         FROM transferencia t
         WHERE t.id_cuenta_origen = c.id_cuenta
           AND t.tipo = 'SINPE_MOVIL'
           AND t.fecha >= CURDATE()
           AND t.fecha < CURDATE() + INTERVAL 1 DAY) AS usedToday
      FROM cuenta_iban c
      JOIN entidad_financiera e ON e.id_entidad = c.id_entidad
      WHERE c.iban = ? AND c.id_cliente = ? AND c.id_entidad = ?
    ) limits`,
    [iban, clientId, entityId],
  );
  return rows[0] ?? null;
}
