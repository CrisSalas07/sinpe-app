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
};

export const list = (entityId) => accountsRepository.findAll(entityId);

export const stats = (entityId) => accountsRepository.getStats(entityId);

export const nextIban = (entityId) => accountsRepository.findNextIban(entityId);

/** Registers through the stored procedure and returns the account as stored in the database. */
export async function register(entityId, account) {
  try {
    await accountsRepository.create(entityId, account);
  } catch (err) {
    const field = err.sqlState === '45000' && SP_MESSAGE_FIELDS[err.sqlMessage];
    if (field) throw new ValidationError(err.sqlMessage, field);
    throw err;
  }
  return accountsRepository.findByIban(account.iban);
}
