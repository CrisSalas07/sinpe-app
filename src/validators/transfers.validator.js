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

/** Transfer by phone: origin IBAN, destination number, amount (string) and optional detail. */
export function validateSinpeTransfer(body) {
  assertOnlyFields(body, ['originIban', 'destinationNumber', 'amount', 'detail']);
  return {
    originIban: requireIban(body, 'originIban', 'La cuenta de origen'),
    destinationNumber: validatePhoneNumber(body.destinationNumber, 'destinationNumber'),
    amount: requireMoney(body, 'amount', 'El monto'),
    detail: optionalString(body, 'detail', DETAIL_MAX, 'El detalle'),
  };
}

/**
 * Transfer by IBAN: origin and destination IBANs, amount (string), optional detail and the
 * beneficiary's identification (the procedure requires it when the destination is another entity).
 */
export function validateIbanTransfer(body) {
  assertOnlyFields(body, [
    'originIban',
    'destinationIban',
    'amount',
    'detail',
    'destinationIdentification',
  ]);
  return {
    originIban: requireIban(body, 'originIban', 'La cuenta de origen'),
    destinationIban: requireIban(body, 'destinationIban', 'El IBAN de destino'),
    amount: requireMoney(body, 'amount', 'El monto'),
    detail: optionalString(body, 'detail', DETAIL_MAX, 'El detalle'),
    destinationIdentification: optionalString(
      body,
      'destinationIdentification',
      20,
      'La identificación del destinatario',
    ),
  };
}

/** ?number= or ?iban=, exactly one. Errors name the form field they belong to. */
export function validateRecipientQuery(query) {
  assertOnlyFields(query, ['number', 'iban']);
  if (query.iban !== undefined && query.number === undefined) {
    const body = { destinationIban: query.iban };
    return { iban: requireIban(body, 'destinationIban', 'El IBAN de destino') };
  }
  if (query.iban !== undefined) {
    throw new ValidationError('Indique el teléfono o el IBAN, no ambos', 'number');
  }
  return { number: validatePhoneNumber(query.number, 'destinationNumber') };
}

/** ?iban= of the origin account. */
export function validateLimitQuery(query) {
  assertOnlyFields(query, ['iban']);
  return requireIban({ originIban: query.iban }, 'originIban', 'La cuenta de origen');
}
