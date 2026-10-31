import * as reportsService from '../services/reports.service.js';
import {
  validateAccountPhonesQuery,
  validateEnrollmentHistoryQuery,
  validateMovementsQuery,
} from '../validators/reports.validator.js';

export async function movements(req, res) {
  res.json(await reportsService.movements(validateMovementsQuery(req.query)));
}

export async function enrollmentHistory(req, res) {
  res.json(await reportsService.enrollmentHistory(validateEnrollmentHistoryQuery(req.query)));
}

export async function accountPhones(req, res) {
  res.json(await reportsService.accountPhones(validateAccountPhonesQuery(req.query)));
}
