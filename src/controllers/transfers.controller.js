import * as transfersService from '../services/transfers.service.js';
import { validateIbanTransfer, validateSinpeTransfer } from '../validators/transfers.validator.js';

export async function bySinpe(req, res) {
  res.status(201).json(await transfersService.bySinpe(validateSinpeTransfer(req.body)));
}

export async function byIban(req, res) {
  res.status(201).json(await transfersService.byIban(validateIbanTransfer(req.body)));
}
