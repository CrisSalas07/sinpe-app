import { api } from './api.js';
import { el, tag } from './dom.js';
import { compactName, formatMoney, formatPhone, shortIban, titleCase } from './format.js';
import { initLayout } from './layout.js';

const $ = (id) => document.getElementById(id);
const movements = {
  iban: $('movements-iban'),
  from: $('movements-from'),
  to: $('movements-to'),
  rows: $('movements-rows'),
  alert: $('movements-alert'),
};
const history = { number: $('history-number'), rows: $('history-rows'), alert: $('history-alert') };
const phones = { iban: $('phones-iban'), rows: $('phones-rows'), alert: $('phones-alert') };

const currencyByIban = new Map();

await initLayout('reports');
setCurrentMonth();
for (const input of [movements.iban, movements.from, movements.to]) {
  input.addEventListener('change', loadMovements);
}
history.number.addEventListener('change', loadHistory);
phones.iban.addEventListener('change', loadPhones);

// Each report loads as soon as a value changes: the Figma has no "Consultar" button.
if (await loadOptions()) await Promise.all([loadMovements(), loadHistory(), loadPhones()]);

/** Default period: the current month, in the browser's local time zone. */
function setCurrentMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  // Swedish locale formats dates as YYYY-MM-DD.
  movements.from.value = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('sv-SE');
  movements.to.value = lastDay.toLocaleDateString('sv-SE');
}

async function loadOptions() {
  try {
    const [accountList, phoneList] = await Promise.all([api('/api/accounts'), api('/api/phones')]);
    const accountOptions = () =>
      accountList.map((account) =>
        el(
          'option',
          { value: account.iban },
          `${shortIban(account.iban)} · ${compactName(account.holderNames, account.holderFirstSurname)}`,
        ),
      );
    for (const account of accountList) currencyByIban.set(account.iban, account.currency);
    movements.iban.replaceChildren(...accountOptions());
    phones.iban.replaceChildren(...accountOptions());
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
    showAlert(movements.alert, err);
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

// sp_consultar_movimientos returns "NOMBRES PRIMER_APELLIDO": first name + surname, as elsewhere.
function counterpartName(fullText) {
  const words = fullText.split(' ');
  return titleCase(`${words[0]} ${words.at(-1)}`);
}

async function loadMovements() {
  const iban = movements.iban.value;
  const currency = currencyByIban.get(iban);
  movements.alert.hidden = true;
  try {
    const result = await api(
      `/api/reports/movements?${query({ iban, from: movements.from.value, to: movements.to.value })}`,
    );
    movements.rows.replaceChildren(
      ...result.movements.map((row) =>
        el(
          'tr',
          {},
          el('td', {}, row.date.slice(0, 16)),
          el(
            'td',
            {},
            row.direction === 'ENVIADA' ? tag('Enviada', 'neutral') : tag('Recibida', 'ok'),
          ),
          el('td', {}, counterpartName(row.counterpart)),
          el('td', {}, formatMoney(row.amount, currency)),
        ),
      ),
    );
    $('total-sent').textContent = formatMoney(result.totals.sent, currency);
    $('total-received').textContent = formatMoney(result.totals.received, currency);
  } catch (err) {
    movements.rows.replaceChildren();
    $('total-sent').textContent = '';
    $('total-received').textContent = '';
    showAlert(movements.alert, err);
  }
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
