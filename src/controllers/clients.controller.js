import * as clientsService from '../services/clients.service.js';
import { validateNewClient } from '../validators/clients.validator.js';

export async function list(req, res) {
  res.json(await clientsService.list(req.session.user.entityId));
}

export async function stats(req, res) {
  res.json(await clientsService.stats(req.session.user.entityId));
}

export async function create(req, res) {
  const client = await clientsService.register(
    req.session.user.entityId,
    validateNewClient(req.body),
  );
  res.status(201).json(client);
}
