import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

test('verifyPassword accepts the right password and rejects others', async () => {
  const stored = await hashPassword('correct horse');
  assert.equal(await verifyPassword('correct horse', stored), true);
  assert.equal(await verifyPassword('wrong horse', stored), false);
});

test('two hashes of the same password use different salts', async () => {
  assert.notEqual(await hashPassword('same'), await hashPassword('same'));
});

test('verifyPassword rejects malformed stored values', async () => {
  assert.equal(await verifyPassword('x', ''), false);
  assert.equal(await verifyPassword('x', 'abc'), false);
  assert.equal(await verifyPassword('x', 'abcd:1234'), false);
});
