import { api } from './api.js';
import { clearFormErrors, el, showFormError, tag } from './dom.js';
import { compactName, fullName, searchText, titleCase } from './format.js';
import { initLayout } from './layout.js';

const listView = document.getElementById('list-view');
const formView = document.getElementById('form-view');
const rows = document.getElementById('rows');
const search = document.getElementById('search');
const listAlert = document.getElementById('list-alert');
const form = document.getElementById('client-form');
const formAlert = document.getElementById('form-alert');
const submit = form.querySelector('button[type="submit"]');

let clients = [];

const user = await initLayout('clients', 'ADMIN');
document.getElementById('status-note').textContent =
  `El cliente se crea con estado ACTIVO en ${user.entityName}.`;
window.addEventListener('hashchange', showView);
search.addEventListener('input', renderRows);
form.addEventListener('submit', onSubmit);
showView();
await loadClients();

// "Registrar cliente" is a separate view of this page, reached with #registrar.
function showView() {
  const showForm = location.hash === '#registrar';
  listView.hidden = showForm;
  formView.hidden = !showForm;
  if (showForm) {
    form.reset();
    clearFormErrors(form, formAlert);
    form.elements.identification.focus();
  }
}

async function loadClients() {
  try {
    const [list, stats] = await Promise.all([api('/api/clients'), api('/api/clients/stats')]);
    clients = list.map((client) => ({
      ...client,
      search: searchText(
        client.identification,
        fullName(client.names, client.firstSurname, client.secondSurname),
        client.email,
        client.username,
      ),
    }));
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-active').textContent = stats.active;
    document.getElementById('stat-with-accounts').textContent = stats.withAccounts;
    listAlert.hidden = true;
    renderRows();
  } catch (err) {
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

function renderRows() {
  const query = searchText(search.value.trim());
  const visible = clients.filter((client) => client.search.includes(query));
  rows.replaceChildren(
    ...visible.map((client) =>
      el(
        'tr',
        {},
        el('td', {}, client.identification),
        el('td', {}, compactName(client.names, client.firstSurname)),
        el('td', { class: 'clip', title: client.email }, client.email),
        el('td', {}, client.username),
        el('td', {}, client.accounts),
        el('td', {}, client.phones),
        el('td', {}, tag(titleCase(client.status), client.status === 'ACTIVO' ? 'ok' : 'neutral')),
      ),
    ),
  );
}

async function onSubmit(event) {
  event.preventDefault();
  clearFormErrors(form, formAlert);
  submit.disabled = true;

  const fields = form.elements;
  try {
    await api('/api/clients', {
      method: 'POST',
      body: {
        identification: fields.identification.value.trim(),
        names: fields.names.value.trim(),
        firstSurname: fields.firstSurname.value.trim(),
        secondSurname: fields.secondSurname.value.trim(),
        email: fields.email.value.trim(),
        username: fields.username.value.trim(),
        password: fields.password.value,
      },
    });
    // Back to the list, re-read from the database.
    location.hash = '';
    await loadClients();
  } catch (err) {
    showFormError(form, formAlert, err);
  } finally {
    submit.disabled = false;
  }
}
