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

export function transferBySinpe({ originNumber, destinationNumber, amount, detail }) {
  return callAndReadReceipt('CALL sp_transferir_sinpe(?, ?, ?, ?)', [
    originNumber,
    destinationNumber,
    amount,
    detail,
  ]);
}

export function transferByIban({ originIban, destinationIban, amount, detail }) {
  return callAndReadReceipt('CALL sp_transferir_iban(?, ?, ?, ?)', [
    originIban,
    destinationIban,
    amount,
    detail,
  ]);
}
