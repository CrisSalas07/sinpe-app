import { api } from './api.js';
import { clearFormErrors, el, icon, showFormError, tag } from './dom.js';
import {
  compactName,
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

// "Casos de prueba del enunciado": each chip prefills the form (it never submits).
const TEST_CASES = {
  'same-account': { type: 'sinpe', origin: '80000001', destination: '70000001', amount: '1000' },
  allowed: { type: 'sinpe', origin: '80000001', destination: '80000002', amount: '15000' },
  'other-currency': {
    type: 'iban',
    origin: 'CR00000000000000000001',
    destination: 'CR00000000000000000025',
    amount: '15000',
  },
  insufficient: { type: 'sinpe', origin: '80000011', destination: '80000002', amount: '100000' },
};

const form = document.getElementById('data-form');
const formAlert = form.querySelector('.alert');
const fields = form.elements;
const review = document.getElementById('review');
const receipt = document.getElementById('receipt');
const confirmButton = document.getElementById('confirm');
const backButton = document.getElementById('back');
const loadAlert = document.getElementById('load-alert');

let type = 'sinpe';
const accountsByIban = new Map();
const phonesByNumber = new Map();

await initLayout('transfers', 'CLIENTE');
for (const tab of form.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => setType(tab.dataset.type));
}
for (const chip of form.querySelectorAll('[data-case]')) {
  chip.addEventListener('click', () => applyTestCase(TEST_CASES[chip.dataset.case]));
}
for (const name of ['originNumber', 'originIban', 'destinationNumber', 'destinationIban']) {
  fields[name].addEventListener('input', renderCards);
}
fields.destinationNumber.addEventListener('input', () => {
  fields.destinationNumber.value = fields.destinationNumber.value.replace(/\D/g, '');
  renderCards();
});
fields.amount.addEventListener('input', () => {
  fields.amount.value = fields.amount.value.replace(/[^\d.]/g, '');
});
form.addEventListener('submit', onReview);
backButton.addEventListener('click', () => setStep(1));
confirmButton.addEventListener('click', onConfirm);
document.getElementById('new-transfer').addEventListener('click', () => {
  form.reset();
  setType('sinpe');
  setStep(1);
});

await loadData();
setType('sinpe');
setStep(1);

async function loadData() {
  try {
    const [accounts, phones] = await Promise.all([api('/api/accounts'), api('/api/phones')]);
    accountsByIban.clear();
    phonesByNumber.clear();
    for (const account of accounts) accountsByIban.set(account.iban, account);
    for (const phone of phones) phonesByNumber.set(phone.number, phone);
    fillOriginSelects(accounts, phones);
    loadAlert.hidden = true;
  } catch (err) {
    loadAlert.textContent = err.message;
    loadAlert.hidden = false;
  }
}

/** Repopulates both origin selects, keeping the current selection. */
function fillOriginSelects(accounts, phones) {
  const keep = { phone: fields.originNumber.value, iban: fields.originIban.value };
  fields.originNumber.replaceChildren(
    ...phones
      .filter((phone) => phone.enrolledIban)
      .map((phone) =>
        el(
          'option',
          { value: phone.number },
          `${formatPhone(phone.number)} · ${compactName(phone.ownerNames, phone.ownerFirstSurname)} · ${shortIban(phone.enrolledIban)}`,
        ),
      ),
  );
  fields.originIban.replaceChildren(
    ...accounts.map((account) =>
      el(
        'option',
        { value: account.iban },
        `${shortIban(account.iban)} · ${compactName(account.holderNames, account.holderFirstSurname)} · ${account.currency}`,
      ),
    ),
  );
  if (keep.phone) fields.originNumber.value = keep.phone;
  if (keep.iban) fields.originIban.value = keep.iban;
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
  renderCards();
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
  if (testCase.type === 'sinpe') {
    fields.originNumber.value = testCase.origin;
    fields.destinationNumber.value = testCase.destination;
  } else {
    fields.originIban.value = testCase.origin;
    fields.destinationIban.value = testCase.destination;
  }
  fields.amount.value = testCase.amount;
  setStep(1);
  renderCards();
}

// ---------- "Desde" / "Hacia" cards ----------

function originAccount() {
  if (type === 'iban') return accountsByIban.get(fields.originIban.value);
  const phone = phonesByNumber.get(fields.originNumber.value);
  return phone && accountsByIban.get(phone.enrolledIban);
}

function destination() {
  if (type === 'iban') {
    return { account: accountsByIban.get(fields.destinationIban.value.trim().toUpperCase()) };
  }
  const phone = phonesByNumber.get(fields.destinationNumber.value);
  return { phone, account: phone && accountsByIban.get(phone.enrolledIban) };
}

function accountCard(container, label, account) {
  container.replaceChildren(
    el('div', { class: 'acct-label' }, label),
    el('div', { class: 'acct-name' }, compactName(account.holderNames, account.holderFirstSurname)),
    el('div', { class: 'mono acct-iban' }, account.iban),
    el('div', { class: 'acct-amount' }, formatMoney(account.balance, account.currency)),
    el(
      'div',
      { class: 'tags' },
      tag(titleCase(account.status), STATUS_TAGS[account.status]),
      tag(account.currency, 'neutral'),
    ),
  );
}

