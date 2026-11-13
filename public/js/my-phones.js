import { api } from './api.js';
import { clearFormErrors, el, entityBadge, fillRows, showFormError, tag } from './dom.js';
import { accountLabel, formatMoney, formatPhone } from './format.js';
import { initLayout } from './layout.js';

const listView = document.getElementById('list-view');
const formView = document.getElementById('form-view');
const rows = document.getElementById('rows');
const listAlert = document.getElementById('list-alert');
const listOk = document.getElementById('list-ok');
const form = document.getElementById('phone-form');
const formAlert = form.querySelector('.alert');
const submit = form.querySelector('button[type="submit"]');
const enrollDialog = document.getElementById('enroll-dialog');
const enrollForm = document.getElementById('enroll-form');
const enrollAlert = enrollForm.querySelector('.alert');

const unenrollDialog = document.getElementById('unenroll-dialog');
const unenrollForm = document.getElementById('unenroll-form');
const unenrollAlert = unenrollForm.querySelector('.alert');

let enrollNumber = null; // number shown in the "Afiliar a SINPE Móvil" modal
let unenrollNumber = null; // number shown in the "Desafiliar" modal

const user = await initLayout('my-phones', 'CLIENTE');
// defaultValue survives form.reset().
form.elements.owner.defaultValue = user.displayName;
window.addEventListener('hashchange', showView);
form.addEventListener('submit', onSubmit);
enrollForm.addEventListener('submit', onEnroll);
unenrollForm.addEventListener('submit', onUnenroll);
for (const dialog of [enrollDialog, unenrollDialog]) {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
}
// "Input fields take digits only."
form.elements.number.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '');
});
showView();
await loadPhones();

// "Registrar teléfono" is a separate view of this page, reached with #registrar.
function showView() {
  const showForm = location.hash === '#registrar';
  listView.hidden = showForm;
  formView.hidden = !showForm;
  if (showForm) {
    listOk.hidden = true;
    form.reset();
    clearFormErrors(form, formAlert);
    form.elements.number.focus();
  }
}

// The IBAN of an enrollment in another entity is not data of this one.
function enrolledAccount(phone) {
  if (phone.enrolledIban) return phone.enrolledIban; // full IBAN, as in Teléfonos
  if (!phone.enrolled) return '—';
  return el('span', { class: 'entity-line' }, 'Otra entidad', entityBadge(phone.enrolledBankCode));
}

function actionChip(text, label, onClick) {
  const chip = el('button', { type: 'button', class: 'chip', 'aria-label': label }, text);
  chip.addEventListener('click', onClick);
  return chip;
}

// Not enrolled: Afiliar. Enrolled here: Desafiliar. Enrolled in another entity: nothing, since
// only that entity can remove it (as in real banking; the procedures enforce it anyway).
function actions(phone) {
  const shown = formatPhone(phone.number);
  if (!phone.enrolled) {
    return actionChip('Afiliar a SINPE', `Afiliar ${shown}`, () => openEnroll(phone.number));
  }
  if (phone.enrolledIban) {
    return actionChip('Desafiliar', `Desafiliar ${shown}`, () => openUnenroll(phone));
  }
  return '';
}

async function loadPhones() {
  try {
    const phones = await api('/api/me/phones');
    fillRows(
      rows,
      phones.map((phone) =>
        el(
          'tr',
          {},
          el('td', {}, formatPhone(phone.number)),
          el('td', {}, phone.enrolled ? tag('Afiliado', 'ok') : tag('No afiliado', 'neutral')),
          el('td', { class: phone.enrolledIban ? 'mono' : null }, enrolledAccount(phone)),
          el('td', {}, phone.registeredAt.slice(0, 10)),
          el('td', {}, actions(phone)),
        ),
      ),
      'Sin teléfonos registrados.',
    );
    listAlert.hidden = true;
  } catch (err) {
    fillRows(rows, [], 'No se pudo cargar.');
    listAlert.textContent = err.message;
    listAlert.hidden = false;
  }
}

