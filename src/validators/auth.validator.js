import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireString } from './common.js';

const MAX_PASSWORD_LENGTH = 128;

/** Returns { username, password } or throws ValidationError. The password is not trimmed. */
export function validateLogin(body) {
  assertOnlyFields(body, ['username', 'password']);
  const username = requireString(body, 'username', 50, 'El usuario');

  const { password } = body;
  if (typeof password !== 'string' || password === '') {
    throw new ValidationError('La contraseña es requerida', 'password');
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError('Usuario o contraseña incorrectos', 'password');
  }

  return { username, password };
}
