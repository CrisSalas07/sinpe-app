import mysql from 'mysql2/promise';
import { env } from './env.js';

// DECIMAL columns arrive as strings (mysql2 default) so money is never a JS float.
// dateStrings avoids timezone shifts when reading DATE/DATETIME values.
export const pool = mysql.createPool({
  ...env.db,
  dateStrings: true,
});
