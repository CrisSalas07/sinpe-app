import { api } from './api.js';
import {
  clearFormErrors,
  count,
  el,
  fillRows,
  groupBy,
  groupedRows,
  showFormError,
  tag,
} from './dom.js';
import { compactName, formatPhone, fullName, searchText } from './format.js';
import { initLayout } from './layout.js';

const views = {
  list: document.getElementById('list-view'),
  register: document.getElementById('register-view'),
  edit: document.getElementById('edit-view'),
};
const registerForm = document.getElementById('register-form');
const rows = document.getElementById('rows');
const search = document.getElementById('search');
const listAlert = document.getElementById('list-alert');
const listOk = document.getElementById('list-ok');
const editForm = document.getElementById('edit-form');

let phones = [];
let editingNumber = null;
const identificationById = new Map(); // client id → identification, the group key of the list
const openGroups = new Set(); // owners unfolded in the list, kept across reloads

await initLayout('phones', 'ADMIN');
window.addEventListener('hashchange', showView);
search.addEventListener('input', () => {
  listOk.hidden = true; // the confirmation is about the last edit, not about what is now listed
  renderRows();
});
editForm.addEventListener('submit', onEdit);
registerForm.addEventListener('submit', onRegister);
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
  const view = phone ? 'edit' : location.hash === '#registrar' ? 'register' : 'list';
  for (const [name, node] of Object.entries(views)) node.hidden = name !== view;

  if (view === 'register') {
    listOk.hidden = true;
    registerForm.reset();
    clearFormErrors(registerForm, alertOf(registerForm));
    registerForm.elements.clientId.focus();
  }

  if (view === 'edit') {
    listOk.hidden = true;
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
        phone.enrolled ? 'afiliado' : 'no afiliado',
        phone.enrolledIban ?? '',
      ),
    }));
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-enrolled').textContent = stats.enrolled;
    document.getElementById('stat-not-enrolled').textContent = stats.notEnrolled;
    listAlert.hidden = true;
    renderRows();
  } catch (err) {
    fillRows(rows, [], 'No se pudo cargar.');
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

// Lists only active clients of the entity; the database still validates the owner.
async function loadOwners() {
  try {
    const active = (await api('/api/clients')).filter((client) => client.status === 'ACTIVO');
    const label = (client) =>
      ownerLabel(client.identification, client.names, client.firstSurname, client.secondSurname);
    for (const client of active) identificationById.set(client.id, client.identification);
    // Editar sends the identification (sp_cambiar_titular_telefono); Registrar sends the client id.
    editForm.elements.identification.replaceChildren(
      ...active.map((client) => el('option', { value: client.identification }, label(client))),
    );
    registerForm.elements.clientId.replaceChildren(
      ...active.map((client) => el('option', { value: client.id }, label(client))),
    );
  } catch (err) {
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

// The full IBAN, as in Cuentas IBAN, so the account can be recognised ('…001' alone could not).
function enrolledAccount(phone) {
  return phone.enrolledIban ?? '—';
}

function enrolledSummary(owned) {
  const enrolled = owned.filter((phone) => phone.enrolled).length;
  return enrolled === 0 ? 'Sin afiliar' : count(enrolled, 'afiliado', 'afiliados');
}

// One row per owner; their phones (with "Editar") unfold below it.
function renderRows() {
  const query = searchText(search.value.trim());
  const visible = phones.filter((phone) => phone.search.includes(query));
  const groups = groupBy(visible, (phone) => phone.ownerIdentification).map((owned) => ({
    key: owned[0].ownerIdentification,
    label: compactName(owned[0].ownerNames, owned[0].ownerFirstSurname),
    summary: [count(owned.length, 'teléfono', 'teléfonos'), enrolledSummary(owned), '', ''],
    items: owned.map((phone) => [
      formatPhone(phone.number),
      phone.enrolled ? tag('Afiliado', 'ok') : tag('No afiliado', 'neutral'),
      el('span', { class: phone.enrolledIban ? 'mono' : null }, enrolledAccount(phone)),
      el(
        'a',
        {
          class: 'chip',
          href: `#editar/${phone.number}`,
          'aria-label': `Editar ${formatPhone(phone.number)}`,
        },
        'Editar',
      ),
    ]),
  }));
  fillRows(rows, groupedRows(groups, openGroups, query !== ''), 'Sin resultados.');
}

/**
 * Changes the owner, then goes back to the list re-read from the database, with the new owner's
 * group open and a confirmation, so it is clear the change was saved and where the phone went.
 */
async function onEdit(event) {
  event.preventDefault();
  const submit = editForm.querySelector('button[type="submit"]');
  const number = editingNumber;
  const identification = editForm.elements.identification.value;
  clearFormErrors(editForm, alertOf(editForm));

  const current = phones.find((phone) => phone.number === number);
  if (identification === current?.ownerIdentification) {
    return showFormError(editForm, alertOf(editForm), {
      field: 'identification',
      message: 'Seleccione un titular distinto del actual.',
    });
  }

  submit.disabled = true;
  try {
    await api(`/api/phones/${number}/owner`, { method: 'PUT', body: { identification } });
    openGroups.add(identification);
    location.hash = '';
    await loadPhones();
    confirmInList(number, 'ahora pertenece a');
  } catch (err) {
    showFormError(editForm, alertOf(editForm), err);
  } finally {
    submit.disabled = false;
  }
}

/** Shows the green confirmation above the list, with the owner's group open. */
function confirmInList(number, verb) {
  const phone = phones.find((p) => p.number === number);
  if (!phone) return;
  listOk.textContent = `${formatPhone(number)} ${verb} ${compactName(phone.ownerNames, phone.ownerFirstSurname)}.`;
  listOk.hidden = false;
}

/**
 * Admin "Registrar teléfono". sp_registrar_telefono checks that the owner is a client of this
 * entity and that the number is not registered (to this client or to anyone else).
 */
async function onRegister(event) {
  event.preventDefault();
  const submit = registerForm.querySelector('button[type="submit"]');
  const clientId = Number(registerForm.elements.clientId.value);
  const number = registerForm.elements.number.value;
  clearFormErrors(registerForm, alertOf(registerForm));
  submit.disabled = true;
  try {
    await api('/api/phones', { method: 'POST', body: { clientId, number } });
    openGroups.add(identificationById.get(clientId));
    location.hash = '';
    await loadPhones();
    confirmInList(number, 'quedó registrado a');
  } catch (err) {
    showFormError(registerForm, alertOf(registerForm), err);
  } finally {
    submit.disabled = false;
  }
}
