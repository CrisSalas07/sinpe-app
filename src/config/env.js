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
};
