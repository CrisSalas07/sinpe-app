import { env } from '../config/env.js';
import { verifyPassword } from '../utils/password.js';

/** True only if both the user and the password match the configured operator. */
export async function checkCredentials(username, password) {
  // Always run scrypt so a wrong username takes as long as a wrong password.
  const passwordOk = await verifyPassword(password, env.appPasswordHash);
  return username === env.appUser && passwordOk;
}
