import { rateLimit } from 'express-rate-limit';

// 5 login attempts per 15 minutes per IP.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
});
