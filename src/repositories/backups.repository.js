import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

// Backup files, the schedule and the history live in a folder (BACKUP_DIR), not in the database:
// a restore replaces the database, and it must not bring back an old schedule or erase the history.

const SCHEDULE_FILE = 'programacion.json';
const HISTORY_FILE = 'historial.json';
const HISTORY_LIMIT = 100;

export const DEFAULT_SCHEDULE = {
  enabled: false,
  frequency: 'DIARIO',
  time: '02:00',
  weekday: 1,
  dayOfMonth: 1,
  // null until the administrator saves a schedule for the first time.
  updatedAt: null,
};

const inDir = (name) => path.join(env.backup.dir, name);

export async function ensureDir() {
  await mkdir(env.backup.dir, { recursive: true });
}

async function readJson(name, fallback) {
  try {
    return JSON.parse(await readFile(inDir(name), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

// Writes a copy and renames it, so a crash never leaves half a JSON file.
async function writeJson(name, data) {
  await ensureDir();
  const temp = inDir(`${name}.tmp`);
  await writeFile(temp, JSON.stringify(data, null, 2));
  await rename(temp, inDir(name));
}

export async function readSchedule() {
  return { ...DEFAULT_SCHEDULE, ...(await readJson(SCHEDULE_FILE, {})) };
}

export const saveSchedule = (schedule) => writeJson(SCHEDULE_FILE, schedule);

export const readHistory = () => readJson(HISTORY_FILE, []);

// Each addHistory waits for the previous one. Otherwise two that end at the same time (the automatic
// backup while the schedule is saved) read the same file and the second write erases the first entry.
let historyQueue = Promise.resolve();

/** Adds an entry at the top of the history and keeps the latest HISTORY_LIMIT. */
export function addHistory(entry) {
  const write = historyQueue.then(async () => {
    const history = await readHistory();
    await writeJson(HISTORY_FILE, [entry, ...history].slice(0, HISTORY_LIMIT));
  });
  // A failed write is reported to its caller, but must not block the ones after it.
  historyQueue = write.catch(() => {});
  return write;
}

/** The .sql files of the folder, newest first. */
export async function listFiles() {
  await ensureDir();
  const names = (await readdir(env.backup.dir)).filter((name) => name.endsWith('.sql'));
  const files = await Promise.all(
    names.map(async (name) => {
      const info = await stat(inDir(name));
      return { name, size: info.size, modifiedAt: info.mtime.toISOString() };
    }),
  );
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

/** Absolute path of a backup. `name` must already be validated (no folders, ends in .sql). */
export const filePath = (name) => inDir(name);

export async function fileExists(name) {
  try {
    return (await stat(inDir(name))).isFile();
  } catch {
    return false;
  }
}

/** Whole content of a backup, to check it before restoring it. */
export const readText = (name) => readFile(inDir(name), 'utf8');

/** Saves an uploaded file. 'wx' fails instead of replacing a file with the same name. */
export async function saveFile(name, content) {
  await ensureDir();
  await writeFile(inDir(name), content, { flag: 'wx' });
}
