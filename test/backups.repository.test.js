import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

// The repository reads env.js, which requires these values; the history goes to a temporary folder.
const dir = await mkdtemp(path.join(os.tmpdir(), 'sinpe-history-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'sinpe_movil',
  SESSION_SECRET: 'x'.repeat(32),
  APP_USER: 'admin',
  APP_PASSWORD_HASH: 'hash',
  BACKUP_DIR: dir,
});
const { addHistory, readHistory } = await import('../src/repositories/backups.repository.js');

after(() => rm(dir, { recursive: true, force: true }));

test('history entries written at the same time are all kept', async () => {
  await Promise.all([1, 2, 3, 4, 5].map((n) => addHistory({ n })));
  const history = await readHistory();
  assert.deepEqual(history.map((entry) => entry.n).sort(), [1, 2, 3, 4, 5]);
});
