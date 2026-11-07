import { Router } from 'express';
import * as phones from '../controllers/phones.controller.js';

export const phonesRoutes = Router();

phonesRoutes.get('/', phones.list);
phonesRoutes.get('/options', phones.options);
phonesRoutes.get('/stats', phones.stats);
phonesRoutes.post('/', phones.create);
phonesRoutes.put('/:number/owner', phones.changeOwner);
