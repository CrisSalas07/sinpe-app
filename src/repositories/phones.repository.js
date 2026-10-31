import { pool } from '../config/db.js';

/** Every phone with its owner and, if enrolled in SINPE Móvil, the enrolled account. */
export async function findAll() {
  const [rows] = await pool.query(`
    SELECT
      t.id_telefono AS id,
      t.numero AS number,
      c.identificacion AS ownerIdentification,
      c.nombres AS ownerNames,
      c.primer_apellido AS ownerFirstSurname,
      c.segundo_apellido AS ownerSecondSurname,
      cu.iban AS enrolledIban
    FROM telefono_cliente t
    JOIN cliente c ON c.id_cliente = t.id_cliente
    LEFT JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono
    LEFT JOIN cuenta_iban cu ON cu.id_cuenta = af.id_cuenta
    ORDER BY t.id_cliente, t.id_telefono`);
  return rows;
}

/** Totals for the hero panel: phones, enrolled phones, phones not enrolled. */
export async function getStats() {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(af.id_afiliacion) AS enrolled,
      COUNT(*) - COUNT(af.id_afiliacion) AS notEnrolled
    FROM telefono_cliente t
    LEFT JOIN afiliacion_sinpe af ON af.id_telefono = t.id_telefono`);
  return rows[0];
}

export async function create({ identification, number }) {
  await pool.query('CALL sp_registrar_telefono(?, ?)', [identification, number]);
}

export async function changeOwner(number, identification) {
  await pool.query('CALL sp_cambiar_titular_telefono(?, ?)', [number, identification]);
}
