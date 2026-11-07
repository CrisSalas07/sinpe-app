import { pool } from '../config/db.js';

/** Indicators of Inicio: accounts in the entity, phones of the client, phones enrolled anywhere. */
export async function findSummary(entityId, clientId) {
  const [rows] = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM cuenta_iban WHERE id_cliente = ? AND id_entidad = ?) AS accounts,
      (SELECT COUNT(*) FROM telefono_cliente WHERE id_cliente = ?) AS phones,
      (SELECT COUNT(*) FROM telefono_cliente t
       JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono
       WHERE t.id_cliente = ?) AS enrolled`,
    [clientId, entityId, clientId, clientId],
  );
  return rows[0];
}

export async function findAccounts(entityId, clientId) {
  const [rows] = await pool.query(
    `SELECT iban, moneda AS currency, saldo AS balance, estado AS status
     FROM cuenta_iban
     WHERE id_cliente = ? AND id_entidad = ?
     ORDER BY iban`,
    [clientId, entityId],
  );
  return rows;
}

/** Last movements of the client in the entity, newest first. */
export async function findRecentMovements(entityId, clientId, limit) {
  const mine = [clientId, entityId];
  const [rows] = await pool.query(
    `SELECT
      t.id_transferencia AS id,
      t.fecha AS date,
      t.monto AS amount,
      o.moneda AS currency,
      CASE WHEN o.id_cliente = ? AND o.id_entidad = ? THEN 'ENVIADA' ELSE 'RECIBIDA' END AS direction,
      cl.nombres AS counterpartNames,
      cl.primer_apellido AS counterpartSurname
    FROM transferencia t
    JOIN cuenta_iban o ON o.id_cuenta = t.id_cuenta_origen
    JOIN cuenta_iban d ON d.id_cuenta = t.id_cuenta_destino
    JOIN cliente cl ON cl.id_cliente = CASE WHEN o.id_cliente = ? AND o.id_entidad = ?
                                            THEN d.id_cliente ELSE o.id_cliente END
    WHERE (o.id_cliente = ? AND o.id_entidad = ?) OR (d.id_cliente = ? AND d.id_entidad = ?)
    ORDER BY t.fecha DESC, t.id_transferencia DESC
    LIMIT ?`,
    [...mine, ...mine, ...mine, ...mine, limit],
  );
  return rows;
}

/** sp_consultar_movimientos returns two result sets: the movements and the totals. */
export async function findMovements(entityId, clientId, { iban, from, to }) {
  const [[movements, [totals]]] = await pool.query('CALL sp_consultar_movimientos(?, ?, ?, ?, ?)', [
    clientId,
    entityId,
    iban,
    from,
    to,
  ]);
  return {
    movements: movements.map((row) => ({
      id: row.id_transferencia,
      date: row.fecha,
      direction: row.movimiento,
      counterpartNames: row.nombres_contraparte,
      counterpartSurname: row.apellido_contraparte,
      amount: row.monto,
    })),
    totals: { sent: totals.total_enviado, received: totals.total_recibido },
  };
}

/**
 * Phones of the client. As in Teléfonos, the IBAN of an enrollment in another entity stays null:
 * enrolled and enrolledBankCode say where it is.
 */
export async function findPhones(entityId, clientId) {
  const [rows] = await pool.query(
    `SELECT
      t.numero AS number,
      t.fecha_registro AS registeredAt,
      af.id_afiliacion IS NOT NULL AS enrolled,
      e.codigo AS enrolledBankCode,
      CASE WHEN cu.id_entidad = ? THEN cu.iban END AS enrolledIban
    FROM telefono_cliente t
    LEFT JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono
    LEFT JOIN cuenta_iban cu ON cu.id_cuenta = af.id_cuenta
    LEFT JOIN entidad_financiera e ON e.id_entidad = cu.id_entidad
    WHERE t.id_cliente = ?
    ORDER BY t.id_telefono`,
    [entityId, clientId],
  );
  return rows.map((row) => ({ ...row, enrolled: Boolean(row.enrolled) }));
}
