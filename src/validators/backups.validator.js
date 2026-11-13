import { FREQUENCIES } from '../services/backupScheduler.js';
import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields } from './common.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// Only a plain name inside the backup folder: no "/" or "\", so it can never point elsewhere.
const FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,115}\.sql$/;

function integerIn(body, field, min, max, message) {
  const value = body[field];
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(message, field);
  }
  return value;
}

/**
 * { enabled, frequency, time, weekday?, dayOfMonth? }. weekday (0 = domingo … 6 = sábado) is only
 * required for SEMANAL and dayOfMonth (1-31) for MENSUAL; otherwise their previous value is kept.
 */
export function validateSchedule(body, previous) {
  assertOnlyFields(body, ['enabled', 'frequency', 'time', 'weekday', 'dayOfMonth']);
  if (typeof body.enabled !== 'boolean') {
    throw new ValidationError('Indique si el respaldo automático está activo', 'enabled');
  }
  if (!FREQUENCIES.includes(body.frequency)) {
    throw new ValidationError('La frecuencia debe ser Diario, Semanal o Mensual', 'frequency');
  }
  if (typeof body.time !== 'string' || !TIME_PATTERN.test(body.time)) {
    throw new ValidationError('La hora debe tener el formato HH:MM (00:00 a 23:59)', 'time');
  }
  const weekday =
    body.frequency === 'SEMANAL'
      ? integerIn(body, 'weekday', 0, 6, 'Elija el día de la semana')
      : previous.weekday;
  const dayOfMonth =
    body.frequency === 'MENSUAL'
      ? integerIn(body, 'dayOfMonth', 1, 31, 'El día del mes debe estar entre 1 y 31')
      : previous.dayOfMonth;
  return { enabled: body.enabled, frequency: body.frequency, time: body.time, weekday, dayOfMonth };
}

/** Name of a file in the backup folder. */
export function validateFileName(name, field = 'file') {
  if (typeof name !== 'string' || !FILE_PATTERN.test(name)) {
    throw new ValidationError(
      'El archivo debe ser un .sql con letras, números, punto, guion o guion bajo',
      field,
    );
  }
  return name;
}

/** { file, confirm: true }. Restoring replaces the data, so the administrator must confirm it. */
export function validateRestore(body) {
  assertOnlyFields(body, ['file', 'confirm']);
  const file = validateFileName(body.file);
  if (body.confirm !== true) {
    throw new ValidationError('Confirme que desea reemplazar los datos actuales', 'confirm');
  }
  return file;
}

/** ?name= of an uploaded file. */
export function validateUploadQuery(query) {
  assertOnlyFields(query, ['name']);
  return validateFileName(query.name, 'name');
}
