import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireId, requireString } from './common.js';
import { validatePhoneNumber } from './phones.validator.js';

const IBAN_PATTERN = /^CR[0-9]{20}$/;

/** Client "Afiliar a SINPE Móvil": one of their phone numbers and one of their IBANs. */
export function validateOwnEnrollment(body) {
  assertOnlyFields(body, ['number', 'iban']);
  const number = validatePhoneNumber(body.number);
  const iban = requireString(body, 'iban', 22, 'La cuenta').toUpperCase();
  if (!IBAN_PATTERN.test(iban)) {
    throw new ValidationError('La cuenta debe ser CR seguido de 20 dígitos', 'iban');
  }
  return { number, iban };
}

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
