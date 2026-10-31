import { pool } from '../config/db.js';

/** sp_consultar_movimientos returns two result sets: the movements and the totals. */
export async function findMovements(iban, from, to) {
  const [[movements, [totals]]] = await pool.query('CALL sp_consultar_movimientos(?, ?, ?)', [
    iban,
    from,
    to,
  ]);
  return {
    movements: movements.map((row) => ({
      id: row.id_transferencia,
      date: row.fecha,
      type: row.tipo,
      direction: row.movimiento,
      counterpartIban: row.iban_contraparte,
      counterpart: row.contraparte,
      amount: row.monto,
    })),
    totals: { sent: totals.total_enviado, received: totals.total_recibido },
  };
}

/** Every AFILIACION / DESAFILIACION event of a phone, oldest first. */
export async function findEnrollmentHistory(number) {
  const [rows] = await pool.query(
    `SELECT h.fecha_evento AS date, h.accion AS action, c.iban
     FROM historial_afiliacion h
     JOIN telefono_cliente t ON t.id_telefono = h.id_telefono
     JOIN cuenta_iban c ON c.id_cuenta = h.id_cuenta
     WHERE t.numero = ?
     ORDER BY h.fecha_evento, h.id_historial`,
    [number],
  );
  return rows;
}

/** Phones currently enrolled in SINPE Móvil to an account. */
export async function findAccountPhones(iban) {
  const [rows] = await pool.query(
    `SELECT t.numero AS number, af.fecha_afiliacion AS enrolledAt
     FROM afiliacion_sinpe af
     JOIN telefono_cliente t ON t.id_telefono = af.id_telefono
     JOIN cuenta_iban c ON c.id_cuenta = af.id_cuenta
     WHERE c.iban = ?
     ORDER BY af.fecha_afiliacion, t.id_telefono`,
    [iban],
  );
  return rows;
}
