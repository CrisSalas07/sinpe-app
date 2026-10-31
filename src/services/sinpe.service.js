import * as sinpeRepository from '../repositories/sinpe.repository.js';
import { ValidationError } from '../utils/errors.js';

// Stored procedure / trigger messages that belong to one form field, so the form can highlight it.
// The message itself is shown unchanged.
const SP_MESSAGE_FIELDS = {
  'El telefono no existe': 'phoneId',
  'El telefono ya esta afiliado': 'phoneId',
  'La cuenta no existe': 'accountId',
  'La cuenta no esta activa': 'accountId',
  'La cuenta no es en colones': 'accountId',
  'El telefono y la cuenta son de clientes distintos': 'accountId',
  'El telefono ya esta afiliado a esa cuenta': 'accountId',
};

async function withFieldErrors(call) {
  try {
    await call();
  } catch (err) {
    const field = err.sqlState === '45000' && SP_MESSAGE_FIELDS[err.sqlMessage];
    if (field) throw new ValidationError(err.sqlMessage, field);
    throw err;
  }
}

export const list = () => sinpeRepository.findAll();

export const stats = () => sinpeRepository.getStats();

export const enroll = (phoneId, accountId) =>
  withFieldErrors(() => sinpeRepository.enroll(phoneId, accountId));

export const unenroll = (number) => sinpeRepository.unenroll(number);

// sp_cambiar_cuenta_sinpe deletes and re-inserts in one transaction: on error the original stays.
export const changeAccount = (phoneId, accountId) =>
  withFieldErrors(() => sinpeRepository.changeAccount(phoneId, accountId));
