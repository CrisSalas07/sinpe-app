import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireDate, requireString } from './common.js';
import { validatePhoneNumber } from './phones.validator.js';

const IBAN_PATTERN = /^CR[0-9]{20}$/;

function requireIban(query) {
  const iban = requireString(query, 'iban', 22, 'La cuenta').toUpperCase();
  if (!IBAN_PATTERN.test(iban)) {
    throw new ValidationError('La cuenta debe ser CR seguido de 20 dígitos', 'iban');
  }
  return iban;
}

/** ?iban=&from=&to= ; the procedure checks that from <= to. */
export function validateMovementsQuery(query) {
  assertOnlyFields(query, ['iban', 'from', 'to']);
  return {
    iban: requireIban(query),
    from: requireDate(query, 'from', 'La fecha Desde'),
    to: requireDate(query, 'to', 'La fecha Hasta'),
  };
}

/** ?number= */
export function validateEnrollmentHistoryQuery(query) {
  assertOnlyFields(query, ['number']);
  return validatePhoneNumber(query.number);
}

/** ?iban= */
export function validateAccountPhonesQuery(query) {
  assertOnlyFields(query, ['iban']);
  return requireIban(query);
}
