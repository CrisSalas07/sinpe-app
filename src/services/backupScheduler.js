// Automatic backup timer: daily, weekly or monthly at the hour chosen by the administrator.
// It uses the server's local time and needs no extra package: one setTimeout for the next run.

export const FREQUENCIES = ['DIARIO', 'SEMANAL', 'MENSUAL'];

// setTimeout cannot wait more than ~24.8 days; a longer wait (monthly) is done in steps.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Date of the next run strictly after `now`, or null when the schedule is off.
 * MENSUAL on day 29-31 runs on the last day of shorter months (day 31 → Feb 28, Apr 30…).
 */
export function nextRun(schedule, now = new Date()) {
  if (!schedule.enabled) return null;
  const [hours, minutes] = schedule.time.split(':').map(Number);
  const at = (year, month, day) => new Date(year, month, day, hours, minutes, 0, 0);
  const [year, month, day] = [now.getFullYear(), now.getMonth(), now.getDate()];

  if (schedule.frequency === 'DIARIO') {
    const today = at(year, month, day);
    return today > now ? today : at(year, month, day + 1);
  }

  if (schedule.frequency === 'SEMANAL') {
    const offset = (schedule.weekday - now.getDay() + 7) % 7;
    const candidate = at(year, month, day + offset);
    return candidate > now ? candidate : at(year, month, day + offset + 7);
  }

  // MENSUAL: this month or the next one is always enough.
  for (const add of [0, 1]) {
    const lastDay = new Date(year, month + add + 1, 0).getDate();
    const candidate = at(year, month + add, Math.min(schedule.dayOfMonth, lastDay));
    if (candidate > now) return candidate;
  }
  return null;
}

/**
 * Date of an automatic backup that should have run while the server was off, or null.
 * `lastRun` is the last successful automatic backup (null if none): the run due after it, or after
 * the schedule was saved when there is none, must not be in the past.
 */
export function missedRun(schedule, lastRun, now = new Date()) {
  const since = [lastRun, schedule.updatedAt].filter(Boolean).map((date) => new Date(date));
  if (!schedule.enabled || since.length === 0) return null;
  const due = nextRun(schedule, new Date(Math.max(...since)));
  return due && due <= now ? due : null;
}

let timer = null;
let next = null;
// Changes on every start/stop, so a run that was in progress does not re-arm an old schedule.
let generation = 0;

/** Date of the next automatic backup, or null if none is scheduled. */
export const nextScheduledRun = () => next;

/** Replaces the current schedule. `task` runs at each date; it must handle its own errors. */
export function startSchedule(schedule, task) {
  stopSchedule();
  next = nextRun(schedule);
  if (next) arm(schedule, task, generation);
}

export function stopSchedule() {
  generation += 1;
  clearTimeout(timer);
  timer = null;
  next = null;
}

function arm(schedule, task, armedGeneration) {
  const wait = Math.min(Math.max(next.getTime() - Date.now(), 0), MAX_TIMEOUT_MS);
  timer = setTimeout(async () => {
    // A step of a long wait, not the run yet.
    if (Date.now() < next.getTime()) return arm(schedule, task, armedGeneration);
    await task();
    if (armedGeneration !== generation) return;
    next = nextRun(schedule);
    if (next) arm(schedule, task, armedGeneration);
  }, wait);
  // The timer alone must not keep Node running (tests, shutdown).
  timer.unref();
}
