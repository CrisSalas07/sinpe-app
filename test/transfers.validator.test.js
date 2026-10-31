import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError } from '../src/utils/errors.js';
import {
  validateIbanTransfer,
  validateSinpeTransfer,
} from '../src/validators/transfers.validator.js';

const fieldOf = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.field;
  }
  assert.fail('expected a ValidationError');
};

const sinpe = { originNumber: '80000001', destinationNumber: '80000002', amount: '15000' };
const iban = {
  originIban: 'CR00000000000000000001',
  destinationIban: 'cr00000000000000000002',
  amount: '15000.50',
};

test('valid transfers; empty detail becomes null, IBAN is uppercased', () => {
  assert.equal(validateSinpeTransfer({ ...sinpe, detail: '  ' }).detail, null);
  assert.equal(validateSinpeTransfer({ ...sinpe, detail: ' almuerzo ' }).detail, 'almuerzo');
  assert.equal(validateIbanTransfer(iban).destinationIban, 'CR00000000000000000002');
});

test('invalid transfers name the wrong field', () => {
  assert.equal(
    fieldOf(() => validateSinpeTransfer({ ...sinpe, amount: '0' })),
    'amount',
  );
  assert.equal(
    fieldOf(() => validateSinpeTransfer({ ...sinpe, amount: 15000 })),
    'amount',
  );
  assert.equal(
    fieldOf(() => validateSinpeTransfer({ ...sinpe, destinationNumber: '8000-0002' })),
    'destinationNumber',
  );
  assert.equal(
    fieldOf(() => validateSinpeTransfer({ ...sinpe, detail: 'x'.repeat(101) })),
    'detail',
  );
  assert.equal(
    fieldOf(() => validateIbanTransfer({ ...iban, originIban: 'CR1' })),
    'originIban',
  );
  assert.equal(
    fieldOf(() => validateIbanTransfer({ ...iban, originNumber: '1' })),
    'originNumber',
  );
});
