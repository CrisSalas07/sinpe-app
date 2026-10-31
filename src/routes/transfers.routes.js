import { Router } from 'express';
import * as transfers from '../controllers/transfers.controller.js';

export const transfersRoutes = Router();

transfersRoutes.post('/sinpe', transfers.bySinpe);
transfersRoutes.post('/iban', transfers.byIban);
