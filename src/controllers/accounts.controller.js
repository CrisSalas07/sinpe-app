import * as accountsService from '../services/accounts.service.js';
import { validateNewAccount } from '../validators/accounts.validator.js';

export async function list(req, res) {
  res.json(await accountsService.list(req.session.user.entityId));
}

export async function stats(req, res) {
  res.json(await accountsService.stats(req.session.user.entityId));
}

export async function create(req, res) {
  const account = await accountsService.register(
    req.session.user.entityId,
    validateNewAccount(req.body),
  );
  res.status(201).json(account);
}
