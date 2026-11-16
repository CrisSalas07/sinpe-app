import { api } from './api.js';
import { clearFormErrors, el, entityBadge, icon, showFormError, tag } from './dom.js';
import {
  accountLabel,
  formatMoney,
  formatPhone,
  fromCents,
  shortIban,
  titleCase,
  toCents,
} from './format.js';
import { initLayout } from './layout.js';

const STATUS_TAGS = { ACTIVA: 'ok', INACTIVA: 'neutral', BLOQUEADA: 'bad' };
const CURRENCY_SYMBOLS = { CRC: '₡', USD: '$' };
const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;
const IBAN_PATTERN = /^CR[0-9]{20}$/;
const PHONE_PATTERN = /^[0-9]{8}$/;
const HELP = {
  destinationNumber: 'El número debe tener SINPE Móvil afiliado.',
  destinationIban: 'Cuenta ACTIVA y en la misma moneda que el origen.',
};

// "Casos de prueba del enunciado", for leonardo.aguilar in the BCR: each chip prefills the form.
const ACCOUNT_001 = 'CR12015200000000000001';
const ACCOUNT_025 = 'CR12016100000000000025';
const TEST_CASES = {
  'same-account': { type: 'sinpe', origin: ACCOUNT_001, destination: '70000001', amount: '1000' },
  allowed: { type: 'sinpe', origin: ACCOUNT_001, destination: '80000002', amount: '15000' },
  // 025 is Leonardo's own account (in the BP), so it needs no enrollment.
  'other-currency': {
    type: 'iban',
    origin: ACCOUNT_001,
    destination: ACCOUNT_025,
    amount: '15000',
  },
  insufficient: { type: 'sinpe', origin: ACCOUNT_001, destination: '80000002', amount: '150000' },
};

const form = document.getElementById('data-form');
const formAlert = form.querySelector('.alert');
const fields = form.elements;
const review = document.getElementById('review');
const receipt = document.getElementById('receipt');
const confirmButton = document.getElementById('confirm');
const backButton = document.getElementById('back');
const loadAlert = document.getElementById('load-alert');
const limitHelp = document.getElementById('amount-help');
const destinationIdField = document.getElementById('destination-id-field');
const enrollPanel = document.getElementById('enroll-panel');
const enrollButton = document.getElementById('enroll');

let type = 'sinpe';
let accounts = [];
let recipient = null; // { name, entity } (+ own, enrolled for an IBAN) of the destination, once found
let lookups = 0; // only the answer to the latest request counts
let limitLookups = 0;

const user = await initLayout('transfers', 'CLIENTE');
document.getElementById('test-cases').hidden = !(
  user.username === 'leonardo.aguilar' && user.entityCode === 'BCR'
);

for (const tab of form.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => setType(tab.dataset.type));
}
for (const chip of form.querySelectorAll('[data-case]')) {
  chip.addEventListener('click', () => applyTestCase(TEST_CASES[chip.dataset.case]));
}
fields.originIban.addEventListener('change', renderOrigin);
fields.destinationNumber.addEventListener('input', () => {
  fields.destinationNumber.value = fields.destinationNumber.value.replace(/\D/g, '');
  lookUpRecipient();
});
fields.destinationIban.addEventListener('input', lookUpRecipient);
fields.amount.addEventListener('input', () => {
  fields.amount.value = fields.amount.value.replace(/[^\d.]/g, '');
});
form.addEventListener('submit', onReview);
backButton.addEventListener('click', () => setStep(1));
confirmButton.addEventListener('click', onConfirm);
enrollButton.addEventListener('click', onEnroll);
document.getElementById('new-transfer').addEventListener('click', () => {
  form.reset();
  setType('sinpe');
  setStep(1);
});

await loadAccounts();
setType('sinpe');
setStep(1);

async function loadAccounts() {
  try {
    accounts = await api('/api/me/accounts');
    loadAlert.hidden = true;
  } catch (err) {
    loadAlert.textContent = err.message;
    loadAlert.hidden = false;
  }
}

/** "Por teléfono" only lists CRC accounts: SINPE Móvil only works in colones. Keeps the selection. */
function fillOriginSelect() {
  const keep = fields.originIban.value;
  const usable = type === 'sinpe' ? accounts.filter((a) => a.currency === 'CRC') : accounts;
  fields.originIban.replaceChildren(
    ...usable.map((account) => {
      const status = account.status === 'ACTIVA' ? '' : ` · ${account.status}`;
      return el(
        'option',
        { value: account.iban },
        `${accountLabel(account.iban, account.currency)} · ${formatMoney(account.balance, account.currency)}${status}`,
      );
    }),
  );
  if (usable.some((account) => account.iban === keep)) fields.originIban.value = keep;
}

