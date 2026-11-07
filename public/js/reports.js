import { api } from './api.js';
import { el, fillRows, tag } from './dom.js';
import { compactName, formatPhone, shortIban } from './format.js';
import { initLayout } from './layout.js';

const $ = (id) => document.getElementById(id);
// `lookups`: only the answer to the latest request of each report counts.
const history = {
  number: $('history-number'),
  rows: $('history-rows'),
  alert: $('history-alert'),
  lookups: 0,
};
const phones = {
  iban: $('phones-iban'),
  rows: $('phones-rows'),
  alert: $('phones-alert'),
  lookups: 0,
};

await initLayout('reports', 'ADMIN');
history.number.addEventListener('change', loadHistory);
phones.iban.addEventListener('change', loadPhones);

// Each report loads as soon as a value changes: the Figma has no "Consultar" button.
if (await loadOptions()) await Promise.all([loadHistory(), loadPhones()]);

async function loadOptions() {
  try {
    const [accountList, phoneList] = await Promise.all([
      api('/api/accounts'),
      api('/api/phones/options'),
    ]);
    phones.iban.replaceChildren(
      ...accountList.map((account) =>
        el(
          'option',
          { value: account.iban },
          `${shortIban(account.iban)} · ${compactName(account.holderNames, account.holderFirstSurname)}`,
        ),
      ),
    );
    history.number.replaceChildren(
      ...phoneList.map((phone) =>
        el(
          'option',
          { value: phone.number },
          `${formatPhone(phone.number)} · ${compactName(phone.ownerNames, phone.ownerFirstSurname)}`,
        ),
      ),
    );
    return true;
  } catch (err) {
    for (const report of [history, phones]) fillRows(report.rows, [], 'No se pudo cargar.');
    showAlert(history.alert, err);
    return false;
  }
}

function showAlert(alertBox, err) {
  alertBox.textContent = err.message;
  alertBox.hidden = false;
}

function query(params) {
  return new URLSearchParams(params).toString();
}

async function loadHistory() {
  const lookup = ++history.lookups;
  history.alert.hidden = true;
  try {
    const rows = await api(
      `/api/reports/enrollment-history?${query({ number: history.number.value })}`,
    );
    if (lookup !== history.lookups) return;
    fillRows(
      history.rows,
      rows.map((row) =>
        el(
          'tr',
          {},
          el('td', {}, row.date.slice(0, 16)),
          el('td', {}, tag(row.action, row.action === 'AFILIACION' ? 'ok' : 'bad')),
          el('td', { class: 'mono' }, shortIban(row.iban)),
        ),
      ),
      'Sin eventos en esta entidad.',
    );
  } catch (err) {
    if (lookup !== history.lookups) return;
    fillRows(history.rows, [], 'No se pudo cargar.');
    showAlert(history.alert, err);
  }
}

async function loadPhones() {
  const lookup = ++phones.lookups;
  phones.alert.hidden = true;
  try {
    const rows = await api(`/api/reports/account-phones?${query({ iban: phones.iban.value })}`);
    if (lookup !== phones.lookups) return;
    fillRows(
      phones.rows,
      rows.map((row) =>
        el(
          'tr',
          {},
          el('td', {}, formatPhone(row.number)),
          el('td', {}, tag('Afiliado', 'ok')),
          el('td', { class: 'mono' }, row.enrolledAt.slice(0, 16)),
        ),
      ),
      'Sin teléfonos afiliados a esta cuenta.',
    );
  } catch (err) {
    if (lookup !== phones.lookups) return;
    fillRows(phones.rows, [], 'No se pudo cargar.');
    showAlert(phones.alert, err);
  }
}
