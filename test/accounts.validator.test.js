import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError } from '../src/utils/errors.js';
import { validateNewAccount, validateStatusChange } from '../src/validators/accounts.validator.js';
import { requireDate, requireMoney } from '../src/validators/common.js';

const valid = {
  clientId: 15,
  currency: 'CRC',
  iban: 'cr12015200000000000037',
  balance: '50000',
  openedAt: '2026-11-09',
};

const fieldOf = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.field;
  }
  assert.fail('expected a ValidationError');
};

test('accepts a valid account and uppercases the IBAN', () => {
  assert.equal(validateNewAccount(valid).iban, 'CR12015200000000000037');
});

test('rejects bad account fields', () => {
  const bad = (patch) => fieldOf(() => validateNewAccount({ ...valid, ...patch }));
  assert.equal(bad({ iban: 'CR0000000000000000003' }), 'iban');
  assert.equal(bad({ iban: 'US00000000000000000037' }), 'iban');
  assert.equal(bad({ clientId: '15' }), 'clientId');
  assert.equal(bad({ balance: 50000 }), 'balance');
  assert.equal(bad({ balance: '-1' }), 'balance');
  assert.equal(bad({ openedAt: '2026-02-30' }), 'openedAt');
  assert.equal(bad({ status: 'ACTIVA' }), 'status');
  assert.equal(bad({ bankId: 1 }), 'bankId');
  assert.equal(bad({ extra: true }), 'extra');
});

test('money: strings only, up to 13 digits and 2 decimals, zero only when allowed', () => {
  const money = (value, opts) => requireMoney({ m: value }, 'm', 'Monto', opts);
  assert.equal(money('0', { allowZero: true }), '0');
  assert.equal(money('9999999999999.99'), '9999999999999.99');
  assert.equal(money('0.5'), '0.5');
  for (const value of ['0', '0.00', '1.234', '1e5', ' 1', '10000000000000', '', 1]) {
    assert.equal(
      fieldOf(() => money(value)),
      'm',
      `should reject ${JSON.stringify(value)}`,
    );
  }
});

test('dates must exist in the calendar', () => {
  assert.equal(requireDate({ d: '2028-02-29' }, 'd'), '2028-02-29');
  for (const value of ['2026-02-29', '2026-13-01', '26-01-01', '2026-1-1', null]) {
    assert.equal(
      fieldOf(() => requireDate({ d: value }, 'd')),
      'd',
    );
  }
});

test('status change: an IBAN in the path and one of the three states', () => {
  const iban = 'CR12015200000000000005';
  assert.deepEqual(validateStatusChange(iban, { status: 'BLOQUEADA' }), {
    iban,
    status: 'BLOQUEADA',
  });
  const fieldOf = (param, body) => {
    try {
      validateStatusChange(param, body);
    } catch (err) {
      assert.ok(err instanceof ValidationError);
      return err.field;
    }
  };
  assert.equal(fieldOf(iban, { status: 'CERRADA' }), 'status');
  assert.equal(fieldOf(iban, { status: 'activa' }), 'status');
  assert.equal(fieldOf('CR12', { status: 'ACTIVA' }), 'iban');
  // The entity always comes from the session.
  assert.equal(fieldOf(iban, { status: 'ACTIVA', entityId: 2 }), 'entityId');
});