// ---------- Tabs, steps and test cases ----------

function setType(newType) {
  type = newType;
  for (const tab of form.querySelectorAll('.tab')) {
    tab.setAttribute('aria-selected', String(tab.dataset.type === type));
  }
  // Disabled fieldsets are skipped by the form, so only the active tab's fields count.
  for (const group of form.querySelectorAll('fieldset[data-type]')) {
    group.disabled = group.dataset.type !== type;
    group.hidden = group.disabled;
  }
  clearFormErrors(form, formAlert);
  fillOriginSelect();
  renderOrigin();
  lookUpRecipient();
}

function setStep(step) {
  for (const item of document.querySelectorAll('.step')) {
    const n = Number(item.dataset.step);
    const num = item.querySelector('.step-num');
    item.classList.toggle('done', n < step);
    if (n === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
    num.replaceChildren(n < step ? icon('check') : String(n));
  }
  form.hidden = step !== 1;
  review.hidden = step !== 2;
  receipt.hidden = step !== 3;
}

function applyTestCase(testCase) {
  form.reset();
  setType(testCase.type);
  fields.originIban.value = testCase.origin;
  destinationField().value = testCase.destination;
  fields.amount.value = testCase.amount;
  setStep(1);
  renderOrigin();
  lookUpRecipient();
}

// ---------- "Desde": the client's own account ----------

function originAccount() {
  return accounts.find((account) => account.iban === fields.originIban.value);
}

function renderOrigin() {
  const origin = originAccount();
  const card = document.getElementById('card-from');
  if (origin) {
    card.replaceChildren(
      el('div', { class: 'acct-label' }, 'Desde'),
      el('div', { class: 'acct-name' }, user.displayName),
      el('div', { class: 'mono acct-iban' }, origin.iban),
      el('div', { class: 'acct-amount' }, formatMoney(origin.balance, origin.currency)),
      el(
        'div',
        { class: 'tags' },
        tag(titleCase(origin.status), STATUS_TAGS[origin.status]),
        tag(origin.currency, 'neutral'),
      ),
    );
  } else {
    renderEmptyCard(card, 'Desde');
  }

  const currency = origin?.currency ?? 'CRC';
  document.getElementById('amount-currency').textContent = CURRENCY_SYMBOLS[currency];
  document.getElementById('balance-help').textContent = origin
    ? `Saldo disponible: ${formatMoney(origin.balance, currency)}`
    : noOriginMessage();
  loadLimit(origin);
}

/** Why the origin select is empty: no accounts at all, or none in colones for SINPE Móvil. */
function noOriginMessage() {
  if (accounts.length === 0) return 'No tiene cuentas en esta entidad.';
  if (type === 'sinpe') {
    return 'No tiene cuentas en colones: SINPE Móvil solo funciona en colones. Use "Por IBAN".';
  }
  return 'Seleccione la cuenta de origen.';
}

function renderEmptyCard(card, label) {
  card.replaceChildren(
    el('div', { class: 'acct-label' }, label),
    el('div', { class: 'acct-amount acct-empty' }, '—'),
  );
}

/** The daily limit only applies to SINPE Móvil. */
async function loadLimit(origin) {
  const lookup = ++limitLookups;
  limitHelp.textContent = '';
  if (type !== 'sinpe' || !origin) return;
  if (origin.status !== 'ACTIVA') {
    limitHelp.textContent = 'Esta cuenta no está activa.';
    return;
  }
  try {
    const { available } = await api(
      `/api/transfers/limit?${new URLSearchParams({ iban: origin.iban })}`,
    );
    if (lookup !== limitLookups) return;
    limitHelp.textContent = `Disponible hoy: ${formatMoney(available, 'CRC')} de su límite diario.`;
  } catch (err) {
    console.error(err);
  }
}

// ---------- "Hacia": only the name and entity of the recipient ----------

function destinationField() {
  return type === 'sinpe' ? fields.destinationNumber : fields.destinationIban;
}

function destinationValue() {
  return destinationField().value.trim().toUpperCase();
}

function isComplete(value) {
  return (type === 'sinpe' ? PHONE_PATTERN : IBAN_PATTERN).test(value);
}

/** A third party's IBAN must be enrolled once before transferring to it; own accounts never. */
function needsEnrollment() {
  return type === 'iban' && recipient !== null && !recipient.own && !recipient.enrolled;
}

/** SINPE asks for the holder's identification when the account is of another entity. */
function needsDestinationId() {
  return needsEnrollment() && recipient.entity !== user.entityCode;
}

/** "Cuenta propia" or "Matriculada" next to an IBAN recipient's name. */
function enrollmentNote() {
  if (type !== 'iban' || !recipient || needsEnrollment()) return '';
  return recipient.own ? ' · Cuenta propia' : ' · Matriculada';
}

function renderDestination() {
  enrollPanel.hidden = !needsEnrollment();
  destinationIdField.hidden = !needsDestinationId();
  const card = document.getElementById('card-to');
  const input = destinationField();
  const help = input.closest('.field').querySelector('.help');
  if (!recipient) {
    help.textContent = HELP[input.name];
    return renderEmptyCard(card, 'Hacia');
  }
  help.textContent = `Destinatario: ${recipient.name} · ${recipient.entity}${enrollmentNote()}`;
  const value = destinationValue();
  card.replaceChildren(
    el('div', { class: 'acct-label' }, 'Hacia'),
    el('div', { class: 'acct-name' }, recipient.name),
    el(
      'div',
      { class: 'mono acct-iban' },
      type === 'sinpe' ? `Teléfono ${formatPhone(value)}` : value,
    ),
    el('div', { class: 'tags' }, entityBadge(recipient.entity)),
  );
}

function setDestinationError(message) {
  const input = destinationField();
  const field = input.closest('.field');
  const error = field.querySelector('.field-error');
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  error.textContent = message ?? '';
  error.hidden = !message;
  field.querySelector('.help').hidden = Boolean(message);
}

async function lookUpRecipient() {
  const lookup = ++lookups;
  const value = destinationValue();
  recipient = null;
  setDestinationError(null);
  renderDestination();
  if (!isComplete(value)) return;

  const param = type === 'sinpe' ? { number: value } : { iban: value };
  try {
    const found = await api(`/api/transfers/recipient?${new URLSearchParams(param)}`);
    if (lookup !== lookups) return;
    recipient = found;
    renderDestination();
  } catch (err) {
    if (lookup === lookups) setDestinationError(err.message);
  }
}

// ---------- Enrollment of a third party's IBAN, without leaving the form ----------

async function onEnroll() {
  clearFormErrors(form, formAlert);
  const iban = destinationValue();
  const identification = fields.destinationIdentification.value.trim();
  if (needsDestinationId() && identification === '') {
    return showFormError(form, formAlert, {
      field: 'destinationIdentification',
      message: 'Indique la identificación del titular de la cuenta destino.',
    });
  }
  enrollButton.disabled = true;
  try {
    const enrolled = await api('/api/transfers/enrollments', {
      method: 'POST',
      body: needsDestinationId()
        ? { destinationIban: iban, destinationIdentification: identification }
        : { destinationIban: iban },
    });
    if (destinationValue() !== iban) return; // the user changed the IBAN meanwhile
    recipient = enrolled;
    fields.destinationIdentification.value = '';
    renderDestination();
    fields.amount.focus();
  } catch (err) {
    showFormError(form, formAlert, err);
  } finally {
    enrollButton.disabled = false;
  }
}

// ---------- Step 1 → 2: format checks only; business rules are checked by the database ----------

function formatError() {
  if (type === 'sinpe' && !PHONE_PATTERN.test(destinationValue())) {
    return { field: 'destinationNumber', message: 'El número debe tener exactamente 8 dígitos.' };
  }
  if (type === 'iban' && !IBAN_PATTERN.test(destinationValue())) {
    return { field: 'destinationIban', message: 'El IBAN debe ser CR seguido de 20 dígitos.' };
  }
  if (needsEnrollment()) {
    return { field: 'destinationIban', message: 'Matricule la cuenta antes de transferirle.' };
  }
  const amount = fields.amount.value.trim();
  if (!MONEY_PATTERN.test(amount)) {
    return { field: 'amount', message: 'Ingrese un monto válido, con hasta 2 decimales.' };
  }
  if (toCents(amount) === 0)
    return { field: 'amount', message: 'El monto debe ser mayor que cero.' };
  return null;
}

function destinationText() {
  const value = destinationValue();
  const shown = type === 'sinpe' ? formatPhone(value) : shortIban(value);
  return recipient ? `${shown} · ${recipient.name} (${recipient.entity})` : shown;
}

function onReview(event) {
  event.preventDefault();
  clearFormErrors(form, formAlert);
  const origin = originAccount();
  if (!origin) {
    return showFormError(form, formAlert, {
      field: 'originIban',
      message: noOriginMessage(),
    });
  }
  const error = formatError();
  if (error) return showFormError(form, formAlert, error);

  const amount = fields.amount.value.trim();
  document.getElementById('review-rows').replaceChildren(
    kvRow('Cuenta de origen', accountLabel(origin.iban, origin.currency)),
    kvRow('Destino', destinationText()),
    kvRow('Monto', formatMoney(amount, origin.currency)),
    // Only when the user wrote one, so an empty detail looks exactly like the Figma.
    ...detailRow(fields.detail.value.trim()),
    kvRow(
      'Saldo del origen después',
      formatMoney(fromCents(toCents(origin.balance) - toCents(amount)), origin.currency),
    ),
    kvRow('Tipo', type === 'sinpe' ? 'SINPE Móvil' : 'IBAN'),
    kvRow('Comisión', formatMoney('0', origin.currency)),
  );
  setStep(2);
}

/** A text followed by the entity code in its brand color. */
function withEntity(text, code) {
  return el('span', { class: 'entity-line' }, text, entityBadge(code));
}

function kvRow(label, value) {
  return el('div', { class: 'kv-row' }, el('dt', {}, label), el('dd', {}, value));
}

/** [] when there is no detail, so it can be spread into a list of rows. */
function detailRow(detail) {
  return detail ? [kvRow('Detalle', detail)] : [];
}

// ---------- Step 2 → 3: the database executes and validates the transfer ----------

async function onConfirm() {
  // Both buttons stay disabled until the server answers: a transfer must never be sent twice.
  confirmButton.disabled = true;
  backButton.disabled = true;
  const common = {
    originIban: fields.originIban.value,
    amount: fields.amount.value.trim(),
    detail: fields.detail.value.trim(),
  };

  try {
    const result =
      type === 'sinpe'
        ? await api('/api/transfers/sinpe', {
            method: 'POST',
            body: { ...common, destinationNumber: destinationValue() },
          })
        : await api('/api/transfers/iban', {
            method: 'POST',
            body: { ...common, destinationIban: destinationValue() },
          });
    await loadAccounts(); // the select and the card show the balances stored after the transfer
    fillOriginSelect();
    renderOrigin();
    showReceipt(result);
    setStep(3);
  } catch (err) {
    // Rejected by the database: back to Datos with its message (07 error screens).
    setStep(1);
    showFormError(form, formAlert, err);
  } finally {
    confirmButton.disabled = false;
    backButton.disabled = false;
  }
}

function showReceipt(result) {
  const money = (value) => formatMoney(value, result.currency);
  const isSinpe = result.destinationNumber !== null;
  const destination = isSinpe
    ? formatPhone(result.destinationNumber)
    : shortIban(result.destinationIban);
  document.getElementById('receipt-sub').textContent =
    `Comprobante ${result.receipt} · ${result.date.slice(0, 16)}`;
  document
    .getElementById('receipt-rows')
    .replaceChildren(
      kvRow('Monto', money(result.amount)),
      kvRow('Tipo', isSinpe ? 'SINPE Móvil' : 'IBAN'),
      kvRow(
        'Origen',
        withEntity(`${result.originName} · ${shortIban(result.originIban)}`, result.originEntity),
      ),
      kvRow(
        'Destino',
        withEntity(`${result.destinationName} · ${destination}`, result.destinationEntity),
      ),
      ...detailRow(result.detail),
      kvRow('Comisión', money('0')),
      kvRow(
        'Saldo del origen',
        `${money(result.originBalanceBefore)} → ${money(result.originBalanceAfter)}`,
      ),
      kvRow(
        'Saldo del destino',
        `${money(result.destinationBalanceBefore)} → ${money(result.destinationBalanceAfter)}`,
      ),
      kvRow('Total de ambas cuentas', `${money(result.totalBalance)} (se conserva)`),
    );
}
