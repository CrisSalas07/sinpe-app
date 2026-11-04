import * as meRepository from '../repositories/me.repository.js';
import * as phonesService from './phones.service.js';

const RECENT_MOVEMENTS = 5;

export const summary = ({ entityId, clientId }) => meRepository.findSummary(entityId, clientId);

export const accounts = ({ entityId, clientId }) => meRepository.findAccounts(entityId, clientId);

export const recentMovements = ({ entityId, clientId }) =>
  meRepository.findRecentMovements(entityId, clientId, RECENT_MOVEMENTS);

export const movements = ({ entityId, clientId }, query) =>
  meRepository.findMovements(entityId, clientId, query);

export const phones = ({ entityId, clientId }) => meRepository.findPhones(entityId, clientId);

export const registerPhone = ({ clientId }, number) => phonesService.register(clientId, number);
