import { api } from './api.js';
import { clearFormErrors, el, showFormError, tag } from './dom.js';
import { compactName, formatPhone, fullName, ibanTail, searchText } from './format.js';
import { initLayout } from './layout.js';

const views = {
  list: document.getElementById('list-view'),
  register: document.getElementById('register-view'),
  edit: document.getElementById('edit-view'),
};
const rows = document.getElementById('rows');
const search = document.getElementById('search');
const listAlert = document.getElementById('list-alert');
const registerForm = document.getElementById('register-form');
const editForm = document.getElementById('edit-form');

let phones = [];
let editingNumber = null;

await initLayout('phones');
window.addEventListener('hashchange', showView);
search.addEventListener('input', renderRows);
registerForm.addEventListener('submit', onRegister);
editForm.addEventListener('submit', onEdit);
// "Input fields take digits only."
registerForm.elements.number.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '');
});
await Promise.all([loadPhones(), loadOwners()]);
showView();

function ownerLabel(identification, names, first, second) {
  return `${identification} · ${fullName(names, first, second)}`;
}

function alertOf(form) {
  return form.querySelector('.alert');
}

// Views of this page: list, "#registrar" and "#editar/<number>".
function showView() {
  const editMatch = location.hash.match(/^#editar\/(\d{8})$/);
  const phone = editMatch && phones.find((p) => p.number === editMatch[1]);
  const view = location.hash === '#registrar' ? 'register' : phone ? 'edit' : 'list';
  for (const [name, node] of Object.entries(views)) node.hidden = name !== view;

  if (view === 'register') {
    registerForm.reset();
    clearFormErrors(registerForm, alertOf(registerForm));
    registerForm.elements.identification.focus();
  } else if (view === 'edit') {
    editingNumber = phone.number;
    editForm.reset();
    clearFormErrors(editForm, alertOf(editForm));
    editForm.elements.number.value = phone.number;
    editForm.elements.currentOwner.value = ownerLabel(
      phone.ownerIdentification,
      phone.ownerNames,
      phone.ownerFirstSurname,
      phone.ownerSecondSurname,
    );
    editForm.elements.identification.value = phone.ownerIdentification;
    editForm.elements.identification.focus();
  }
}

async function loadPhones() {
  try {
    const [list, stats] = await Promise.all([api('/api/phones'), api('/api/phones/stats')]);
    phones = list.map((phone) => ({
      ...phone,
      search: searchText(
        phone.number,
        formatPhone(phone.number),
        fullName(phone.ownerNames, phone.ownerFirstSurname, phone.ownerSecondSurname),
        phone.enrolledIban ? 'afiliado' : 'no afiliado',
        phone.enrolledIban ?? '',
      ),
    }));
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-enrolled').textContent = stats.enrolled;
    document.getElementById('stat-not-enrolled').textContent = stats.notEnrolled;
    listAlert.hidden = true;
    renderRows();
  } catch (err) {
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

// Both selects list only active clients; the database still validates the owner.
async function loadOwners() {
  try {
    const clients = await api('/api/clients');
    const options = () =>
      clients
        .filter((client) => client.status === 'ACTIVO')
        .map((client) =>
          el(
            'option',
            { value: client.identification },
            ownerLabel(
              client.identification,
              client.names,
              client.firstSurname,
              client.secondSurname,
            ),
          ),
        );
    registerForm.elements.identification.replaceChildren(...options());
    editForm.elements.identification.replaceChildren(...options());
  } catch (err) {
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

function renderRows() {
  const query = searchText(search.value.trim());
  const visible = phones.filter((phone) => phone.search.includes(query));
  rows.replaceChildren(
    ...visible.map((phone) =>
      el(
        'tr',
        {},
        el('td', {}, formatPhone(phone.number)),
        el('td', {}, compactName(phone.ownerNames, phone.ownerFirstSurname)),
        el('td', {}, phone.enrolledIban ? tag('Afiliado', 'ok') : tag('No afiliado', 'neutral')),
        el('td', { class: 'mono' }, phone.enrolledIban ? ibanTail(phone.enrolledIban) : '—'),
        el(
          'td',
          {},
          el(
            'a',
            {
              class: 'chip',
              href: `#editar/${phone.number}`,
              'aria-label': `Editar ${formatPhone(phone.number)}`,
            },
            'Editar',
          ),
        ),
      ),
    ),
  );
}

/** Submits a form, then goes back to the list and re-reads it from the database. */
async function submitAndReload(form, request) {
  const submit = form.querySelector('button[type="submit"]');
  clearFormErrors(form, alertOf(form));
  submit.disabled = true;
  try {
    await request();
    location.hash = '';
    await loadPhones();
  } catch (err) {
    showFormError(form, alertOf(form), err);
  } finally {
    submit.disabled = false;
  }
}

function onRegister(event) {
  event.preventDefault();
  const fields = registerForm.elements;
  return submitAndReload(registerForm, () =>
    api('/api/phones', {
      method: 'POST',
      body: { identification: fields.identification.value, number: fields.number.value },
    }),
  );
}

function onEdit(event) {
  event.preventDefault();
  return submitAndReload(editForm, () =>
    api(`/api/phones/${editingNumber}/owner`, {
      method: 'PUT',
      body: { identification: editForm.elements.identification.value },
    }),
  );
}
