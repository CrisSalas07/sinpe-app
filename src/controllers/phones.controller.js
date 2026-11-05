import * as phonesService from '../services/phones.service.js';
import { validateOwnerChange, validatePhoneNumber } from '../validators/phones.validator.js';

export async function list(req, res) {
  res.json(await phonesService.list(req.session.user.entityId));
}

export async function options(req, res) {
  res.json(await phonesService.options(req.session.user.entityId));
}

export async function stats(req, res) {
  res.json(await phonesService.stats(req.session.user.entityId));
}

export async function changeOwner(req, res) {
  const number = validatePhoneNumber(req.params.number);
  const { identification } = validateOwnerChange(req.body);
  await phonesService.changeOwner(req.session.user.entityId, number, identification);
  res.status(204).end();
}
