import { api } from './api.js';
import { el, tag } from './dom.js';
import { compactName, formatPhone, shortIban } from './format.js';
import { initLayout } from './layout.js';

const $ = (id) => document.getElementById(id);
const history = { number: $('history-number'), rows: $('history-rows'), alert: $('history-alert') };
const phones = { iban: $('phones-iban'), rows: $('phones-rows'), alert: $('phones-alert') };

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
  history.alert.hidden = true;
  try {
    const rows = await api(
      `/api/reports/enrollment-history?${query({ number: history.number.value })}`,
    );
    history.rows.replaceChildren(
      ...rows.map((row) =>
        el(
          'tr',
          {},
          el('td', {}, row.date.slice(0, 16)),
          el('td', {}, tag(row.action, row.action === 'AFILIACION' ? 'ok' : 'bad')),
          el('td', { class: 'mono' }, shortIban(row.iban)),
        ),
      ),
    );
  } catch (err) {
    history.rows.replaceChildren();
    showAlert(history.alert, err);
  }
}

async function loadPhones() {
  phones.alert.hidden = true;
  try {
    const rows = await api(`/api/reports/account-phones?${query({ iban: phones.iban.value })}`);
    phones.rows.replaceChildren(
      ...rows.map((row) =>
        el(
          'tr',
          {},
          el('td', {}, formatPhone(row.number)),
          el('td', {}, tag('Afiliado', 'ok')),
          el('td', { class: 'mono' }, row.enrolledAt.slice(0, 16)),
        ),
      ),
    );
  } catch (err) {
    phones.rows.replaceChildren();
    showAlert(phones.alert, err);
  }
}
