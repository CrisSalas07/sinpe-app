import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** Returns "<saltHex>:<hashHex>" using scrypt with a random 16-byte salt. */
export async function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** Constant-time check of a plain password against a stored "<saltHex>:<hashHex>". */
export async function verifyPassword(plain, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scryptAsync(plain, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}
