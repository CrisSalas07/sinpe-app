import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { env } from '../config/env.js';
import { stripDefiners } from './sqlDump.js';

// Runs the MySQL command-line clients (mysqldump.exe and mysql.exe), the same tools as in exercise 2.
// They are started without a shell and with an argument list, so no value can inject commands.

const EXE = process.platform === 'win32' ? '.exe' : '';
const MAX_STDERR = 4000;

// Same options as the console backup of exercise 2.
const DUMP_OPTIONS = [
  '--single-transaction',
  '--no-tablespaces',
  '--routines',
  '--triggers',
  '--events',
  '--set-gtid-purged=OFF',
  '--default-character-set=utf8mb4',
];

/** Full path of a MySQL tool: MYSQL_BIN_DIR\mysqldump.exe, or just the name when it is on the PATH. */
function tool(name) {
  return env.backup.binDir ? path.join(env.backup.binDir, `${name}${EXE}`) : `${name}${EXE}`;
}

const quote = (value) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

/**
 * The password never goes on the command line (other users could read it from the process list):
 * it is written to a temporary option file that only this user can read, deleted afterwards.
 */
async function withOptionFile(work) {
  const file = path.join(os.tmpdir(), `sinpe-backup-${randomBytes(8).toString('hex')}.cnf`);
  const lines = [
    '[client]',
    `user=${quote(env.backup.user)}`,
    `password=${quote(env.backup.password)}`,
    `host=${quote(env.db.host)}`,
    `port=${env.db.port}`,
  ];
  await writeFile(file, `${lines.join('\n')}\n`, { mode: 0o600 });
  try {
    // --defaults-file (first option) reads only this file: with --defaults-extra-file, a user file
    // read after it (~/.my.cnf on Linux and macOS) could replace BACKUP_DB_USER.
    return await work(`--defaults-file=${file}`);
  } finally {
    await rm(file, { force: true });
  }
}

// MySQL reads the login-path file (.mylogin.cnf, from mysql_config_editor) after every other option
// file, so a saved root login would replace BACKUP_DB_USER. Pointing it to a file that does not
// exist turns it off, and only the account of the .env is used.
const NO_LOGIN_PATH = {
  ...process.env,
  MYSQL_TEST_LOGIN_FILE: path.join(os.tmpdir(), `sinpe-no-login-${randomBytes(8).toString('hex')}`),
};

/** Starts a tool and resolves when it ends with exit code 0; otherwise rejects with its stderr. */
function run(command, args, stdinFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, env: NO_LOGIN_PATH });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      if (stderr.length < MAX_STDERR) stderr += chunk;
    });
    child.on('error', (err) => {
      reject(
        err.code === 'ENOENT'
          ? new Error(`No se encontró ${path.basename(command)}. Revise MYSQL_BIN_DIR en el .env.`)
          : err,
      );
    });
    child.on('close', (code) => {
      if (code === 0) return resolve();
      // Lines marked [Warning] are not the reason it failed: only the real errors are kept.
      const message = stderr
        .split(/\r?\n/)
        .filter((line) => line.trim() && !/\[Warning\]/i.test(line))
        .join(' ')
        .trim();
      reject(new Error(message || `${path.basename(command)} terminó con código ${code}`));
    });

    if (stdinFile) {
      const input = createReadStream(stdinFile);
      input.on('error', (err) => {
        child.kill();
        reject(err);
      });
      // mysql closes its input when it fails; that EPIPE is reported by 'close' with the real error.
      child.stdin.on('error', () => {});
      input.pipe(child.stdin);
    } else {
      child.stdin.end();
    }
  });
}

/** mysqldump of the whole database (structure, data, procedures, triggers, events) into `file`. */
export function dumpDatabase(file) {
  return withOptionFile((options) =>
    run(tool('mysqldump'), [options, ...DUMP_OPTIONS, `--result-file=${file}`, env.db.database]),
  );
}

/**
 * Runs every statement of a backup file against the database (mysql -u … database < file).
 * It runs a temporary copy without DEFINER=…: the backup account cannot create objects in another
 * account's name, so each procedure and trigger becomes its own.
 */
export async function restoreDatabase(file) {
  const copy = path.join(os.tmpdir(), `sinpe-restore-${randomBytes(8).toString('hex')}.sql`);
  await writeFile(copy, stripDefiners(await readFile(file, 'utf8')), { mode: 0o600 });
  try {
    await withOptionFile((options) =>
      // --comments: by default mysql drops the -- comments inside procedure and trigger bodies.
      run(
        tool('mysql'),
        [options, '--comments', '--default-character-set=utf8mb4', env.db.database],
        copy,
      ),
    );
  } finally {
    await rm(copy, { force: true });
  }
}
