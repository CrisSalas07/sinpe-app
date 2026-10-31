import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireString } from './common.js';

const STATUSES = ['ACTIVO', 'INACTIVO'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates the "Registrar cliente" form. Max lengths come from the cliente table. */
export function validateNewClient(body) {
  assertOnlyFields(body, [
    'identification',
    'names',
    'firstSurname',
    'secondSurname',
    'email',
    'status',
  ]);

  const client = {
    identification: requireString(body, 'identification', 20, 'La identificación'),
    names: requireString(body, 'names', 80, 'Los nombres'),
    firstSurname: requireString(body, 'firstSurname', 60, 'El primer apellido'),
    secondSurname: requireString(body, 'secondSurname', 60, 'El segundo apellido'),
    email: requireString(body, 'email', 120, 'El correo electrónico'),
    status: requireString(body, 'status', 10, 'El estado'),
  };

  if (!EMAIL_PATTERN.test(client.email)) {
    throw new ValidationError('El correo electrónico no tiene un formato válido', 'email');
  }
  if (!STATUSES.includes(client.status)) {
    throw new ValidationError('El estado debe ser ACTIVO o INACTIVO', 'status');
  }
  return client;
}
