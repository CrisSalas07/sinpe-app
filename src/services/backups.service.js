import { rm, stat } from 'node:fs/promises';
import { env } from '../config/env.js';
import * as backupsRepository from '../repositories/backups.repository.js';
import { BusinessError, NotFoundError } from '../utils/errors.js';
import { dumpDatabase, restoreDatabase } from '../utils/mysqlTools.js';
import { findForeignDatabase, isMysqlDump } from '../utils/sqlDump.js';
import { nextScheduledRun, startSchedule, stopSchedule } from './backupScheduler.js';

// Backup and restore module (Laboratorio Copia de Seguridad, exercise 3).

export const BACKUP_TYPES = {
  AUTOMATICO: 'AUTOMATICO',
  MANUAL: 'MANUAL',
  ANTES_DE_RESTAURAR: 'ANTES_DE_RESTAURAR',
};

const FILE_SUFFIX = {
  AUTOMATICO: 'automatico',
  MANUAL: 'manual',
  ANTES_DE_RESTAURAR: 'antes-de-restaurar',
};

const MAX_DETAIL = 500;

// Only one backup or restore at a time: a restore while mysqldump reads would mix two states.
let busy = null;

const isConfigured = () => env.backup.user !== '';

function assertConfigured() {
  if (!isConfigured()) {
    throw new BusinessError(
      'El módulo de respaldos no está configurado: falta BACKUP_DB_USER en el archivo .env',
    );
  }
}

async function exclusive(operation, work) {
  if (busy) {
    throw new BusinessError(`Hay ${busy} en curso. Espere a que termine.`);
  }
  busy = operation;
  try {
    return await work();
  } finally {
    busy = null;
  }
}

const pad = (n) => String(n).padStart(2, '0');

/** "2026-11-13_02-00-00" in the server's local time. */
function stamp(date) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

const shorten = (message) => message.slice(0, MAX_DETAIL);

/** Runs mysqldump into a new file and records the result. The caller holds the lock. */
async function createBackup(type) {
  assertConfigured();
  await backupsRepository.ensureDir();
  const startedAt = new Date();
  const base = `${env.db.database}_${stamp(startedAt)}_${FILE_SUFFIX[type]}`;
  let name = `${base}.sql`;
  // Two backups in the same second must not overwrite each other.
  for (let n = 2; await backupsRepository.fileExists(name); n += 1) name = `${base}-${n}.sql`;
  const file = backupsRepository.filePath(name);

  try {
    await dumpDatabase(file);
  } catch (err) {
    await rm(file, { force: true });
    await backupsRepository.addHistory({
      date: startedAt.toISOString(),
      operation: 'RESPALDO',
      type,
      file: name,
      ok: false,
      detail: shorten(err.message),
    });
    throw new BusinessError(`No se pudo crear el respaldo: ${shorten(err.message)}`);
  }

  const { size } = await stat(file);
  await backupsRepository.addHistory({
    date: startedAt.toISOString(),
    operation: 'RESPALDO',
    type,
    file: name,
    ok: true,
    size,
    durationMs: Date.now() - startedAt.getTime(),
  });
  return { name, size };
}

/** Backup started by the timer. Errors are recorded in the history, never thrown. */
async function runAutomaticBackup() {
  if (busy) {
    await backupsRepository.addHistory({
      date: new Date().toISOString(),
      operation: 'RESPALDO',
      type: BACKUP_TYPES.AUTOMATICO,
      file: null,
      ok: false,
      detail: `Se omitió porque había ${busy} en curso`,
    });
    return;
  }
  try {
    await exclusive('un respaldo', () => createBackup(BACKUP_TYPES.AUTOMATICO));
  } catch (err) {
    console.error('[respaldo automático]', err.message);
  }
}

/** Called once when the server starts: re-activates the saved schedule. */
export async function initBackups() {
  const schedule = await backupsRepository.readSchedule();
  if (!schedule.enabled) return;
  if (!isConfigured()) {
    console.warn(
      'Respaldo automático activo pero falta BACKUP_DB_USER en el .env; no se programó.',
    );
    return;
  }
  startSchedule(schedule, runAutomaticBackup);
  console.log(`Próximo respaldo automático: ${nextScheduledRun().toLocaleString('es-CR')}`);
}

