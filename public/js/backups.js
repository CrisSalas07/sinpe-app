// Respaldos (Laboratorio Copia de Seguridad, ejercicio 3): automatic schedule, manual backup,
// restore from a backup file and history.
import { api } from './api.js';
import { clearFormErrors, el, fillRows, showFormError, tag } from './dom.js';
import { initLayout } from './layout.js';

const $ = (id) => document.getElementById(id);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const OPERATIONS = {
  AUTOMATICO: 'Respaldo automático',
  MANUAL: 'Respaldo manual',
  ANTES_DE_RESTAURAR: 'Respaldo antes de restaurar',
  RESTAURACION: 'Restauración',
  PROGRAMACION: 'Programación',
};

const scheduleForm = $('schedule-form');
const scheduleAlert = $('schedule-alert');
const restoreForm = $('restore-form');
const restoreAlert = $('restore-alert');
const pageAlert = $('page-alert');
const pageOk = $('page-ok');
const runButton = $('run-now');
const uploadInput = $('upload-input');

await initLayout('backups', 'ADMIN');

$('dayOfMonth').replaceChildren(
  ...Array.from({ length: 31 }, (_, i) => el('option', { value: i + 1 }, i + 1)),
);
for (const input of [scheduleForm.frequency, scheduleForm.weekday, scheduleForm.dayOfMonth]) {
  input.addEventListener('change', updateScheduleFields);
}
scheduleForm.time.addEventListener('input', updateScheduleFields);
scheduleForm.enabled.addEventListener('change', updateScheduleFields);
scheduleForm.addEventListener('submit', saveSchedule);
restoreForm.addEventListener('submit', restore);
runButton.addEventListener('click', backupNow);
$('upload-button').addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', upload);

await load({ fillForm: true });

// ---------- Loading and rendering ----------

async function load({ fillForm = false, select } = {}) {
  try {
    const status = await api('/api/backups');
    render(status, select);
    if (fillForm) fillSchedule(status.schedule);
    if (!status.configured) {
      showPageError(
        'El módulo de respaldos no está configurado: agregue BACKUP_DB_USER y BACKUP_DB_PASSWORD al archivo .env y reinicie el servidor.',
      );
    }
  } catch (err) {
    fillRows($('file-rows'), [], 'No se pudo cargar.');
    fillRows($('history-rows'), [], 'No se pudo cargar.');
    showPageError(err.message);
  }
}

function render(status, select) {
  $('database').textContent = status.database;
  $('folder').textContent = status.folder;

  const lastBackup = status.history.find((entry) => entry.operation === 'RESPALDO' && entry.ok);
  $('stat-state').textContent = status.schedule.enabled ? 'Activo' : 'Inactivo';
  $('stat-next').textContent = status.nextRun ? formatDate(status.nextRun) : '—';
  $('stat-last').textContent = lastBackup ? formatDate(lastBackup.date) : '—';

  const fileSelect = restoreForm.file;
  const previous = select ?? fileSelect.value;
  fileSelect.replaceChildren(
    ...status.files.map((file) =>
      el('option', { value: file.name }, `${file.name} · ${formatSize(file.size)}`),
    ),
  );
  if (status.files.length === 0) {
    fileSelect.append(el('option', { value: '' }, 'No hay respaldos en la carpeta'));
  } else if (status.files.some((file) => file.name === previous)) {
    fileSelect.value = previous;
  }

  fillRows(
    $('file-rows'),
    status.files.map((file) =>
      el(
        'tr',
        {},
        el('td', { class: 'mono file-name', title: file.name }, file.name),
        el('td', {}, formatDate(file.modifiedAt)),
        el('td', {}, formatSize(file.size)),
        el(
          'td',
          {},
          el(
            'a',
            { class: 'chip', href: `/api/backups/files/${encodeURIComponent(file.name)}` },
            'Descargar',
          ),
        ),
      ),
    ),
    'Todavía no hay respaldos.',
  );

  fillRows(
    $('history-rows'),
    status.history.map((entry) =>
      el(
        'tr',
        {},
        el('td', {}, formatDate(entry.date)),
        el('td', {}, OPERATIONS[entry.type ?? entry.operation]),
        el('td', { class: 'mono file-name', title: entry.file ?? '' }, entry.file ?? '—'),
        el('td', {}, entry.ok ? tag('Correcto', 'ok') : tag('Error', 'bad')),
        el('td', { class: 'clip', title: entry.detail ?? '' }, historyDetail(entry)),
      ),
    ),
    'Sin operaciones registradas.',
  );

  for (const button of document.querySelectorAll('button')) {
    if (button.closest('.app-header')) continue;
    button.disabled = !status.configured;
  }
}

function historyDetail(entry) {
  if (entry.detail) return entry.detail;
  if (entry.size != null) return `${formatSize(entry.size)} en ${formatDuration(entry.durationMs)}`;
  return entry.durationMs != null ? formatDuration(entry.durationMs) : '';
}

