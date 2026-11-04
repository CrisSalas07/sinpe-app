import { pool } from '../config/db.js';

export async function findEntities() {
  const [rows] = await pool.query(
    `SELECT id_entidad AS id, codigo AS code, nombre AS name
     FROM entidad_financiera
     ORDER BY id_entidad`,
  );
  return rows;
}

export async function findEntity(entityId) {
  const [rows] = await pool.query(
    `SELECT id_entidad AS id, codigo AS code, nombre AS name
     FROM entidad_financiera
     WHERE id_entidad = ?`,
    [entityId],
  );
  return rows[0] ?? null;
}

/** Credentials of a client in one entity, or null. */
export async function findClientLogin(entityId, username) {
  const [rows] = await pool.query(
    `SELECT ce.id_cliente, ce.usuario, ce.password_hash, c.nombres, c.primer_apellido, c.estado
     FROM cliente_entidad ce
     JOIN cliente c ON c.id_cliente = ce.id_cliente
     WHERE ce.id_entidad = ? AND ce.usuario = ?`,
    [entityId, username],
  );
  return rows[0] ?? null;
}
