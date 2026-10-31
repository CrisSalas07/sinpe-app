import * as phonesService from '../services/phones.service.js';
import {
  validateNewPhone,
  validateOwnerChange,
  validatePhoneNumber,
} from '../validators/phones.validator.js';

export async function list(req, res) {
  res.json(await phonesService.list());
}

export async function stats(req, res) {
  res.json(await phonesService.stats());
}

export async function create(req, res) {
  await phonesService.register(validateNewPhone(req.body));
  res.status(201).end();
}

export async function changeOwner(req, res) {
  const number = validatePhoneNumber(req.params.number);
  const { identification } = validateOwnerChange(req.body);
  await phonesService.changeOwner(number, identification);
  res.status(204).end();
}
