import * as clientsRepository from '../repositories/clients.repository.js';
import { ValidationError } from '../utils/errors.js';

// sp_registrar_cliente reports duplicates without naming the field; the form needs it to
// highlight the input (as in Figma). The message itself is shown unchanged.
const DUPLICATE_FIELDS = {
  'La identificación ya está registrada': 'identification',
  'El correo ya pertenece a otro cliente': 'email',
};

export const list = () => clientsRepository.findAll();

export const stats = () => clientsRepository.getStats();

/** Registers through the stored procedure and returns the client as stored in the database. */
export async function register(client) {
  try {
    await clientsRepository.create(client);
  } catch (err) {
    const field = err.sqlState === '45000' && DUPLICATE_FIELDS[err.sqlMessage];
    if (field) throw new ValidationError(err.sqlMessage, field);
    throw err;
  }
  return clientsRepository.findByIdentification(client.identification);
}
