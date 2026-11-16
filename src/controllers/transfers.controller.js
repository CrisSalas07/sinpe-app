import * as transfersService from '../services/transfers.service.js';
import {
  validateEnrollment,
  validateIbanTransfer,
  validateLimitQuery,
  validateRecipientQuery,
  validateSinpeTransfer,
} from '../validators/transfers.validator.js';

export async function bySinpe(req, res) {
  const receipt = await transfersService.bySinpe(req.session.user, validateSinpeTransfer(req.body));
  res.status(201).json(receipt);
}

export async function byIban(req, res) {
  const receipt = await transfersService.byIban(req.session.user, validateIbanTransfer(req.body));
  res.status(201).json(receipt);
}

export async function recipient(req, res) {
  res.json(await transfersService.recipient(req.session.user, validateRecipientQuery(req.query)));
}

export async function limit(req, res) {
  res.json(await transfersService.limit(req.session.user, validateLimitQuery(req.query)));
}

export async function enroll(req, res) {
  res
    .status(201)
    .json(await transfersService.enroll(req.session.user, validateEnrollment(req.body)));
}
