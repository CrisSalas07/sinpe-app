import * as catalogsRepository from '../repositories/catalogs.repository.js';

export const banks = () => catalogsRepository.findBanks();

export const currencies = () => catalogsRepository.findCurrencies();
