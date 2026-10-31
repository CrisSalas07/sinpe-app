import { Router } from 'express';
import * as accounts from '../controllers/accounts.controller.js';

export const accountsRoutes = Router();

accountsRoutes.get('/', accounts.list);
accountsRoutes.get('/stats', accounts.stats);
accountsRoutes.post('/', accounts.create);
