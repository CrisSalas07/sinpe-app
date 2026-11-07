import * as accountsRepository from '../repositories/accounts.repository.js';
import { ValidationError } from '../utils/errors.js';

// sp_registrar_cuenta messages that belong to one form field, so the form can highlight it.
// The message itself is shown unchanged.
const SP_MESSAGE_FIELDS = {
  'El IBAN ya está registrado': 'iban',
  'El cliente no existe': 'clientId',
  'El cliente está inactivo': 'clientId',
  'El cliente no pertenece a esta entidad': 'clientId',
  'El IBAN no corresponde a esta entidad': 'iban',
  'La moneda no existe en el catálogo': 'currency',
  // sp_cambiar_estado_cuenta
  'La cuenta ya está en ese estado': 'status',
  'La cuenta debe tener saldo cero para inactivarse': 'status',
  'El estado no es válido': 'status',
};

/** Maps a procedure message to its form field, so the form can highlight it. */
async function withFieldErrors(call) {
  try {
    return await call();
  } catch (err) {
    const field = err.sqlState === '45000' && SP_MESSAGE_FIELDS[err.sqlMessage];
    if (field) throw new ValidationError(err.sqlMessage, field);
    throw err;
  }
}

export const list = (entityId) => accountsRepository.findAll(entityId);

export const stats = (entityId) => accountsRepository.getStats(entityId);

export const nextIban = (entityId) => accountsRepository.findNextIban(entityId);

/** Registers through the stored procedure and returns the account as stored in the database. */
export async function register(entityId, account) {
  await withFieldErrors(() => accountsRepository.create(entityId, account));
  return accountsRepository.findByIban(account.iban);
}

/**
 * Only the account is restricted: an account that is not ACTIVA neither sends nor receives, and its
 * SINPE Móvil enrollments are kept. Returns the account as stored after the change.
 */
export async function changeStatus(entityId, iban, status) {
  await withFieldErrors(() => accountsRepository.changeStatus(entityId, iban, status));
  return accountsRepository.findByIban(iban);
}