function fillSchedule(schedule) {
  // Never saved yet: the box starts checked, because saving the setup is what activates it.
  scheduleForm.enabled.checked = schedule.updatedAt ? schedule.enabled : true;
  scheduleForm.frequency.value = schedule.frequency;
  scheduleForm.time.value = schedule.time;
  scheduleForm.weekday.value = String(schedule.weekday);
  scheduleForm.dayOfMonth.value = String(schedule.dayOfMonth);
  updateScheduleFields();
}

// Shows the day field that the frequency needs and a sentence with the chosen schedule.
function updateScheduleFields() {
  const { frequency, time, weekday, dayOfMonth, enabled } = scheduleForm;
  $('weekday-field').hidden = frequency.value !== 'SEMANAL';
  $('day-field').hidden = frequency.value !== 'MENSUAL';

  const at = time.value ? ` a las ${time.value}` : '';
  const when = {
    DIARIO: `todos los días${at}`,
    SEMANAL: `cada ${WEEKDAYS[Number(weekday.value)]}${at}`,
    MENSUAL: `el día ${dayOfMonth.value} de cada mes${at}`,
  }[frequency.value];
  $('schedule-summary').textContent = enabled.checked
    ? `Al guardar, la base se respaldará automáticamente ${when}.`
    : 'Al guardar, el respaldo automático quedará desactivado.';
}

// ---------- Actions ----------

async function saveSchedule(event) {
  event.preventDefault();
  clearFormErrors(scheduleForm, scheduleAlert);
  hideMessages();
  const { enabled, frequency, time, weekday, dayOfMonth } = scheduleForm;
  const body = { enabled: enabled.checked, frequency: frequency.value, time: time.value };
  if (frequency.value === 'SEMANAL') body.weekday = Number(weekday.value);
  if (frequency.value === 'MENSUAL') body.dayOfMonth = Number(dayOfMonth.value);

  await busy(scheduleForm.querySelector('[type=submit]'), 'Guardando…', async () => {
    try {
      const status = await api('/api/backups/schedule', { method: 'PUT', body });
      render(status);
      fillSchedule(status.schedule);
      showOk(
        status.nextRun
          ? `Respaldo automático activado. Próximo respaldo: ${formatDate(status.nextRun)}`
          : 'Respaldo automático desactivado.',
      );
    } catch (err) {
      showFormError(scheduleForm, scheduleAlert, err);
    }
  });
}

async function backupNow() {
  hideMessages();
  await busy(runButton, 'Respaldando…', async () => {
    try {
      const file = await api('/api/backups/run', { method: 'POST' });
      showOk(`Respaldo creado: ${file.name} (${formatSize(file.size)}).`);
    } catch (err) {
      showPageError(err.message);
    }
    await load();
  });
}

async function upload() {
  const file = uploadInput.files[0];
  uploadInput.value = '';
  if (!file) return;
  clearFormErrors(restoreForm, restoreAlert);
  hideMessages();
  if (file.size > MAX_UPLOAD_BYTES) {
    return showFormError(restoreForm, restoreAlert, {
      message: 'El archivo no puede pesar más de 50 MB',
      field: 'file',
    });
  }
  // Spaces and accents are not allowed in the folder: they become "_".
  const name = file.name.replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^[^A-Za-z0-9]+/, '');
  try {
    await api(`/api/backups/upload?${new URLSearchParams({ name })}`, {
      method: 'POST',
      body: file,
    });
    await load({ select: name });
    showOk(`Archivo ${name} subido. Revise que esté seleccionado y presione Restaurar.`);
  } catch (err) {
    showFormError(restoreForm, restoreAlert, err);
  }
}

async function restore(event) {
  event.preventDefault();
  clearFormErrors(restoreForm, restoreAlert);
  hideMessages();
  const body = { file: restoreForm.file.value, confirm: restoreForm.confirm.checked };

  await busy(restoreForm.querySelector('[type=submit]'), 'Restaurando…', async () => {
    try {
      const result = await api('/api/backups/restore', { method: 'POST', body });
      restoreForm.confirm.checked = false;
      showOk(
        `Base de datos restaurada desde ${result.file}. Los datos anteriores quedaron en ${result.safetyBackup}.`,
      );
    } catch (err) {
      showFormError(restoreForm, restoreAlert, err);
    }
    await load({ select: body.file });
  });
}

// ---------- Helpers ----------

async function busy(button, text, work) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = text;
  try {
    await work();
  } finally {
    button.textContent = label;
    button.disabled = false;
  }
}

function hideMessages() {
  pageAlert.hidden = true;
  pageOk.hidden = true;
}

function showPageError(message) {
  pageAlert.textContent = message;
  pageAlert.hidden = false;
}

function showOk(message) {
  pageOk.textContent = message;
  pageOk.hidden = false;
}

/** "13/11/2026, 14:30" in the browser's local time. */
function formatDate(iso) {
  return new Date(iso).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(ms) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
