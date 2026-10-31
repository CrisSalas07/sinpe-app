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
  status: 'ACTIVO',
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
  assert.equal(fieldOf({ ...valid, status: 'BORRADO' }), 'status');
  assert.equal(fieldOf({ ...valid, names: 42 }), 'names');
});
