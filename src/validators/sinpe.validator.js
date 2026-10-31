import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireId } from './common.js';

/** "Afiliar a SINPE Móvil": phone + account ids. */
export function validateEnrollment(body) {
  assertOnlyFields(body, ['phoneId', 'accountId']);
  return {
    phoneId: requireId(body, 'phoneId', 'El teléfono'),
    accountId: requireId(body, 'accountId', 'La cuenta IBAN'),
  };
}

/** "Cambiar cuenta": the new account id. */
export function validateAccountChange(body) {
  assertOnlyFields(body, ['accountId']);
  return { accountId: requireId(body, 'accountId', 'La nueva cuenta') };
}

/** Path parameter :phoneId as a positive integer. */
export function validatePhoneIdParam(value) {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) {
    throw new ValidationError('El teléfono no es válido', 'phoneId');
  }
  return id;
}
