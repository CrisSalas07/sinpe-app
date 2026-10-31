import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireString } from './common.js';

const PHONE_PATTERN = /^[0-9]{8}$/;

/** Returns the phone number if it has exactly 8 digits. */
export function validatePhoneNumber(value, field = 'number') {
  if (typeof value !== 'string' || !PHONE_PATTERN.test(value)) {
    throw new ValidationError('El número debe tener exactamente 8 dígitos', field);
  }
  return value;
}

/** "Registrar teléfono": owner identification + number. */
export function validateNewPhone(body) {
  assertOnlyFields(body, ['identification', 'number']);
  return {
    identification: requireString(body, 'identification', 20, 'El titular'),
    number: validatePhoneNumber(body.number),
  };
}

/** "Editar teléfono": the new owner's identification. */
export function validateOwnerChange(body) {
  assertOnlyFields(body, ['identification']);
  return { identification: requireString(body, 'identification', 20, 'El nuevo titular') };
}
