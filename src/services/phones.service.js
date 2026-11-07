import * as phonesRepository from '../repositories/phones.repository.js';
import { ValidationError } from '../utils/errors.js';

// Stored procedure / trigger messages that belong to one form field, so the form can highlight it.
// The message itself is shown unchanged.
const SP_MESSAGE_FIELDS = {
  'El cliente no está registrado': 'identification',
  'Este cliente está inactivo': 'identification',
  'El número tiene que ser 8 dígitos': 'number',
  'Este número ya está registrado': 'number',
  'El nuevo titular no está registrado': 'identification',
  'El nuevo titular no pertenece a esta entidad': 'identification',
  'El teléfono no está registrado': 'number',
  'El teléfono no pertenece a un cliente de esta entidad': 'number',
  'No se puede cambiar el titular de un teléfono afiliado': 'identification',
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

export const list = (entityId) => phonesRepository.findAll(entityId);

export const options = (entityId) => phonesRepository.findOptions(entityId);

export const stats = (entityId) => phonesRepository.getStats(entityId);

export async function register(clientId, number) {
  await withFieldErrors(() => phonesRepository.create(clientId, number));
}

export async function changeOwner(entityId, number, identification) {
  await withFieldErrors(() => phonesRepository.changeOwner(entityId, number, identification));
}
