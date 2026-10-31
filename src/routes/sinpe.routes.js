import { Router } from 'express';
import * as sinpe from '../controllers/sinpe.controller.js';

export const sinpeRoutes = Router();

sinpeRoutes.get('/', sinpe.list);
sinpeRoutes.get('/stats', sinpe.stats);
sinpeRoutes.post('/', sinpe.enroll);
sinpeRoutes.delete('/:number', sinpe.unenroll);
sinpeRoutes.put('/:phoneId/account', sinpe.changeAccount);
