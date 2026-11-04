import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactName } from '../src/utils/names.js';

test('compact name: first given name + first surname, in Title Case', () => {
  assert.equal(compactName('LEONARDO ANTONIO', 'AGUILAR'), 'Leonardo Aguilar');
  assert.equal(compactName('DIEGO', 'PASTRAN'), 'Diego Pastran');
});
