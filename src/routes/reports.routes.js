import { Router } from 'express';
import * as reports from '../controllers/reports.controller.js';

export const reportsRoutes = Router();

reportsRoutes.get('/enrollment-history', reports.enrollmentHistory);
reportsRoutes.get('/account-phones', reports.accountPhones);
