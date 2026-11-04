import { Router } from 'express';
import * as me from '../controllers/me.controller.js';

export const meRoutes = Router();

meRoutes.get('/summary', me.summary);
meRoutes.get('/accounts', me.accounts);
meRoutes.get('/recent-movements', me.recentMovements);
meRoutes.get('/movements', me.movements);
meRoutes.get('/phones', me.phones);
meRoutes.post('/phones', me.createPhone);