async function onSubmit(event) {
  event.preventDefault();
  clearFormErrors(form, formAlert);
  submit.disabled = true;
  try {
    await api('/api/me/phones', { method: 'POST', body: { number: form.elements.number.value } });
    // Back to the list, re-read from the database.
    const number = form.elements.number.value;
    location.hash = '';
    await loadPhones();
    listOk.textContent = `Se registró el teléfono ${formatPhone(number)}.`;
    listOk.hidden = false;
  } catch (err) {
    showFormError(form, formAlert, err);
  } finally {
    submit.disabled = false;
  }
}

// ---------- "Afiliar a SINPE Móvil" (modal) ----------

async function openEnroll(number) {
  enrollNumber = number;
  listOk.hidden = true;
  enrollForm.reset();
  clearFormErrors(enrollForm, enrollAlert);
  enrollForm.elements.number.value = formatPhone(number);
  const select = enrollForm.elements.iban;
  const button = enrollForm.querySelector('button[type="submit"]');
  select.replaceChildren(el('option', { value: '' }, 'Cargando…'));
  button.disabled = true;
  enrollDialog.showModal();

  try {
    // SINPE Móvil only pays into ACTIVE accounts in colones; the procedure checks it again.
    const accounts = (await api('/api/me/accounts')).filter(
      (account) => account.status === 'ACTIVA' && account.currency === 'CRC',
    );
    if (accounts.length === 0) {
      select.replaceChildren(el('option', { value: '' }, 'Sin cuentas disponibles'));
      showFormError(enrollForm, enrollAlert, {
        message: 'No tiene cuentas en colones ACTIVAS en esta entidad.',
        field: 'iban',
      });
      return;
    }
    select.replaceChildren(
      ...accounts.map((account) =>
        el(
          'option',
          { value: account.iban },
          `${accountLabel(account.iban, account.currency)} · ${formatMoney(account.balance, account.currency)}`,
        ),
      ),
    );
    button.disabled = false;
  } catch (err) {
    select.replaceChildren(el('option', { value: '' }, 'No se pudo cargar'));
    showFormError(enrollForm, enrollAlert, err);
  }
}

async function onEnroll(event) {
  event.preventDefault();
  const button = enrollForm.querySelector('button[type="submit"]');
  clearFormErrors(enrollForm, enrollAlert);
  button.disabled = true;
  try {
    await api('/api/me/sinpe', {
      method: 'POST',
      body: { number: enrollNumber, iban: enrollForm.elements.iban.value },
    });
    enrollDialog.close();
    await loadPhones();
    listOk.textContent = `El número ${formatPhone(enrollNumber)} quedó afiliado a SINPE Móvil.`;
    listOk.hidden = false;
  } catch (err) {
    showFormError(enrollForm, enrollAlert, err);
  } finally {
    button.disabled = false;
  }
}

// ---------- "Desafiliar" (modal) ----------

function openUnenroll(phone) {
  unenrollNumber = phone.number;
  listOk.hidden = true;
  clearFormErrors(unenrollForm, unenrollAlert);
  document.getElementById('unenroll-title').textContent =
    `¿Desafiliar ${formatPhone(phone.number)} de SINPE Móvil?`;
  unenrollDialog.querySelector('[data-value="number"]').textContent = formatPhone(phone.number);
  unenrollDialog.querySelector('[data-value="account"]').textContent = phone.enrolledIban;
  unenrollDialog.showModal();
}

async function onUnenroll(event) {
  event.preventDefault();
  const button = unenrollForm.querySelector('button[type="submit"]');
  clearFormErrors(unenrollForm, unenrollAlert);
  button.disabled = true;
  try {
    await api(`/api/me/sinpe/${unenrollNumber}`, { method: 'DELETE' });
    unenrollDialog.close();
    await loadPhones();
    listOk.textContent = `El número ${formatPhone(unenrollNumber)} se desafilió de SINPE Móvil.`;
    listOk.hidden = false;
  } catch (err) {
    showFormError(unenrollForm, unenrollAlert, err);
  } finally {
    button.disabled = false;
  }
}
