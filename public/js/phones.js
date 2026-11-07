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
  edit: document.getElementById('edit-view'),
};
const rows = document.getElementById('rows');
const search = document.getElementById('search');
const listAlert = document.getElementById('list-alert');
const listOk = document.getElementById('list-ok');
const editForm = document.getElementById('edit-form');

let phones = [];
let editingNumber = null;
const openGroups = new Set(); // owners unfolded in the list, kept across reloads

await initLayout('phones', 'ADMIN');
window.addEventListener('hashchange', showView);
search.addEventListener('input', () => {
  listOk.hidden = true; // the confirmation is about the last edit, not about what is now listed
  renderRows();
});
editForm.addEventListener('submit', onEdit);
await Promise.all([loadPhones(), loadOwners()]);
showView();

function ownerLabel(identification, names, first, second) {
  return `${identification} · ${fullName(names, first, second)}`;
}

function alertOf(form) {
  return form.querySelector('.alert');
}

// Views of this page: list and "#editar/<number>".
function showView() {
  const editMatch = location.hash.match(/^#editar\/(\d{8})$/);
  const phone = editMatch && phones.find((p) => p.number === editMatch[1]);
  const view = phone ? 'edit' : 'list';
  for (const [name, node] of Object.entries(views)) node.hidden = name !== view;

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
    const clients = await api('/api/clients');
    editForm.elements.identification.replaceChildren(
      ...clients
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
        ),
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
    const moved = phones.find((phone) => phone.number === number);
    if (moved) {
      listOk.textContent = `${formatPhone(number)} ahora pertenece a ${compactName(moved.ownerNames, moved.ownerFirstSurname)}.`;
      listOk.hidden = false;
    }
  } catch (err) {
    showFormError(editForm, alertOf(editForm), err);
  } finally {
    submit.disabled = false;
  }
}
