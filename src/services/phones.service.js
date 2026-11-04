import * as phonesRepository from '../repositories/phones.repository.js';
import { ValidationError } from '../utils/errors.js';

// Stored procedure / trigger messages that belong to one form field, so the form can highlight it.
// The message itself is shown unchanged.
const SP_MESSAGE_FIELDS = {
  'El cliente no esta registrado': 'identification',
  'Este cliente esta inactivo': 'identification',
  'El numero tiene que ser 8 digitos': 'number',
  'Este numero ya esta registrado': 'number',
  'El nuevo titular no está registrado': 'identification',
  'El nuevo titular no pertenece a esta entidad': 'identification',
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

export const stats = (entityId) => phonesRepository.getStats(entityId);

export async function register(clientId, number) {
  await withFieldErrors(() => phonesRepository.create(clientId, number));
}

export async function changeOwner(entityId, number, identification) {
  await withFieldErrors(() => phonesRepository.changeOwner(entityId, number, identification));
}
