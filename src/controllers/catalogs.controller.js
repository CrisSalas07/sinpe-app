import * as catalogsService from '../services/catalogs.service.js';

export async function currencies(req, res) {
  res.json(await catalogsService.currencies());
}
