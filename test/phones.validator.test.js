import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError } from '../src/utils/errors.js';
import {
  validateAdminPhone,
  validateNewPhone,
  validateOwnerChange,
  validatePhoneNumber,
} from '../src/validators/phones.validator.js';

const fieldOf = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.field;
  }
  assert.fail('expected a ValidationError');
};

test('phone numbers have exactly 8 digits', () => {
  assert.equal(validatePhoneNumber('80000001'), '80000001');
  for (const value of ['8000000', '800000011', '8000-0001', '8000000a', 80000001, undefined]) {
    assert.equal(
      fieldOf(() => validatePhoneNumber(value)),
      'number',
    );
  }
});

test('register and owner change bodies', () => {
  assert.deepEqual(validateNewPhone({ number: '60000020' }), { number: '60000020' });
  assert.equal(
    fieldOf(() => validateNewPhone({ number: '60000020', identification: 'UCR000020' })),
    'identification',
  );
  assert.equal(
    fieldOf(() => validateOwnerChange({ identification: 'UCR000002', number: '1' })),
    'number',
  );
  assert.equal(
    fieldOf(() => validateOwnerChange({})),
    'identification',
  );
});

test('admin phone: owner id and 8 digits, nothing else', () => {
  assert.deepEqual(validateAdminPhone({ clientId: 3, number: '80000099' }), {
    clientId: 3,
    number: '80000099',
  });
  const fieldOf = (body) => {
    try {
      validateAdminPhone(body);
    } catch (err) {
      assert.ok(err instanceof ValidationError);
      return err.field;
    }
  };
  assert.equal(fieldOf({ number: '80000099' }), 'clientId');
  assert.equal(fieldOf({ clientId: '3', number: '80000099' }), 'clientId');
  assert.equal(fieldOf({ clientId: 3, number: '8000-0099' }), 'number');
  // The entity always comes from the session, never from the body.
  assert.equal(fieldOf({ clientId: 3, number: '80000099', entityId: 2 }), 'entityId');
});
