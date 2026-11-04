import path from 'node:path';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requireAuth, requireRole } from './middlewares/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { accountsRoutes } from './routes/accounts.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { catalogsRoutes } from './routes/catalogs.routes.js';
import { clientsRoutes } from './routes/clients.routes.js';
import { meRoutes } from './routes/me.routes.js';
import { phonesRoutes } from './routes/phones.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';
import { sinpeRoutes } from './routes/sinpe.routes.js';
import { transfersRoutes } from './routes/transfers.routes.js';
import { ROLES } from './services/auth.service.js';

const SESSION_IDLE_MS = 15 * 60 * 1000;
const WRITE_METHODS = ['POST', 'PUT', 'PATCH'];

export const app = express();

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        // Upgrading http://localhost requests to https would break local development.
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
  }),
);

app.use(express.json({ limit: '10kb' }));

// Write endpoints only accept JSON bodies; together with sameSite=strict this blocks form-based CSRF.
// req.is() is null for body-less requests (e.g. logout), false for a body of another type.
app.use('/api', (req, res, next) => {
  if (WRITE_METHODS.includes(req.method) && req.is('application/json') === false) {
    return res.status(415).json({ error: 'Content-Type debe ser application/json' });
  }
  next();
});

// shortcut: in-memory session store, lost on restart and single-instance only; use a shared store if this is ever deployed.
app.use(
  session({
    name: 'sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.isProduction,
      maxAge: SESSION_IDLE_MS,
    },
  }),
);

app.use(express.static(path.join(import.meta.dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);
app.use('/api/clients', requireRole(ROLES.ADMIN), clientsRoutes);
app.use('/api/accounts', requireRole(ROLES.ADMIN), accountsRoutes);
app.use('/api/catalogs', requireRole(ROLES.ADMIN), catalogsRoutes);
app.use('/api/phones', requireRole(ROLES.ADMIN), phonesRoutes);
app.use('/api/sinpe', requireRole(ROLES.ADMIN), sinpeRoutes);
app.use('/api/me', requireRole(ROLES.CLIENTE), meRoutes);
app.use('/api/transfers', requireRole(ROLES.CLIENTE), transfersRoutes);
app.use('/api/reports', requireRole(ROLES.ADMIN), reportsRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));

app.use(errorHandler);
