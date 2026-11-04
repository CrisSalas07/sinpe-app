import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INVALID_CREDENTIALS, validateLogin } from '../src/validators/auth.validator.js';

const valid = { entityId: 1, username: 'leonardo.aguilar', password: 'Cliente2026' };
const fieldOf = (body) => {
  try {
    validateLogin(body);
  } catch (err) {
    return err.field;
  }
  return null;
};

test('a valid login returns clean data', () => {
  assert.deepEqual(validateLogin({ ...valid, username: ' leonardo.aguilar ' }), valid);
});

test('the entity is required and must be an id', () => {
  assert.equal(fieldOf({ username: 'a', password: 'b' }), 'entityId');
  assert.equal(fieldOf({ ...valid, entityId: '1' }), 'entityId');
  assert.equal(fieldOf({ ...valid, entityId: 0 }), 'entityId');
});

test('unknown fields are rejected', () => {
  assert.equal(fieldOf({ ...valid, role: 'ADMIN' }), 'role');
  assert.equal(fieldOf({ ...valid, clientId: 1 }), 'clientId');
});

test('a too-long password answers with the generic message', () => {
  assert.throws(() => validateLogin({ ...valid, password: 'x'.repeat(129) }), {
    message: INVALID_CREDENTIALS,
  });
});
