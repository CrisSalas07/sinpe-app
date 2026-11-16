import { accountCard, enrolledCard } from './account-views.js';
import { api } from './api.js';
import { el, fillRows, tag } from './dom.js';
import { formatMoney } from './format.js';
import { initLayout } from './layout.js';

const $ = (id) => document.getElementById(id);

const user = await initLayout('home', 'CLIENTE');
$('greeting').textContent = `Hola, ${user.displayName}`;

try {
  const [summary, accounts, enrolled, movements] = await Promise.all([
    api('/api/me/summary'),
    api('/api/me/accounts'),
    api('/api/me/enrolled-accounts'),
    api('/api/me/recent-movements'),
  ]);
  $('stat-accounts').textContent = summary.accounts;
  $('stat-phones').textContent = summary.phones;
  $('stat-enrolled').textContent = summary.enrolled;
  $('accounts').replaceChildren(...accounts.map((a) => accountCard(a, user.entityCode)));
  $('enrolled').replaceChildren(...enrolled.map(enrolledCard));
  $('enrolled-empty').hidden = enrolled.length > 0;
  fillRows($('movement-rows'), movements.map(movementRow), 'Sin movimientos.');
} catch (err) {
  fillRows($('movement-rows'), [], 'No se pudo cargar.');
  $('page-alert').textContent = err.message;
  $('page-alert').hidden = false;
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
