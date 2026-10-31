import { ValidationError } from '../utils/errors.js';

// "Falta el correo electrónico" / "Faltan los nombres": agrees with any article.
const missing = (label) => `${/^l[oa]s /i.test(label) ? 'Faltan' : 'Falta'} ${label.toLowerCase()}`;

/** Throws if the body is not a plain object or has fields outside `allowed`. */
export function assertOnlyFields(body, allowed) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('El cuerpo de la solicitud no es válido');
  }
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) {
    throw new ValidationError(`Campo no permitido: ${unknown}`, unknown);
  }
}

/** Returns the trimmed string at body[field], or throws if missing or too long. */
export function requireString(body, field, maxLength, label = field) {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(missing(label), field);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${label} no puede tener más de ${maxLength} caracteres`, field);
  }
  return trimmed;
}

/** Returns body[field] if it is a positive integer (ids from selects). */
export function requireId(body, field, label = field) {
  const value = body[field];
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(missing(label), field);
  }
  return value;
}

const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

/**
 * Returns body[field] as a money string ("50000" or "50000.5"). Money is never a JS number.
 * allowZero: initial balances may be 0; transfer amounts must be greater than 0.
 */
export function requireMoney(body, field, label = field, { allowZero = false } = {}) {
  const value = body[field];
  if (typeof value !== 'string' || !MONEY_PATTERN.test(value)) {
    throw new ValidationError(`${label} debe ser un número positivo con hasta 2 decimales`, field);
  }
  if (!allowZero && /^[0.]+$/.test(value)) {
    throw new ValidationError(`${label} debe ser mayor que 0`, field);
  }
  return value;
}

/** Returns body[field] if it is a real calendar date in YYYY-MM-DD format. */
export function requireDate(body, field, label = field) {
  const value = body[field];
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`);
  // Invalid months give NaN; impossible days (02-30) roll over to another date.
  const valid = parsed && !isNaN(parsed) && parsed.toISOString().startsWith(value);
  if (!valid) throw new ValidationError(`${label} debe ser una fecha válida (AAAA-MM-DD)`, field);
  return value;
}

/** Returns body[field] if it is one of `allowed`. */
export function requireEnum(body, field, allowed, label = field) {
  const value = body[field];
  if (!allowed.includes(value)) {
    throw new ValidationError(`${label} debe ser ${allowed.join(', ')}`, field);
  }
  return value;
}

/** Returns the trimmed string at body[field], or null when it is missing or empty. */
export function optionalString(body, field, maxLength, label = field) {
  const value = body[field];
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  return requireString(body, field, maxLength, label);
}
