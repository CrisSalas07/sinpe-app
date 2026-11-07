import * as meRepository from '../repositories/me.repository.js';
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

export const registerPhone = ({ entityId, clientId }, number) =>
  phonesService.register(entityId, clientId, number);
