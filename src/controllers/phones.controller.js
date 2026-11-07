import * as phonesService from '../services/phones.service.js';
import {
  validateAdminPhone,
  validateOwnerChange,
  validatePhoneNumber,
} from '../validators/phones.validator.js';

export async function list(req, res) {
  res.json(await phonesService.list(req.session.user.entityId));
}

export async function options(req, res) {
  res.json(await phonesService.options(req.session.user.entityId));
}

export async function stats(req, res) {
  res.json(await phonesService.stats(req.session.user.entityId));
}

export async function create(req, res) {
  const { clientId, number } = validateAdminPhone(req.body);
  await phonesService.register(req.session.user.entityId, clientId, number);
  res.status(201).end();
}

export async function changeOwner(req, res) {
  const number = validatePhoneNumber(req.params.number);
  const { identification } = validateOwnerChange(req.body);
  await phonesService.changeOwner(req.session.user.entityId, number, identification);
  res.status(204).end();
}
