import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError } from '../src/utils/errors.js';
import {
  validateIbanTransfer,
  validateLimitQuery,
  validateRecipientQuery,
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

const sinpe = {
  originIban: 'CR12015200000000000001',
  destinationNumber: '80000002',
  amount: '15000',
};
const iban = {
  originIban: 'CR12015200000000000001',
  destinationIban: 'cr12015100000000000002',
  amount: '15000.50',
};

test('valid transfers; empty detail becomes null, IBAN is uppercased', () => {
  assert.equal(validateSinpeTransfer({ ...sinpe, detail: '  ' }).detail, null);
  assert.equal(validateSinpeTransfer({ ...sinpe, detail: ' almuerzo ' }).detail, 'almuerzo');
  assert.equal(validateIbanTransfer(iban).destinationIban, 'CR12015100000000000002');
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
    fieldOf(() => validateSinpeTransfer({ ...sinpe, originIban: '80000001' })),
    'originIban',
  );
  assert.equal(
    fieldOf(() => validateSinpeTransfer({ ...sinpe, clientId: 2 })),
    'clientId',
  );
  assert.equal(
    fieldOf(() => validateIbanTransfer({ ...iban, originNumber: '1' })),
    'originNumber',
  );
});

test('recipient takes a phone or an IBAN, not both', () => {
  assert.deepEqual(validateRecipientQuery({ number: '80000002' }), { number: '80000002' });
  assert.deepEqual(validateRecipientQuery({ iban: 'cr12015100000000000002' }), {
    iban: 'CR12015100000000000002',
  });
  assert.equal(
    fieldOf(() => validateRecipientQuery({})),
    'destinationNumber',
  );
  assert.equal(
    fieldOf(() => validateRecipientQuery({ number: '8000' })),
    'destinationNumber',
  );
  assert.equal(
    fieldOf(() => validateRecipientQuery({ iban: 'CR1' })),
    'destinationIban',
  );
  assert.equal(
    fieldOf(() => validateRecipientQuery({ number: '80000002', iban: iban.originIban })),
    'number',
  );
  assert.equal(
    fieldOf(() => validateRecipientQuery({ number: '80000002', id: '1' })),
    'id',
  );
});

test('the limit query needs the origin IBAN', () => {
  assert.equal(validateLimitQuery({ iban: iban.originIban }), iban.originIban);
  assert.equal(
    fieldOf(() => validateLimitQuery({})),
    'originIban',
  );
});

test('IBAN transfer: the beneficiary id is optional (the procedure requires it between entities)', () => {
  assert.equal(validateIbanTransfer(iban).destinationIdentification, null);
  assert.equal(
    validateIbanTransfer({ ...iban, destinationIdentification: ' UCR000002 ' })
      .destinationIdentification,
    'UCR000002',
  );
  assert.equal(
    fieldOf(() => validateIbanTransfer({ ...iban, destinationIdentification: 'x'.repeat(21) })),
    'destinationIdentification',
  );
});
