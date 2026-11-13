import path from 'node:path';

// Reads and validates required environment variables once, at startup (fail fast).
const REQUIRED = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'SESSION_SECRET',
  'APP_USER',
  'APP_PASSWORD_HASH',
];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in every value.');
  process.exit(1);
}

if (process.env.SESSION_SECRET.length < 32) {
  console.error('SESSION_SECRET must be at least 32 characters long.');
  process.exit(1);
}

export const env = {
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  sessionSecret: process.env.SESSION_SECRET,
  appUser: process.env.APP_USER,
  appPasswordHash: process.env.APP_PASSWORD_HASH,
  // Backup module (optional). sinpe_app only has SELECT and EXECUTE, so mysqldump and the restore
  // run with their own MySQL account (root or one with every privilege on the database).
  backup: {
    user: process.env.BACKUP_DB_USER ?? '',
    password: process.env.BACKUP_DB_PASSWORD ?? '',
    // Folder with mysqldump.exe and mysql.exe; empty means they are on the PATH.
    binDir: process.env.MYSQL_BIN_DIR ?? '',
    dir: path.resolve(process.env.BACKUP_DIR || 'respaldos'),
  },
};
