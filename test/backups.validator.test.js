import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValidationError } from '../src/utils/errors.js';
import {
  validateFileName,
  validateRestore,
  validateSchedule,
  validateUploadQuery,
} from '../src/validators/backups.validator.js';

const fieldOf = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    return err.field;
  }
  assert.fail('expected a ValidationError');
};

const previous = { weekday: 3, dayOfMonth: 20 };

test('schedule: each frequency keeps only the day it needs', () => {
  assert.deepEqual(
    validateSchedule({ enabled: true, frequency: 'DIARIO', time: '02:00' }, previous),
    { enabled: true, frequency: 'DIARIO', time: '02:00', weekday: 3, dayOfMonth: 20 },
  );
  assert.equal(
    validateSchedule({ enabled: true, frequency: 'SEMANAL', time: '23:59', weekday: 0 }, previous)
      .weekday,
    0,
  );
  assert.equal(
    validateSchedule(
      { enabled: false, frequency: 'MENSUAL', time: '00:00', dayOfMonth: 31 },
      previous,
    ).dayOfMonth,
    31,
  );
});

test('bad schedules name the field', () => {
  const ok = { enabled: true, frequency: 'DIARIO', time: '02:00' };
  assert.equal(
    fieldOf(() => validateSchedule({ ...ok, enabled: 'si' }, previous)),
    'enabled',
  );
  assert.equal(
    fieldOf(() => validateSchedule({ ...ok, frequency: 'ANUAL' }, previous)),
    'frequency',
  );
  assert.equal(
    fieldOf(() => validateSchedule({ ...ok, time: '24:00' }, previous)),
    'time',
  );
  assert.equal(
    fieldOf(() => validateSchedule({ ...ok, time: '2:00' }, previous)),
    'time',
  );
  assert.equal(
    fieldOf(() => validateSchedule({ ...ok, frequency: 'SEMANAL', weekday: 7 }, previous)),
    'weekday',
  );
  assert.equal(
    fieldOf(() => validateSchedule({ ...ok, frequency: 'MENSUAL', dayOfMonth: 0 }, previous)),
    'dayOfMonth',
  );
  assert.equal(
    fieldOf(() => validateSchedule({ ...ok, extra: 1 }, previous)),
    'extra',
  );
});

test('file names cannot leave the backup folder', () => {
  assert.equal(
    validateFileName('sinpe_movil_2026-11-13_02-00-00_manual.sql'),
    'sinpe_movil_2026-11-13_02-00-00_manual.sql',
  );
  for (const bad of [
    '../.env',
    '..\\x.sql',
    'C:\\Respaldos\\a.sql',
    'a/b.sql',
    '.hidden.sql',
    'a.txt',
    '',
    5,
  ]) {
    assert.equal(
      fieldOf(() => validateFileName(bad)),
      'file',
    );
  }
});

test('restore needs an explicit confirmation', () => {
  assert.equal(validateRestore({ file: 'a.sql', confirm: true }), 'a.sql');
  assert.equal(
    fieldOf(() => validateRestore({ file: 'a.sql', confirm: 'true' })),
    'confirm',
  );
  assert.equal(
    fieldOf(() => validateRestore({ file: 'a.sql' })),
    'confirm',
  );
  assert.equal(validateUploadQuery({ name: 'respaldo_juntaucr.sql' }), 'respaldo_juntaucr.sql');
  assert.equal(
    fieldOf(() => validateUploadQuery({ name: '../a.sql' })),
    'name',
  );
});
