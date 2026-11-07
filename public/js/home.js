import { api } from './api.js';
import { el, fillRows, tag } from './dom.js';
import { accountType, formatMoney, titleCase } from './format.js';
import { initLayout } from './layout.js';

const STATUS_TAGS = { ACTIVA: 'ok', INACTIVA: 'neutral', BLOQUEADA: 'bad' };

const $ = (id) => document.getElementById(id);

const user = await initLayout('home', 'CLIENTE');
$('greeting').textContent = `Hola, ${user.displayName}`;

try {
  const [summary, accounts, movements] = await Promise.all([
    api('/api/me/summary'),
    api('/api/me/accounts'),
    api('/api/me/recent-movements'),
  ]);
  $('stat-accounts').textContent = summary.accounts;
  $('stat-phones').textContent = summary.phones;
  $('stat-enrolled').textContent = summary.enrolled;
  $('accounts').replaceChildren(...accounts.map(accountCard));
  fillRows($('movement-rows'), movements.map(movementRow), 'Sin movimientos.');
} catch (err) {
  fillRows($('movement-rows'), [], 'No se pudo cargar.');
  $('page-alert').textContent = err.message;
  $('page-alert').hidden = false;
}

function accountCard(account) {
  return el(
    'div',
    { class: 'acct-card' },
    el('div', { class: 'acct-label' }, accountType(account.currency)),
    el('div', { class: 'mono acct-iban' }, account.iban),
    el('div', { class: 'acct-amount' }, formatMoney(account.balance, account.currency)),
    el(
      'div',
      { class: 'tags' },
      tag(titleCase(account.status), STATUS_TAGS[account.status]),
      tag(account.currency, 'neutral'),
    ),
  );
}

function movementRow(row) {
  return el(
    'tr',
    {},
    el('td', {}, row.date.slice(0, 16)),
    el('td', {}, row.direction === 'ENVIADA' ? tag('Enviada', 'neutral') : tag('Recibida', 'ok')),
    el('td', {}, row.counterpart),
    el('td', {}, formatMoney(row.amount, row.currency)),
  );
}
