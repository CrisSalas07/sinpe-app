import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireId, requireString } from './common.js';

const MAX_PASSWORD_LENGTH = 128;

export const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos para la entidad seleccionada';

/** Returns { entityId, username, password } or throws ValidationError. The password is not trimmed. */
export function validateLogin(body) {
  assertOnlyFields(body, ['entityId', 'username', 'password']);
  const entityId = requireId(body, 'entityId', 'La entidad financiera');
  const username = requireString(body, 'username', 50, 'El usuario');

  const { password } = body;
  if (typeof password !== 'string' || password === '') {
    throw new ValidationError('La contraseña es requerida', 'password');
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(INVALID_CREDENTIALS, 'password');
  }

  return { entityId, username, password };
}
