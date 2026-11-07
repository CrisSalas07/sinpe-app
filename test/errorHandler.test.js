import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorHandler } from '../src/middlewares/errorHandler.js';

function run(err) {
  const result = { status: null, body: null };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
    },
  };
  errorHandler(err, { method: 'GET', path: '/x' }, res, () => {});
  return result;
}

test('client errors from Express keep their status with a generic message', () => {
  const err = Object.assign(new URIError('Failed to decode param'), { status: 400 });
  assert.deepEqual(run(err), { status: 400, body: { error: 'Solicitud no válida' } });
});

test('unknown errors are a 500 without internal details', (t) => {
  t.mock.method(console, 'error', () => {});
  assert.deepEqual(run(new Error('boom')), { status: 500, body: { error: 'Error interno' } });
});
