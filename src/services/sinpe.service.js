import * as sinpeRepository from '../repositories/sinpe.repository.js';
import { ValidationError } from '../utils/errors.js';

// Stored procedure / trigger messages that belong to one form field, so the form can highlight it.
// The message itself is shown unchanged.
const SP_MESSAGE_FIELDS = {
  'El teléfono no existe': 'phoneId',
  'El teléfono no pertenece a un cliente de esta entidad': 'phoneId',
  'El teléfono ya está afiliado en esta entidad. Use Cambiar cuenta.': 'phoneId',
  'La cuenta no pertenece a esta entidad': 'accountId',
  'La cuenta no existe': 'accountId',
  'La cuenta no está activa': 'accountId',
  'La cuenta no es en colones': 'accountId',
  'El teléfono y la cuenta son de clientes distintos': 'accountId',
  'El teléfono ya está afiliado a esa cuenta': 'accountId',
};

// This message names the other entity, so it cannot be a key of the map above.
const ENROLLED_ELSEWHERE = 'El teléfono ya está afiliado en otra entidad';

function fieldOf(message) {
  return message.startsWith(ENROLLED_ELSEWHERE) ? 'phoneId' : SP_MESSAGE_FIELDS[message];
}

async function withFieldErrors(call) {
  try {
    await call();
  } catch (err) {
    const field = err.sqlState === '45000' && fieldOf(err.sqlMessage);
    if (field) throw new ValidationError(err.sqlMessage, field);
    throw err;
  }
}

export const list = (entityId) => sinpeRepository.findAll(entityId);

export const stats = (entityId) => sinpeRepository.getStats(entityId);

export const enroll = (entityId, phoneId, accountId) =>
  withFieldErrors(() => sinpeRepository.enroll(entityId, phoneId, accountId));

export const unenroll = (entityId, number) => sinpeRepository.unenroll(entityId, number);

// sp_cambiar_cuenta_sinpe deletes and re-inserts in one transaction: on error the original stays.
export const changeAccount = (entityId, phoneId, accountId) =>
  withFieldErrors(() => sinpeRepository.changeAccount(entityId, phoneId, accountId));
