import assert from 'node:assert/strict';
import { test } from 'node:test';
import { count, groupBy } from '../public/js/dom.js';

test('groupBy keeps each owner together, in order of first appearance', () => {
  const rows = [
    { owner: 'a', n: 1 },
    { owner: 'b', n: 2 },
    { owner: 'a', n: 3 },
  ];
  assert.deepEqual(
    groupBy(rows, (row) => row.owner).map((group) => group.map((row) => row.n)),
    [[1, 3], [2]],
  );
  assert.deepEqual(
    groupBy([], (row) => row.owner),
    [],
  );
});

test('count picks singular or plural', () => {
  assert.equal(count(1, 'teléfono', 'teléfonos'), '1 teléfono');
  assert.equal(count(2, 'teléfono', 'teléfonos'), '2 teléfonos');
  assert.equal(count(0, 'cuenta', 'cuentas'), '0 cuentas');
});
