import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireString } from './common.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._]{3,50}$/;
const RESERVED_USERNAME = 'admin';
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export const RESERVED_USERNAME_MESSAGE = 'Ese usuario está reservado';

function requirePassword(body) {
  const { password } = body;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      `La contraseña temporal debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      'password',
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(
      `La contraseña temporal no puede tener más de ${MAX_PASSWORD_LENGTH} caracteres`,
      'password',
    );
  }
  return password;
}

/** Validates the "Registrar cliente" form. Max lengths come from the schema. The password is not trimmed. */
export function validateNewClient(body) {
  assertOnlyFields(body, [
    'identification',
    'names',
    'firstSurname',
    'secondSurname',
    'email',
    'username',
    'password',
  ]);

  const client = {
    identification: requireString(body, 'identification', 20, 'La identificación'),
    names: requireString(body, 'names', 80, 'Los nombres'),
    firstSurname: requireString(body, 'firstSurname', 60, 'El primer apellido'),
    secondSurname: requireString(body, 'secondSurname', 60, 'El segundo apellido'),
    email: requireString(body, 'email', 120, 'El correo electrónico'),
    username: requireString(body, 'username', 50, 'El usuario'),
    password: requirePassword(body),
  };

  if (!EMAIL_PATTERN.test(client.email)) {
    throw new ValidationError('El correo electrónico no tiene un formato válido', 'email');
  }
  if (!USERNAME_PATTERN.test(client.username)) {
    throw new ValidationError(
      'El usuario debe tener entre 3 y 50 caracteres: minúsculas, números, punto o guion bajo',
      'username',
    );
  }
  if (client.username === RESERVED_USERNAME) {
    throw new ValidationError(RESERVED_USERNAME_MESSAGE, 'username');
  }
  return client;
}
