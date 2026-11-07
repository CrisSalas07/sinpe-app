import { api } from './api.js';
import { clearFormErrors, el, fillRows, showFormError, tag } from './dom.js';
import { compactName, formatMoney, fullName, searchText, titleCase } from './format.js';
import { initLayout } from './layout.js';

const STATUS_TAGS = { ACTIVA: 'ok', INACTIVA: 'neutral', BLOQUEADA: 'bad' };

const listView = document.getElementById('list-view');
const formView = document.getElementById('form-view');
const rows = document.getElementById('rows');
const search = document.getElementById('search');
const listAlert = document.getElementById('list-alert');
const form = document.getElementById('account-form');
const formAlert = document.getElementById('form-alert');
const submit = form.querySelector('button[type="submit"]');

let accounts = [];

const user = await initLayout('accounts', 'ADMIN');
// defaultValue survives form.reset().
document.getElementById('entity').defaultValue = `${user.entityName} (${user.entityCode})`;
document.getElementById('iban-help').textContent =
  `22 caracteres: CR + 2 dígitos + 0${user.entityIbanCode} (código ${user.entityCode}) + 14 dígitos.`;
window.addEventListener('hashchange', showView);
search.addEventListener('input', renderRows);
form.addEventListener('submit', onSubmit);
await Promise.all([loadAccounts(), loadFormOptions()]);
showView();

// "Registrar cuenta" is a separate view of this page, reached with #registrar.
function showView() {
  const showForm = location.hash === '#registrar';
  listView.hidden = showForm;
  formView.hidden = !showForm;
  if (showForm) {
    form.reset();
    // Swedish locale formats dates as YYYY-MM-DD, in the browser's local time zone.
    form.elements.openedAt.value = new Date().toLocaleDateString('sv-SE');
    clearFormErrors(form, formAlert);
    form.elements.clientId.focus();
  }
}

async function loadAccounts() {
  try {
    const [list, stats] = await Promise.all([api('/api/accounts'), api('/api/accounts/stats')]);
    accounts = list.map((account) => ({
      ...account,
      search: searchText(
        account.iban,
        fullName(account.holderNames, account.holderFirstSurname, account.holderSecondSurname),
        account.currency,
        account.status,
      ),
    }));
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-active').textContent = stats.active;
    document.getElementById('stat-crc').textContent = stats.crc;
    listAlert.hidden = true;
    renderRows();
  } catch (err) {
    fillRows(rows, [], 'No se pudo cargar.');
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

async function loadFormOptions() {
  try {
    const [clients, currencies] = await Promise.all([
      api('/api/clients'),
      api('/api/catalogs/currencies'),
    ]);
    // Only active clients can own a new account; sp_registrar_cuenta still validates it.
    form.elements.clientId.replaceChildren(
      ...clients
        .filter((client) => client.status === 'ACTIVO')
        .map((client) =>
          el(
            'option',
            { value: client.id },
            `${client.identification} · ${fullName(client.names, client.firstSurname, client.secondSurname)}`,
          ),
        ),
    );
    form.elements.currency.replaceChildren(
      ...currencies.map((currency) =>
        el('option', { value: currency.code }, `${currency.code} · ${currency.description}`),
      ),
    );
  } catch (err) {
    showFormError(form, formAlert, err);
  }
}

function renderRows() {
  const query = searchText(search.value.trim());
  const visible = accounts.filter((account) => account.search.includes(query));
  fillRows(
    rows,
    visible.map((account) =>
      el(
        'tr',
        {},
        el('td', { class: 'mono' }, account.iban),
        el('td', {}, compactName(account.holderNames, account.holderFirstSurname)),
        el('td', {}, account.currency),
        el('td', {}, formatMoney(account.balance, account.currency)),
        el('td', {}, tag(titleCase(account.status), STATUS_TAGS[account.status])),
      ),
    ),
    'Sin resultados.',
  );
}

async function onSubmit(event) {
  event.preventDefault();
  clearFormErrors(form, formAlert);
  submit.disabled = true;

  const fields = form.elements;
  try {
    await api('/api/accounts', {
      method: 'POST',
      body: {
        clientId: Number(fields.clientId.value),
        currency: fields.currency.value,
        iban: fields.iban.value.trim().toUpperCase(),
        balance: fields.balance.value.trim(),
        openedAt: fields.openedAt.value,
      },
    });
    // Back to the list, re-read from the database.
    location.hash = '';
    await loadAccounts();
  } catch (err) {
    showFormError(form, formAlert, err);
  } finally {
    submit.disabled = false;
  }
}
