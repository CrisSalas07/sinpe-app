import { Router } from 'express';
import * as catalogs from '../controllers/catalogs.controller.js';

export const catalogsRoutes = Router();

catalogsRoutes.get('/currencies', catalogs.currencies);
