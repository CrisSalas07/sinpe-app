import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextRun } from '../src/services/backupScheduler.js';

// Dates are built in local time, like the scheduler, so the tests pass in any time zone.
const local = (year, month, day, hours = 0, minutes = 0) =>
  new Date(year, month - 1, day, hours, minutes);

const daily = { enabled: true, frequency: 'DIARIO', time: '02:00', weekday: 1, dayOfMonth: 1 };

test('a disabled schedule has no next run', () => {
  assert.equal(nextRun({ ...daily, enabled: false }, local(2026, 11, 13, 10)), null);
});

test('daily: today if the hour has not passed, otherwise tomorrow', () => {
  assert.deepEqual(nextRun(daily, local(2026, 11, 13, 1, 59)), local(2026, 11, 13, 2));
  assert.deepEqual(nextRun(daily, local(2026, 11, 13, 2, 0)), local(2026, 11, 14, 2));
  assert.deepEqual(nextRun(daily, local(2026, 12, 31, 23)), local(2027, 1, 1, 2));
});

test('weekly: the next chosen weekday', () => {
  // 2026-11-13 is a Friday (5).
  const monday = { ...daily, frequency: 'SEMANAL', weekday: 1 };
  assert.deepEqual(nextRun(monday, local(2026, 11, 13, 10)), local(2026, 11, 16, 2));
  const friday = { ...daily, frequency: 'SEMANAL', weekday: 5, time: '22:30' };
  assert.deepEqual(nextRun(friday, local(2026, 11, 13, 10)), local(2026, 11, 13, 22, 30));
  assert.deepEqual(nextRun(friday, local(2026, 11, 13, 23)), local(2026, 11, 20, 22, 30));
});

test('monthly: this month, the next one, or the last day of a short month', () => {
  const day15 = { ...daily, frequency: 'MENSUAL', dayOfMonth: 15 };
  assert.deepEqual(nextRun(day15, local(2026, 11, 13, 10)), local(2026, 11, 15, 2));
  assert.deepEqual(nextRun(day15, local(2026, 11, 20)), local(2026, 12, 15, 2));
  assert.deepEqual(nextRun(day15, local(2026, 12, 20)), local(2027, 1, 15, 2));

  const day31 = { ...daily, frequency: 'MENSUAL', dayOfMonth: 31 };
  assert.deepEqual(nextRun(day31, local(2027, 2, 1)), local(2027, 2, 28, 2));
  assert.deepEqual(nextRun(day31, local(2027, 3, 1)), local(2027, 3, 31, 2));
  assert.deepEqual(nextRun(day31, local(2026, 11, 13)), local(2026, 11, 30, 2));
});
