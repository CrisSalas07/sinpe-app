import { pool } from '../config/db.js';

const CLIENT_COLUMNS = `
  c.id_cliente AS id,
  c.identificacion AS identification,
  c.nombres AS names,
  c.primer_apellido AS firstSurname,
  c.segundo_apellido AS secondSurname,
  c.correo AS email,
  c.fecha_registro AS registeredAt,
  c.estado AS status`;

/** Every client with how many accounts and phones it has. */
export async function findAll() {
  const [rows] = await pool.query(`
    SELECT ${CLIENT_COLUMNS},
      (SELECT COUNT(*) FROM cuenta_iban a WHERE a.id_cliente = c.id_cliente) AS accounts,
      (SELECT COUNT(*) FROM telefono_cliente t WHERE t.id_cliente = c.id_cliente) AS phones
    FROM cliente c
    ORDER BY c.identificacion`);
  return rows;
}

export async function findByIdentification(identification) {
  const [rows] = await pool.query(
    `SELECT ${CLIENT_COLUMNS} FROM cliente c WHERE c.identificacion = ?`,
    [identification],
  );
  return rows[0] ?? null;
}

/** Totals for the hero panel: clients, active clients, clients with at least one account. */
export async function getStats() {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN estado = 'ACTIVO' THEN 1 END) AS active,
      (SELECT COUNT(DISTINCT id_cliente) FROM cuenta_iban) AS withAccounts
    FROM cliente`);
  return rows[0];
}

export async function create({
  identification,
  names,
  firstSurname,
  secondSurname,
  email,
  status,
}) {
  await pool.query('CALL sp_registrar_cliente(?, ?, ?, ?, ?, ?)', [
    identification,
    names,
    firstSurname,
    secondSurname,
    email,
    status,
  ]);
}
