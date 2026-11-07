import { api } from './api.js';
import { clearFormErrors, el, fillRows, showFormError, tag } from './dom.js';
import { formatPhone, ibanTail } from './format.js';
import { initLayout } from './layout.js';

const listView = document.getElementById('list-view');
const formView = document.getElementById('form-view');
const rows = document.getElementById('rows');
const listAlert = document.getElementById('list-alert');
const form = document.getElementById('phone-form');
const formAlert = form.querySelector('.alert');
const submit = form.querySelector('button[type="submit"]');

const user = await initLayout('my-phones', 'CLIENTE');
// defaultValue survives form.reset().
form.elements.owner.defaultValue = user.displayName;
window.addEventListener('hashchange', showView);
form.addEventListener('submit', onSubmit);
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
    form.reset();
    clearFormErrors(form, formAlert);
    form.elements.number.focus();
  }
}

// The IBAN of an enrollment in another entity is not data of this one.
function enrolledAccount(phone) {
  if (phone.enrolledIban) return ibanTail(phone.enrolledIban);
  return phone.enrolled ? `Otra entidad (${phone.enrolledBankCode})` : '—';
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
    location.hash = '';
    await loadPhones();
  } catch (err) {
    showFormError(form, formAlert, err);
  } finally {
    submit.disabled = false;
  }
}