// A registered phone without SINPE Móvil (07 Error · teléfono no afiliado).
function unenrolledPhoneCard(container, phone) {
  container.replaceChildren(
    el('div', { class: 'acct-label' }, 'Hacia'),
    el('div', { class: 'acct-name' }, compactName(phone.ownerNames, phone.ownerFirstSurname)),
    el('div', { class: 'mono acct-iban' }, `Teléfono ${formatPhone(phone.number)}`),
    el('div', { class: 'acct-amount' }, '—'),
    el('div', { class: 'tags' }, tag('Sin afiliar', 'bad')),
  );
}

function emptyCard(container, label) {
  container.replaceChildren(
    el('div', { class: 'acct-label' }, label),
    el('div', { class: 'acct-amount acct-empty' }, '—'),
  );
}

function renderCards() {
  const from = document.getElementById('card-from');
  const to = document.getElementById('card-to');
  const origin = originAccount();
  if (origin) accountCard(from, 'Desde', origin);
  else emptyCard(from, 'Desde');

  const target = destination();
  if (target.account) accountCard(to, 'Hacia', target.account);
  else if (target.phone) unenrolledPhoneCard(to, target.phone);
  else emptyCard(to, 'Hacia');

  const currency = origin?.currency ?? 'CRC';
  document.getElementById('amount-currency').textContent = CURRENCY_SYMBOLS[currency];
  for (const help of form.querySelectorAll('[data-balance]')) {
    help.textContent = origin ? `Saldo disponible: ${formatMoney(origin.balance, currency)}` : '';
  }
}

// ---------- Step 1 → 2: format checks only; business rules are checked by the database ----------

function formatError() {
  if (type === 'sinpe' && !/^[0-9]{8}$/.test(fields.destinationNumber.value)) {
    return { field: 'destinationNumber', message: 'El número debe tener exactamente 8 dígitos.' };
  }
  if (type === 'iban' && !IBAN_PATTERN.test(fields.destinationIban.value.trim().toUpperCase())) {
    return { field: 'destinationIban', message: 'El IBAN debe ser CR seguido de 20 dígitos.' };
  }
  const amount = fields.amount.value.trim();
  if (!MONEY_PATTERN.test(amount)) {
    return { field: 'amount', message: 'Ingrese un monto válido, con hasta 2 decimales.' };
  }
  if (toCents(amount) === 0)
    return { field: 'amount', message: 'El monto debe ser mayor que cero.' };
  return null;
}

function onReview(event) {
  event.preventDefault();
  clearFormErrors(form, formAlert);
  const origin = originAccount();
  const error = formatError();
  if (error) return showFormError(form, formAlert, error);
  if (!origin) return showFormError(form, formAlert, { message: 'Seleccione el origen.' });

  const amount = fields.amount.value.trim();
  const target = destination();
  const destinationText =
    type === 'sinpe'
      ? [formatPhone(fields.destinationNumber.value), target.phone && ownerOf(target.phone)]
      : [
          shortIban(fields.destinationIban.value.trim().toUpperCase()),
          target.account && holderOf(target.account),
        ];
  const originText =
    type === 'sinpe'
      ? `${formatPhone(fields.originNumber.value)} · ${holderOf(origin)}`
      : `${shortIban(origin.iban)} · ${holderOf(origin)}`;

  document.getElementById('review-rows').replaceChildren(
    kvRow(type === 'sinpe' ? 'Teléfono de origen' : 'Cuenta de origen', originText),
    kvRow('Destino', destinationText.filter(Boolean).join(' · ')),
    kvRow('Monto', formatMoney(amount, origin.currency)),
    // Only when the user wrote one, so an empty detail looks exactly like the Figma.
    ...detailRow(fields.detail.value.trim()),
    kvRow(
      'Saldo del origen después',
      formatMoney(fromCents(toCents(origin.balance) - toCents(amount)), origin.currency),
    ),
    kvRow('Tipo', type === 'sinpe' ? 'SINPE Móvil' : 'IBAN'),
  );
  setStep(2);
}

function ownerOf(phone) {
  return compactName(phone.ownerNames, phone.ownerFirstSurname);
}

function holderOf(account) {
  return compactName(account.holderNames, account.holderFirstSurname);
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
  const amount = fields.amount.value.trim();
  const detail = fields.detail.value.trim();
  const request =
    type === 'sinpe'
      ? api('/api/transfers/sinpe', {
          method: 'POST',
          body: {
            originNumber: fields.originNumber.value,
            destinationNumber: fields.destinationNumber.value,
            amount,
            detail,
          },
        })
      : api('/api/transfers/iban', {
          method: 'POST',
          body: {
            originIban: fields.originIban.value,
            destinationIban: fields.destinationIban.value.trim().toUpperCase(),
            amount,
            detail,
          },
        });

  try {
    const result = await request;
    await loadData(); // cards show the balances stored after the transfer
    renderCards();
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
  const totalBefore = fromCents(toCents(result.originBefore) + toCents(result.destinationBefore));
  const totalAfter = fromCents(toCents(result.originAfter) + toCents(result.destinationAfter));
  document.getElementById('receipt-sub').textContent =
    `Comprobante ${result.receipt} · ${result.date.slice(0, 16)}`;
  document
    .getElementById('receipt-rows')
    .replaceChildren(
      kvRow('Monto', money(result.amount)),
      ...detailRow(result.detail),
      kvRow(
        'Origen, antes → después',
        `${money(result.originBefore)} → ${money(result.originAfter)}`,
      ),
      kvRow(
        'Destino, antes → después',
        `${money(result.destinationBefore)} → ${money(result.destinationAfter)}`,
      ),
      kvRow('Total entre ambas cuentas', `${money(totalBefore)} → ${money(totalAfter)}`),
    );
}
