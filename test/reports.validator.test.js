import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError } from '../src/utils/errors.js';
import {
  validateAccountPhonesQuery,
  validateEnrollmentHistoryQuery,
  validateMovementsQuery,
} from '../src/validators/reports.validator.js';

const fieldOf = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.field;
  }
  assert.fail('expected a ValidationError');
};

const movements = { iban: 'CR00000000000000000001', from: '2026-10-01', to: '2026-10-31' };

test('report queries', () => {
  assert.deepEqual(validateMovementsQuery(movements), movements);
  assert.equal(validateEnrollmentHistoryQuery({ number: '80000002' }), '80000002');
  assert.equal(validateAccountPhonesQuery({ iban: 'cr00000000000000000001' }), movements.iban);
});

test('bad report queries name the field', () => {
  assert.equal(
    fieldOf(() => validateMovementsQuery({ ...movements, to: '31/10/2026' })),
    'to',
  );
  // A repeated query parameter arrives as an array.
  assert.equal(
    fieldOf(() => validateMovementsQuery({ ...movements, iban: ['a', 'b'] })),
    'iban',
  );
  assert.equal(
    fieldOf(() => validateMovementsQuery({ ...movements, page: '2' })),
    'page',
  );
  assert.equal(
    fieldOf(() => validateEnrollmentHistoryQuery({ number: '8000' })),
    'number',
  );
  assert.equal(
    fieldOf(() => validateAccountPhonesQuery({})),
    'iban',
  );
});
