import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accountLabel,
  accountType,
  compactName,
  counterpartName,
  formatMoney,
  formatPhone,
  fullName,
  shortIban,
  titleCase,
} from '../public/js/format.js';

const NBSP = ' ';

test('names', () => {
  assert.equal(titleCase('CRISTOPHER EDUARDO BOLAÑOS'), 'Cristopher Eduardo Bolaños');
  assert.equal(compactName('LEONARDO ANTONIO', 'AGUILAR'), 'Leonardo Aguilar');
  assert.equal(
    fullName('LEONARDO ANTONIO', 'AGUILAR', 'BERROCAL'),
    'Leonardo Antonio Aguilar Berrocal',
  );
});

test('phone and IBAN', () => {
  assert.equal(formatPhone('80000001'), '8000-0001');
  assert.equal(shortIban('CR00000000000000000001'), 'CR00 …001');
});

test('money keeps exact digits and follows the Figma format', () => {
  assert.equal(formatMoney('123991.00', 'CRC'), `₡${NBSP}123${NBSP}991`);
  assert.equal(formatMoney('123991.50', 'CRC'), `₡${NBSP}123${NBSP}991,50`);
  assert.equal(formatMoney('377.00', 'USD'), `$${NBSP}377,00`);
  assert.equal(formatMoney('1012.00', 'USD'), `$${NBSP}1${NBSP}012,00`);
  assert.equal(formatMoney('999', 'CRC'), `₡${NBSP}999`);
  assert.equal(
    formatMoney('9999999999999.99', 'CRC'),
    `₡${NBSP}9${NBSP}999${NBSP}999${NBSP}999${NBSP}999,99`,
  );
  assert.equal(formatMoney('-5000.00', 'CRC'), `-₡${NBSP}5${NBSP}000`);
});

test('cents helpers are exact for the largest DECIMAL(15,2) values', async () => {
  const { toCents, fromCents } = await import('../public/js/format.js');
  assert.equal(toCents('123991.00'), 12399100);
  assert.equal(toCents('0.5'), 50);
  assert.equal(toCents('15000'), 1500000);
  assert.equal(fromCents(toCents('123991.00') - toCents('15000')), '108991.00');
  assert.equal(fromCents(toCents('63901') - toCents('100000')), '-36099.00');
  assert.equal(fromCents(toCents('9999999999999.99') * 2), '19999999999999.98');
  // 0.1 + 0.2 would not be 0.3 with floats.
  assert.equal(fromCents(toCents('0.1') + toCents('0.2')), '0.30');
});

test('account labels follow the currency', () => {
  assert.equal(accountType('CRC'), 'Ahorros colones');
  assert.equal(accountType('USD'), 'Ahorros dólares');
  assert.equal(accountLabel('CR12015200000000000001', 'CRC'), 'CR12 …001 · Ahorros colones');
});

test('counterpart: first name + surname from the text of the movements', () => {
  assert.equal(counterpartName('IVAN CALET ALTAMIRANO'), 'Ivan Altamirano');
  assert.equal(counterpartName('DIEGO PASTRAN'), 'Diego Pastran');
});
