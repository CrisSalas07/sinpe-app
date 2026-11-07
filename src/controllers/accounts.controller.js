import * as accountsService from '../services/accounts.service.js';
import { validateNewAccount, validateStatusChange } from '../validators/accounts.validator.js';

export async function list(req, res) {
  res.json(await accountsService.list(req.session.user.entityId));
}

export async function stats(req, res) {
  res.json(await accountsService.stats(req.session.user.entityId));
}

export async function nextIban(req, res) {
  res.json({ iban: await accountsService.nextIban(req.session.user.entityId) });
}

export async function create(req, res) {
  const account = await accountsService.register(
    req.session.user.entityId,
    validateNewAccount(req.body),
  );
  res.status(201).json(account);
}

export async function changeStatus(req, res) {
  const { iban, status } = validateStatusChange(req.params.iban, req.body);
  res.json(await accountsService.changeStatus(req.session.user.entityId, iban, status));
}