export async function status() {
  const [schedule, files, history] = await Promise.all([
    backupsRepository.readSchedule(),
    backupsRepository.listFiles(),
    backupsRepository.readHistory(),
  ]);
  return {
    configured: isConfigured(),
    database: env.db.database,
    folder: env.backup.dir,
    busy,
    schedule,
    nextRun: nextScheduledRun()?.toISOString() ?? null,
    files,
    history,
  };
}

export const currentSchedule = () => backupsRepository.readSchedule();

/** Saves the schedule and activates it right away (or stops it when enabled is false). */
export async function updateSchedule(schedule) {
  if (schedule.enabled) assertConfigured();
  await backupsRepository.saveSchedule({ ...schedule, updatedAt: new Date().toISOString() });
  if (schedule.enabled) startSchedule(schedule, runAutomaticBackup);
  else stopSchedule();
  await backupsRepository.addHistory({
    date: new Date().toISOString(),
    operation: 'PROGRAMACION',
    type: null,
    file: null,
    ok: true,
    detail: schedule.enabled ? 'Respaldo automático activado' : 'Respaldo automático desactivado',
  });
  return status();
}

/** "Respaldar ahora". */
export function backupNow() {
  return exclusive('un respaldo', () => createBackup(BACKUP_TYPES.MANUAL));
}

/** Throws unless `sql` is a MySQL dump that only touches the app's database. */
function assertDumpOfThisDatabase(sql) {
  if (!isMysqlDump(sql)) {
    throw new BusinessError('El archivo no es un respaldo de MySQL (mysqldump o Workbench)');
  }
  const foreign = findForeignDatabase(sql, env.db.database);
  if (foreign) {
    throw new BusinessError(
      `La línea ${foreign.line} del archivo cambia a la base ${foreign.name}, no a ${env.db.database}. ` +
        'Quite esa línea o exporte sin "Include Create Schema".',
    );
  }
}

/** Checks that a file in the folder exists and is a dump of this database. */
async function assertRestorable(name) {
  if (!(await backupsRepository.fileExists(name))) {
    throw new NotFoundError('El archivo de respaldo no existe');
  }
  assertDumpOfThisDatabase(await backupsRepository.readText(name));
}

/**
 * Replaces the database with the content of a backup. A safety backup of the current data is made
 * first; if it fails, nothing is restored.
 */
export function restore(name) {
  assertConfigured();
  return exclusive('una restauración', async () => {
    await assertRestorable(name);
    const safety = await createBackup(BACKUP_TYPES.ANTES_DE_RESTAURAR);
    const startedAt = new Date();
    try {
      await restoreDatabase(backupsRepository.filePath(name));
    } catch (err) {
      await backupsRepository.addHistory({
        date: startedAt.toISOString(),
        operation: 'RESTAURACION',
        type: null,
        file: name,
        ok: false,
        detail: shorten(err.message),
      });
      throw new BusinessError(
        `No se pudo restaurar: ${shorten(err.message)}. Los datos anteriores quedaron en ${safety.name}.`,
      );
    }
    await backupsRepository.addHistory({
      date: startedAt.toISOString(),
      operation: 'RESTAURACION',
      type: null,
      file: name,
      ok: true,
      durationMs: Date.now() - startedAt.getTime(),
      detail: `Respaldo previo: ${safety.name}`,
    });
    return { file: name, safetyBackup: safety.name };
  });
}

/** Saves a .sql chosen on the administrator's computer, so it can be restored. */
export async function upload(name, content) {
  if (!Buffer.isBuffer(content) || content.length === 0) {
    throw new BusinessError('El archivo está vacío');
  }
  assertDumpOfThisDatabase(content.toString('utf8'));
  if (await backupsRepository.fileExists(name)) {
    throw new BusinessError('Ya existe un respaldo con ese nombre');
  }
  await backupsRepository.saveFile(name, content);
  return { name, size: content.length };
}

/** Absolute path of a backup, for downloading it. */
export async function downloadPath(name) {
  if (!(await backupsRepository.fileExists(name))) {
    throw new NotFoundError('El archivo de respaldo no existe');
  }
  return backupsRepository.filePath(name);
}
