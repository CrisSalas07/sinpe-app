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
import { compactName, formatPhone, searchText, shortIban, titleCase } from './format.js';
import { initLayout } from './layout.js';

const listView = document.getElementById('list-view');
const enrollView = document.getElementById('enroll-view');
const rows = document.getElementById('rows');
const search = document.getElementById('search');
const listAlert = document.getElementById('list-alert');
const enrollForm = document.getElementById('enroll-form');
const enrollOk = document.getElementById('enroll-ok');
const unenrollDialog = document.getElementById('unenroll-dialog');
const unenrollForm = document.getElementById('unenroll-form');
const changeDialog = document.getElementById('change-dialog');
const changeForm = document.getElementById('change-form');

let enrollments = [];
let selected = null; // enrollment shown in the open modal
const openGroups = new Set(); // owners unfolded in the list, kept across reloads
const phonesById = new Map();
const accountsById = new Map();

await initLayout('sinpe', 'ADMIN');
window.addEventListener('hashchange', showView);
search.addEventListener('input', renderRows);
enrollForm.addEventListener('submit', onEnroll);
unenrollForm.addEventListener('submit', onUnenroll);
changeForm.addEventListener('submit', onChangeAccount);
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}
await reloadAll();
showView();

function alertOf(form) {
  return form.querySelector('.alert-bad');
}

// "Afiliar a SINPE Móvil" is a separate view of this page, reached with #afiliar.
function showView() {
  const showForm = location.hash === '#afiliar';
  listView.hidden = showForm;
  enrollView.hidden = !showForm;
  if (showForm) {
    enrollOk.hidden = true;
    clearFormErrors(enrollForm, alertOf(enrollForm));
    enrollForm.elements.phoneId.focus();
  }
}

