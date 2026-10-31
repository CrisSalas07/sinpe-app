import * as sinpeService from '../services/sinpe.service.js';
import { validatePhoneNumber } from '../validators/phones.validator.js';
import {
  validateAccountChange,
  validateEnrollment,
  validatePhoneIdParam,
} from '../validators/sinpe.validator.js';

export async function list(req, res) {
  res.json(await sinpeService.list());
}

export async function stats(req, res) {
  res.json(await sinpeService.stats());
}

export async function enroll(req, res) {
  const { phoneId, accountId } = validateEnrollment(req.body);
  await sinpeService.enroll(phoneId, accountId);
  res.status(201).end();
}

export async function unenroll(req, res) {
  await sinpeService.unenroll(validatePhoneNumber(req.params.number));
  res.status(204).end();
}

export async function changeAccount(req, res) {
  const phoneId = validatePhoneIdParam(req.params.phoneId);
  const { accountId } = validateAccountChange(req.body);
  await sinpeService.changeAccount(phoneId, accountId);
  res.status(204).end();
}
