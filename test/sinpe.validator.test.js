import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError } from '../src/utils/errors.js';
import {
  validateAccountChange,
  validateEnrollment,
  validatePhoneIdParam,
} from '../src/validators/sinpe.validator.js';

const fieldOf = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.field;
  }
  assert.fail('expected a ValidationError');
};

test('enrollment needs integer phone and account ids', () => {
  assert.deepEqual(validateEnrollment({ phoneId: 26, accountId: 2 }), {
    phoneId: 26,
    accountId: 2,
  });
  assert.equal(
    fieldOf(() => validateEnrollment({ phoneId: '26', accountId: 2 })),
    'phoneId',
  );
  assert.equal(
    fieldOf(() => validateEnrollment({ phoneId: 26, accountId: 0 })),
    'accountId',
  );
  assert.equal(
    fieldOf(() => validateAccountChange({ accountId: 2, phoneId: 1 })),
    'phoneId',
  );
});

test('phone id path parameter', () => {
  assert.equal(validatePhoneIdParam('7'), 7);
  for (const value of ['0', '-1', '1.5', 'abc', '1e3', '99999999999999999999']) {
    assert.equal(
      fieldOf(() => validatePhoneIdParam(value)),
      'phoneId',
    );
  }
});
