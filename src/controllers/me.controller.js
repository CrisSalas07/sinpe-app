import * as meService from '../services/me.service.js';
import { validateNewPhone } from '../validators/phones.validator.js';
import { validateMovementsQuery } from '../validators/reports.validator.js';

export async function summary(req, res) {
  res.json(await meService.summary(req.session.user));
}

export async function accounts(req, res) {
  res.json(await meService.accounts(req.session.user));
}

export async function recentMovements(req, res) {
  res.json(await meService.recentMovements(req.session.user));
}

export async function movements(req, res) {
  res.json(await meService.movements(req.session.user, validateMovementsQuery(req.query)));
}

export async function phones(req, res) {
  res.json(await meService.phones(req.session.user));
}

export async function createPhone(req, res) {
  const { number } = validateNewPhone(req.body);
  await meService.registerPhone(req.session.user, number);
  res.status(201).end();
}
