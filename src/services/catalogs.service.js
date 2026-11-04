import * as catalogsRepository from '../repositories/catalogs.repository.js';

export const currencies = () => catalogsRepository.findCurrencies();
