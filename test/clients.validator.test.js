import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError } from '../src/utils/errors.js';
import { validateNewClient } from '../src/validators/clients.validator.js';

const valid = {
  identification: ' UCR000025 ',
  names: 'SOFÍA ANDREA',
  firstSurname: 'VARGAS',
  secondSurname: 'QUESADA',
  email: 'sofia.vargas.quesada@ucr.ac.cr',
  username: 'sofia.vargas',
  password: 'Temporal2026',
};

const fieldOf = (body) => {
  try {
    validateNewClient(body);
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.field;
  }
  assert.fail('expected a ValidationError');
};

test('accepts a valid client and trims text', () => {
  assert.equal(validateNewClient(valid).identification, 'UCR000025');
});

test('rejects unknown, missing, too long and malformed fields', () => {
  assert.equal(fieldOf({ ...valid, saldo: 1 }), 'saldo');
  assert.equal(fieldOf({ ...valid, names: '  ' }), 'names');
  assert.equal(fieldOf({ ...valid, identification: 'X'.repeat(21) }), 'identification');
  assert.equal(fieldOf({ ...valid, email: 'no-at-sign' }), 'email');
  assert.equal(fieldOf({ ...valid, status: 'ACTIVO' }), 'status');
  assert.equal(fieldOf({ ...valid, entityId: 1 }), 'entityId');
  assert.equal(fieldOf({ ...valid, names: 42 }), 'names');
});

test('usernames have 3 to 50 characters of a-z, 0-9, dot or underscore', () => {
  assert.equal(validateNewClient({ ...valid, username: 'a_b.9' }).username, 'a_b.9');
  for (const username of ['ab', 'x'.repeat(51), 'Sofia', 'sofía', 'a b', 'a-b']) {
    assert.equal(fieldOf({ ...valid, username }), 'username', username);
  }
});

test('the admin username is reserved', () => {
  assert.equal(fieldOf({ ...valid, username: 'admin' }), 'username');
});

test('temporary passwords have 8 to 128 characters and are not trimmed', () => {
  assert.equal(validateNewClient({ ...valid, password: ' 12345678 ' }).password, ' 12345678 ');
  for (const password of ['1234567', 'x'.repeat(129), 12345678, undefined]) {
    assert.equal(fieldOf({ ...valid, password }), 'password');
  }
});
