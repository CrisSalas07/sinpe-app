import { pool } from '../config/db.js';

export async function findBanks() {
  const [rows] = await pool.query(
    'SELECT id_entidad AS id, codigo AS code, nombre AS name FROM entidad_financiera ORDER BY id_entidad',
  );
  return rows;
}

export async function findCurrencies() {
  const [rows] = await pool.query(
    'SELECT codigo AS code, descripcion AS description FROM moneda ORDER BY codigo',
  );
  return rows;
}
