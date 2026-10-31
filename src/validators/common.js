import { ValidationError } from '../utils/errors.js';

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
    throw new ValidationError(`${label} es requerido`, field);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${label} no puede tener más de ${maxLength} caracteres`, field);
  }
  return trimmed;
}