async function loadEnrollments() {
  try {
    const [list, stats] = await Promise.all([api('/api/sinpe'), api('/api/sinpe/stats')]);
    enrollments = list.map((item) => ({
      ...item,
      search: searchText(
        item.number,
        formatPhone(item.number),
        compactName(item.ownerNames, item.ownerFirstSurname),
        item.iban,
      ),
    }));
    document.getElementById('stat-enrolled').textContent = stats.enrolled;
    document.getElementById('stat-not-enrolled').textContent = stats.notEnrolled;
    document.getElementById('sub-not-enrolled').textContent = stats.notEnrolled;
    document.getElementById('stat-events').textContent = stats.events;
    listAlert.hidden = true;
    renderRows();
  } catch (err) {
    fillRows(rows, [], 'No se pudo cargar.');
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

// Selects list every phone and account of the entity, each with its state (Cristopher's decision): the database
// triggers and procedures reject invalid combinations, as the Figma error screens show.
async function loadOptions() {
  try {
    const [phones, accounts] = await Promise.all([
      api('/api/phones/options'),
      api('/api/accounts'),
    ]);
    for (const phone of phones) phonesById.set(phone.id, phone);
    for (const account of accounts) accountsById.set(account.id, account);
    // Reloaded after every write: keep what the admin had selected.
    const keep = [enrollForm, changeForm].map((form) => ({
      form,
      phoneId: form.elements.phoneId?.value,
      accountId: form.elements.accountId.value,
    }));
    enrollForm.elements.phoneId.replaceChildren(
      ...phones.map((phone) =>
        el(
          'option',
          { value: phone.id },
          `${phone.number} · ${compactName(phone.ownerNames, phone.ownerFirstSurname)} · ${phone.enrolled ? 'afiliado' : 'no afiliado'}`,
        ),
      ),
    );
    // The owner instead of the bank code (always the session entity): the admin can see whose
    // account it is, while every account stays listed so the database rejections can be shown.
    const accountOptions = () =>
      accounts.map((account) =>
        el(
          'option',
          { value: account.id },
          `${shortIban(account.iban)} · ${compactName(account.holderNames, account.holderFirstSurname)} · ${account.currency} · ${account.status}`,
        ),
      );
    enrollForm.elements.accountId.replaceChildren(...accountOptions());
    changeForm.elements.accountId.replaceChildren(...accountOptions());
    for (const { form, phoneId, accountId } of keep) {
      if (phoneId) form.elements.phoneId.value = phoneId;
      if (accountId) form.elements.accountId.value = accountId;
    }
  } catch (err) {
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

function actions(item) {
  const change = el('button', { type: 'button', class: 'chip' }, 'Cambiar de cuenta');
  change.addEventListener('click', () => openChange(item));
  const unenroll = el('button', { type: 'button', class: 'chip' }, 'Desafiliar');
  unenroll.addEventListener('click', () => openUnenroll(item));
  return el('div', { class: 'row-actions' }, change, unenroll);
}

/** The account when all of an owner's phones share it, as usual; otherwise how many. */
function accountSummary(owned) {
  const ibans = new Set(owned.map((item) => item.iban));
  return ibans.size === 1
    ? el('span', { class: 'mono' }, shortIban(owned[0].iban))
    : count(ibans.size, 'cuenta', 'cuentas');
}

/** The IBAN of an enrollment, with a red tag when its account is not ACTIVA. */
function ibanCell(item) {
  const iban = el('span', { class: 'mono' }, shortIban(item.iban));
  if (item.accountStatus === 'ACTIVA') return iban;
  return el('span', {}, iban, ' ', tag(titleCase(item.accountStatus), 'bad'));
}

// One row per owner; their enrollments (with their actions) unfold below it.
function renderRows() {
  const query = searchText(search.value.trim());
  const visible = enrollments.filter((item) => item.search.includes(query));
  const groups = groupBy(visible, (item) => item.ownerId).map((owned) => ({
    key: owned[0].ownerId,
    label: compactName(owned[0].ownerNames, owned[0].ownerFirstSurname),
    summary: [count(owned.length, 'teléfono', 'teléfonos'), accountSummary(owned), ''],
    items: owned.map((item) => [formatPhone(item.number), ibanCell(item), actions(item)]),
  }));
  fillRows(rows, groupedRows(groups, openGroups, query !== ''), 'Sin resultados.');
}

function phoneSummary(item) {
  return `${formatPhone(item.number)} · ${compactName(item.ownerNames, item.ownerFirstSurname)}`;
}

function fillModal(dialog, values) {
  for (const [key, value] of Object.entries(values)) {
    dialog.querySelector(`[data-value="${key}"]`).textContent = value;
  }
}

function openUnenroll(item) {
  selected = item;
  clearFormErrors(unenrollForm, alertOf(unenrollForm));
  document.getElementById('unenroll-title').textContent =
    `¿Desafiliar ${formatPhone(item.number)}?`;
  fillModal(unenrollDialog, {
    phone: phoneSummary(item),
    account: `${shortIban(item.iban)} · ${item.bankCode}`,
    since: item.enrolledAt.slice(0, 16),
  });
  unenrollDialog.showModal();
}

function openChange(item) {
  selected = item;
  changeForm.reset();
  clearFormErrors(changeForm, alertOf(changeForm));
  document.getElementById('change-title').textContent =
    `Cambiar cuenta de ${formatPhone(item.number)}`;
  fillModal(changeDialog, {
    phone: phoneSummary(item),
    account: `${shortIban(item.iban)} · ${item.bankCode} · ${item.currency}`,
  });
  changeDialog.showModal();
}

/** Disables the submit button while the request runs; shows API errors in the form. */
async function submit(form, request) {
  const button = form.querySelector('button[type="submit"]');
  clearFormErrors(form, alertOf(form));
  button.disabled = true;
  try {
    await request();
    return true;
  } catch (err) {
    showFormError(form, alertOf(form), err);
    return false;
  } finally {
    button.disabled = false;
  }
}

async function onEnroll(event) {
  event.preventDefault();
  enrollOk.hidden = true;
  const phone = phonesById.get(Number(enrollForm.elements.phoneId.value));
  const account = accountsById.get(Number(enrollForm.elements.accountId.value));
  // With an empty select the ids are missing and the server answers which field to fill.
  const ok = await submit(enrollForm, () =>
    api('/api/sinpe', { method: 'POST', body: { phoneId: phone?.id, accountId: account?.id } }),
  );
  if (!ok) return;
  // 11 Éxito: stay on the form with a confirmation, and refresh everything from the database.
  enrollOk.textContent = `${formatPhone(phone.number)} quedó afiliado a la cuenta ${shortIban(account.iban)}. Se registró el evento AFILIACION en el historial.`;
  enrollOk.hidden = false;
  await reloadAll();
}

/** After every write: the list, the stats and the "afiliado / no afiliado" of the selects. */
function reloadAll() {
  return Promise.all([loadEnrollments(), loadOptions()]);
}

async function onUnenroll(event) {
  event.preventDefault();
  const ok = await submit(unenrollForm, () =>
    api(`/api/sinpe/${selected.number}`, { method: 'DELETE' }),
  );
  if (!ok) return;
  unenrollDialog.close();
  await reloadAll();
}

async function onChangeAccount(event) {
  event.preventDefault();
  const ok = await submit(changeForm, () =>
    api(`/api/sinpe/${selected.phoneId}/account`, {
      method: 'PUT',
      body: { accountId: Number(changeForm.elements.accountId.value) },
    }),
  );
  if (!ok) return;
  changeDialog.close();
  await reloadAll();
}
