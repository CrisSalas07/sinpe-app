import * as catalogsService from '../services/catalogs.service.js';

export async function banks(req, res) {
  res.json(await catalogsService.banks());
}

export async function currencies(req, res) {
  res.json(await catalogsService.currencies());
}
