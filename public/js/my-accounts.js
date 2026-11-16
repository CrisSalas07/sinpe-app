import { accountCard, enrolledCard } from './account-views.js';
import { api } from './api.js';
import { clearFormErrors, showFormError } from './dom.js';
import { initLayout } from './layout.js';

const IBAN_PATTERN = /^CR[0-9]{20}$/;
const IBAN_HELP = 'CR seguido de 20 dígitos.';

const $ = (id) => document.getElementById(id);
const form = $('enroll-form');
const formAlert = form.querySelector('.alert');
const fields = form.elements;
const submitButton = form.querySelector('[type="submit"]');

const user = await initLayout('my-accounts', 'CLIENTE');

let recipient = null; // { name, entity, own, enrolled } of the typed IBAN, once found
let lookups = 0; // only the answer to the latest request counts

fields.destinationIban.addEventListener('input', lookUpRecipient);
form.addEventListener('submit', onEnroll);

try {
  const [accounts] = await Promise.all([api('/api/me/accounts'), loadEnrolled()]);
  $('accounts').replaceChildren(...accounts.map((a) => accountCard(a, user.entityCode)));
  $('accounts-empty').hidden = accounts.length > 0;
} catch (err) {
  $('page-alert').textContent = err.message;
  $('page-alert').hidden = false;
}

async function loadEnrolled() {
  const enrolled = await api('/api/me/enrolled-accounts');
  $('enrolled').replaceChildren(...enrolled.map(enrolledCard));
  $('enrolled-empty').hidden = enrolled.length > 0;
}

function ibanValue() {
  return fields.destinationIban.value.trim().toUpperCase();
}

/** SINPE asks for the holder's identification only when the account is of another bank. */
function needsIdentification() {
  return recipient !== null && recipient.entity !== user.entityCode;
}

/** Shows who owns the typed IBAN, and asks for the cédula when it is of another bank. */
async function lookUpRecipient() {
  const lookup = ++lookups;
  const iban = ibanValue();
  recipient = null;
  clearFormErrors(form, formAlert);
  $('iban-help').textContent = IBAN_HELP;
  $('identification-field').hidden = true;
  if (!IBAN_PATTERN.test(iban)) return;
  try {
    const found = await api(`/api/transfers/recipient?${new URLSearchParams({ iban })}`);
    if (lookup !== lookups) return;
    recipient = found;
    $('iban-help').textContent = `Titular: ${found.name} · ${found.entity}`;
    $('identification-field').hidden = !needsIdentification() || found.own || found.enrolled;
  } catch (err) {
    if (lookup === lookups) showFormError(form, formAlert, err);
  }
}

/** Format and obvious cases here; the database checks the rest, including the cédula. */
function formError() {
  if (!IBAN_PATTERN.test(ibanValue())) {
    return { field: 'destinationIban', message: 'El IBAN debe ser CR seguido de 20 dígitos.' };
  }
  if (!recipient)
    return { field: 'destinationIban', message: 'Espere a que se verifique el IBAN.' };
  if (recipient.own) {
    return { field: 'destinationIban', message: 'Es una cuenta suya: no necesita matrícula.' };
  }
  if (recipient.enrolled) {
    return { field: 'destinationIban', message: 'Esa cuenta ya está matriculada.' };
  }
  if (needsIdentification() && fields.destinationIdentification.value.trim() === '') {
    return {
      field: 'destinationIdentification',
      message: 'Indique la cédula del titular de la cuenta.',
    };
  }
  return null;
}

async function onEnroll(event) {
  event.preventDefault();
  clearFormErrors(form, formAlert);
  $('enrolled-alert').hidden = true;
  const error = formError();
  if (error) return showFormError(form, formAlert, error);

  const iban = ibanValue();
  const body = needsIdentification()
    ? {
        destinationIban: iban,
        destinationIdentification: fields.destinationIdentification.value.trim(),
      }
    : { destinationIban: iban };
  submitButton.disabled = true;
  try {
    const enrolled = await api('/api/transfers/enrollments', { method: 'POST', body });
    form.reset();
    await lookUpRecipient(); // clears the holder and hides the cédula field
    $('enrolled-alert').textContent =
      `Cuenta de ${enrolled.name} (${enrolled.entity}) matriculada.`;
    $('enrolled-alert').hidden = false;
    await loadEnrolled();
    $('enrolled-alert').scrollIntoView({ block: 'center' });
  } catch (err) {
    showFormError(form, formAlert, err);
  } finally {
    submitButton.disabled = false;
  }
}
