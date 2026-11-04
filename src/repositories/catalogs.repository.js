import { pool } from '../config/db.js';

export async function findCurrencies() {
  const [rows] = await pool.query(
    'SELECT codigo AS code, descripcion AS description FROM moneda ORDER BY codigo',
  );
  return rows;
}
