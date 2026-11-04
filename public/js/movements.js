import { api } from './api.js';
import { el, tag } from './dom.js';
import { accountLabel, counterpartName, formatMoney } from './format.js';
import { initLayout } from './layout.js';

const $ = (id) => document.getElementById(id);
const iban = $('movements-iban');
const from = $('movements-from');
const to = $('movements-to');
const rows = $('movements-rows');
const alertBox = $('movements-alert');

const currencyByIban = new Map();

await initLayout('movements', 'CLIENTE');
setCurrentMonth();
for (const input of [iban, from, to]) input.addEventListener('change', loadMovements);

// The report loads as soon as a value changes: the Figma has no "Consultar" button.
if (await loadAccounts()) await loadMovements();

/** Default period: the current month, in the browser's local time zone. */
function setCurrentMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  // Swedish locale formats dates as YYYY-MM-DD.
  from.value = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('sv-SE');
  to.value = lastDay.toLocaleDateString('sv-SE');
}

function showError(err) {
  alertBox.textContent = err.message;
  alertBox.hidden = false;
}

async function loadAccounts() {
  try {
    const accounts = await api('/api/me/accounts');
    for (const account of accounts) currencyByIban.set(account.iban, account.currency);
    iban.replaceChildren(
      ...accounts.map((account) =>
        el('option', { value: account.iban }, accountLabel(account.iban, account.currency)),
      ),
    );
    return accounts.length > 0;
  } catch (err) {
    showError(err);
    return false;
  }
}

function emptyRow() {
  return el('tr', {}, el('td', { class: 'table-empty', colspan: 4 }, 'Sin movimientos.'));
}

function movementRow(row, currency) {
  return el(
    'tr',
    {},
    el('td', {}, row.date.slice(0, 16)),
    el('td', {}, row.direction === 'ENVIADA' ? tag('Enviada', 'neutral') : tag('Recibida', 'ok')),
    el('td', {}, counterpartName(row.counterpart)),
    el('td', {}, formatMoney(row.amount, currency)),
  );
}

async function loadMovements() {
  const currency = currencyByIban.get(iban.value);
  alertBox.hidden = true;
  try {
    const params = new URLSearchParams({ iban: iban.value, from: from.value, to: to.value });
    const result = await api(`/api/me/movements?${params}`);
    rows.replaceChildren(
      ...(result.movements.length > 0
        ? result.movements.map((row) => movementRow(row, currency))
        : [emptyRow()]),
    );
    $('total-sent').textContent = formatMoney(result.totals.sent, currency);
    $('total-received').textContent = formatMoney(result.totals.received, currency);
  } catch (err) {
    rows.replaceChildren();
    $('total-sent').textContent = '';
    $('total-received').textContent = '';
    showError(err);
  }
}
