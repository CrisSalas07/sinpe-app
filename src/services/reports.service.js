import * as reportsRepository from '../repositories/reports.repository.js';

export const enrollmentHistory = (entityId, number) =>
  reportsRepository.findEnrollmentHistory(entityId, number);

export const accountPhones = (entityId, iban) =>
  reportsRepository.findAccountPhones(entityId, iban);
