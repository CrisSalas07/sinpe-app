import * as clientsService from '../services/clients.service.js';
import { validateNewClient } from '../validators/clients.validator.js';

export async function list(req, res) {
  res.json(await clientsService.list());
}

export async function stats(req, res) {
  res.json(await clientsService.stats());
}

export async function create(req, res) {
  const client = await clientsService.register(validateNewClient(req.body));
  res.status(201).json(client);
}
