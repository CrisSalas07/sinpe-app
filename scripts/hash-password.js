// Prints a scrypt hash to paste into APP_PASSWORD_HASH. Usage: npm run hash-password
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../src/utils/password.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Password: ');
rl.close();

if (password.length < 8) {
  console.error('The password must have at least 8 characters.');
  process.exit(1);
}

console.log(`APP_PASSWORD_HASH=${await hashPassword(password)}`);
