import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireId, requireString } from './common.js';

const PHONE_PATTERN = /^[0-9]{8}$/;

/** Returns the phone number if it has exactly 8 digits. */
export function validatePhoneNumber(value, field = 'number') {
  if (typeof value !== 'string' || !PHONE_PATTERN.test(value)) {
    throw new ValidationError('El número debe tener exactamente 8 dígitos', field);
  }
  return value;
}

/** "Registrar teléfono": the owner is always the session client. */
export function validateNewPhone(body) {
  assertOnlyFields(body, ['number']);
  return { number: validatePhoneNumber(body.number) };
}

/** Admin "Registrar teléfono": owner chosen in a select (the procedure checks it is a client of the entity). */
export function validateAdminPhone(body) {
  assertOnlyFields(body, ['clientId', 'number']);
  return {
    clientId: requireId(body, 'clientId', 'El titular'),
    number: validatePhoneNumber(body.number),
  };
}

/** "Editar teléfono": the new owner's identification. */
export function validateOwnerChange(body) {
  assertOnlyFields(body, ['identification']);
  return { identification: requireString(body, 'identification', 20, 'El nuevo titular') };
}
