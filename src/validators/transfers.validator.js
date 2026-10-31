import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, optionalString, requireMoney, requireString } from './common.js';
import { validatePhoneNumber } from './phones.validator.js';

const IBAN_PATTERN = /^CR[0-9]{20}$/;
const DETAIL_MAX = 100;

function requireIban(body, field, label) {
  const iban = requireString(body, field, 22, label).toUpperCase();
  if (!IBAN_PATTERN.test(iban)) {
    throw new ValidationError(`${label} debe ser CR seguido de 20 dígitos`, field);
  }
  return iban;
}

/** Transfer by phone: origin and destination numbers, amount (string) and optional detail. */
export function validateSinpeTransfer(body) {
  assertOnlyFields(body, ['originNumber', 'destinationNumber', 'amount', 'detail']);
  return {
    originNumber: validatePhoneNumber(body.originNumber, 'originNumber'),
    destinationNumber: validatePhoneNumber(body.destinationNumber, 'destinationNumber'),
    amount: requireMoney(body, 'amount', 'El monto'),
    detail: optionalString(body, 'detail', DETAIL_MAX, 'El detalle'),
  };
}

/** Transfer by IBAN: origin and destination IBANs, amount (string) and optional detail. */
export function validateIbanTransfer(body) {
  assertOnlyFields(body, ['originIban', 'destinationIban', 'amount', 'detail']);
  return {
    originIban: requireIban(body, 'originIban', 'El IBAN de origen'),
    destinationIban: requireIban(body, 'destinationIban', 'El IBAN de destino'),
    amount: requireMoney(body, 'amount', 'El monto'),
    detail: optionalString(body, 'detail', DETAIL_MAX, 'El detalle'),
  };
}
