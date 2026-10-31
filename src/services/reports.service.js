import * as reportsRepository from '../repositories/reports.repository.js';

export const movements = ({ iban, from, to }) => reportsRepository.findMovements(iban, from, to);

export const enrollmentHistory = (number) => reportsRepository.findEnrollmentHistory(number);

export const accountPhones = (iban) => reportsRepository.findAccountPhones(iban);
