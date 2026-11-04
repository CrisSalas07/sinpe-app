import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireAuth, requireRole } from '../src/middlewares/auth.js';

function run(middleware, user) {
  const result = { status: null, body: null, next: false };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
    },
  };
  middleware({ session: { user } }, res, () => {
    result.next = true;
  });
  return result;
}

test('requireAuth answers 401 without a session', () => {
  assert.equal(run(requireAuth, undefined).status, 401);
  assert.equal(run(requireAuth, { role: 'ADMIN' }).next, true);
});

test('requireRole lets the right role through', () => {
  assert.equal(run(requireRole('ADMIN'), { role: 'ADMIN' }).next, true);
});

test('requireRole answers 403 to the other role', () => {
  const result = run(requireRole('ADMIN'), { role: 'CLIENTE' });
  assert.equal(result.status, 403);
  assert.equal(result.next, false);
  assert.deepEqual(result.body, { error: 'No tiene permiso para esta accion' });
});
