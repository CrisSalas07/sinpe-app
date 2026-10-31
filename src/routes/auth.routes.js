import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { loginLimiter } from '../middlewares/rateLimit.js';

export const authRoutes = Router();

authRoutes.post('/login', loginLimiter, auth.login);
authRoutes.post('/logout', requireAuth, auth.logout);
authRoutes.get('/me', requireAuth, auth.me);
