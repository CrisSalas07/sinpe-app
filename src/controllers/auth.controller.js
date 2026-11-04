import { promisify } from 'node:util';
import { INVALID_CREDENTIALS, validateLogin } from '../validators/auth.validator.js';
import * as authService from '../services/auth.service.js';

export async function entities(req, res) {
  res.json(await authService.listEntities());
}

export async function login(req, res) {
  const user = await authService.login(validateLogin(req.body));

  if (!user) {
    return res.status(401).json({ error: INVALID_CREDENTIALS });
  }

  // New session id on login prevents session fixation.
  await promisify(req.session.regenerate.bind(req.session))();
  req.session.user = user;
  res.json(user);
}

export async function logout(req, res) {
  await promisify(req.session.destroy.bind(req.session))();
  res.clearCookie('sid');
  res.status(204).end();
}

export function me(req, res) {
  res.json(req.session.user);
}
