import { promisify } from 'node:util';
import { validateLogin } from '../validators/auth.validator.js';
import * as authService from '../services/auth.service.js';

const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos';

export async function login(req, res) {
  const { username, password } = validateLogin(req.body);

  if (!(await authService.checkCredentials(username, password))) {
    return res.status(401).json({ error: INVALID_CREDENTIALS });
  }

  // New session id on login prevents session fixation.
  await promisify(req.session.regenerate.bind(req.session))();
  req.session.user = username;
  res.json({ user: username });
}

export async function logout(req, res) {
  await promisify(req.session.destroy.bind(req.session))();
  res.clearCookie('sid');
  res.status(204).end();
}

export function me(req, res) {
  res.json({ user: req.session.user });
}
