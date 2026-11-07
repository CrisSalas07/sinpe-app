import * as meRepository from '../repositories/me.repository.js';
import { ValidationError } from '../utils/errors.js';
import { compactName } from '../utils/names.js';
import * as phonesService from './phones.service.js';

const RECENT_MOVEMENTS = 5;

export const summary = ({ entityId, clientId }) => meRepository.findSummary(entityId, clientId);

export const accounts = ({ entityId, clientId }) => meRepository.findAccounts(entityId, clientId);

// The counterpart is shown with the same compact name as the rest of the app ("Ana De La Cruz").
const withCounterpart = ({ counterpartNames, counterpartSurname, ...row }) => ({
  ...row,
  counterpart: compactName(counterpartNames, counterpartSurname),
});

export async function recentMovements({ entityId, clientId }) {
  const rows = await meRepository.findRecentMovements(entityId, clientId, RECENT_MOVEMENTS);
  return rows.map(withCounterpart);
}

export async function movements({ entityId, clientId }, query) {
  const result = await meRepository.findMovements(entityId, clientId, query);
  return { ...result, movements: result.movements.map(withCounterpart) };
}

export const phones = ({ entityId, clientId }) => meRepository.findPhones(entityId, clientId);

// The procedure's message speaks about "this client"; the client reads it about themselves.
const OWN_PHONE = 'El teléfono ya está registrado a este cliente';

export async function registerPhone({ entityId, clientId }, number) {
  try {
    await phonesService.register(entityId, clientId, number);
  } catch (err) {
    if (err instanceof ValidationError && err.message === OWN_PHONE) {
      throw new ValidationError('Ese número ya está registrado a su nombre.', err.field);
    }
    throw err;
  }
}
