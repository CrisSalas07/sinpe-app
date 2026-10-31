import { Router } from 'express';
import * as clients from '../controllers/clients.controller.js';

export const clientsRoutes = Router();

clientsRoutes.get('/', clients.list);
clientsRoutes.get('/stats', clients.stats);
clientsRoutes.post('/', clients.create);
