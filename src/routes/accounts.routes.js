import { Router } from 'express';
import * as accounts from '../controllers/accounts.controller.js';

export const accountsRoutes = Router();

accountsRoutes.get('/', accounts.list);
accountsRoutes.get('/stats', accounts.stats);
accountsRoutes.get('/next-iban', accounts.nextIban);
accountsRoutes.post('/', accounts.create);
