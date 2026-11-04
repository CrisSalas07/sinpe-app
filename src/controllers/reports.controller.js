import * as reportsService from '../services/reports.service.js';
import {
  validateAccountPhonesQuery,
  validateEnrollmentHistoryQuery,
} from '../validators/reports.validator.js';

export async function enrollmentHistory(req, res) {
  res.json(
    await reportsService.enrollmentHistory(
      req.session.user.entityId,
      validateEnrollmentHistoryQuery(req.query),
    ),
  );
}

export async function accountPhones(req, res) {
  res.json(
    await reportsService.accountPhones(
      req.session.user.entityId,
      validateAccountPhonesQuery(req.query),
    ),
  );
}
