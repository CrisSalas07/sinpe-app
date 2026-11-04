import { pool } from '../config/db.js';

const CLIENT_COLUMNS = `
  c.id_cliente AS id,
  c.identificacion AS identification,
  c.nombres AS names,
  c.primer_apellido AS firstSurname,
  c.segundo_apellido AS secondSurname,
  c.correo AS email,
  c.estado AS status,
  ce.usuario AS username`;

const CLIENT_FROM = `
  FROM cliente_entidad ce
  JOIN cliente c ON c.id_cliente = ce.id_cliente`;

/** Clients of an entity with how many accounts (in that entity) and phones they have. */
export async function findAll(entityId) {
  const [rows] = await pool.query(
    `SELECT ${CLIENT_COLUMNS},
      (SELECT COUNT(*) FROM cuenta_iban a
       WHERE a.id_cliente = c.id_cliente AND a.id_entidad = ce.id_entidad) AS accounts,
      (SELECT COUNT(*) FROM telefono_cliente t WHERE t.id_cliente = c.id_cliente) AS phones
    ${CLIENT_FROM}
    WHERE ce.id_entidad = ?
    ORDER BY c.identificacion`,
    [entityId],
  );
  return rows;
}

export async function findByIdentification(entityId, identification) {
  const [rows] = await pool.query(
    `SELECT ${CLIENT_COLUMNS} ${CLIENT_FROM}
     WHERE ce.id_entidad = ? AND c.identificacion = ?`,
    [entityId, identification],
  );
  return rows[0] ?? null;
}

/** Totals for the hero panel: clients, active clients, clients with an account in the entity. */
export async function getStats(entityId) {
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN c.estado = 'ACTIVO' THEN 1 END) AS active,
      (SELECT COUNT(DISTINCT id_cliente) FROM cuenta_iban WHERE id_entidad = ?) AS withAccounts
    ${CLIENT_FROM}
    WHERE ce.id_entidad = ?`,
    [entityId, entityId],
  );
  return rows[0];
}

export async function create(
  entityId,
  { identification, names, firstSurname, secondSurname, email, username },
  passwordHash,
) {
  await pool.query('CALL sp_registrar_cliente(?, ?, ?, ?, ?, ?, ?, ?)', [
    entityId,
    identification,
    names,
    firstSurname,
    secondSurname,
    email,
    username,
    passwordHash,
  ]);
}
