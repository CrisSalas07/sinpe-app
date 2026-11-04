import { ValidationError } from '../utils/errors.js';
import { assertOnlyFields, requireDate, requireId, requireMoney, requireString } from './common.js';

const IBAN_PATTERN = /^CR[0-9]{20}$/;

/** Validates the "Registrar cuenta IBAN" form. The currency is checked against the catalog by the SP. */
export function validateNewAccount(body) {
  assertOnlyFields(body, ['clientId', 'currency', 'iban', 'balance', 'openedAt']);

  const account = {
    clientId: requireId(body, 'clientId', 'El titular'),
    currency: requireString(body, 'currency', 3, 'La moneda'),
    iban: requireString(body, 'iban', 22, 'El IBAN').toUpperCase(),
    // Initial balance may be 0 ("No se permiten saldos negativos").
    balance: requireMoney(body, 'balance', 'El saldo inicial', { allowZero: true }),
    openedAt: requireDate(body, 'openedAt', 'La fecha de apertura'),
  };

  if (!IBAN_PATTERN.test(account.iban)) {
    throw new ValidationError('El IBAN debe ser CR seguido de 20 dígitos', 'iban');
  }
  return account;
}
