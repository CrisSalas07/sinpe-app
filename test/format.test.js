import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compactName,
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
