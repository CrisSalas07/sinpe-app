import { env } from '../config/env.js';
import * as clientsRepository from '../repositories/clients.repository.js';
import { ValidationError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { RESERVED_USERNAME_MESSAGE } from '../validators/clients.validator.js';

// sp_registrar_cliente reports errors without naming the field; the form needs it to
// highlight the input (as in Figma). The message itself is shown unchanged.
const SP_MESSAGE_FIELDS = {
  'El cliente ya esta registrado en esta entidad': 'identification',
  'El correo ya pertenece a otro cliente': 'email',
  'El usuario ya esta en uso en esta entidad': 'username',
};

export const list = (entityId) => clientsRepository.findAll(entityId);

export const stats = (entityId) => clientsRepository.getStats(entityId);

/** Registers through the stored procedure, which only receives the password hash. */
export async function register(entityId, { password, ...client }) {
  // The validator cannot read env: login checks APP_USER first, so a client with it could never log in.
  if (client.username === env.appUser) {
    throw new ValidationError(RESERVED_USERNAME_MESSAGE, 'username');
  }

  try {
    await clientsRepository.create(entityId, client, await hashPassword(password));
  } catch (err) {
    const field = err.sqlState === '45000' && SP_MESSAGE_FIELDS[err.sqlMessage];
    if (field) throw new ValidationError(err.sqlMessage, field);
    throw err;
  }
  return clientsRepository.findByIdentification(entityId, client.identification);
}
