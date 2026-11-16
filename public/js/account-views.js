// Own and enrolled account cards, shared by Inicio and Mis cuentas. Each card takes the brand
// colors of its account's entity (data-entity, tokens.css).
import { el, entityBadge, tag } from './dom.js';
import { accountType, formatMoney, titleCase } from './format.js';

const STATUS_TAGS = { ACTIVA: 'ok', INACTIVA: 'neutral', BLOQUEADA: 'bad' };

/** An own account; /api/me/accounts only lists accounts of the session entity. */
export function accountCard(account, entity) {
  return el(
    'div',
    { class: 'acct-card', 'data-entity': entity },
    el(
      'div',
      { class: 'acct-head' },
      el('span', { class: 'acct-label' }, accountType(account.currency)),
      entityBadge(entity),
    ),
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

/** A third party's enrolled account: holder, never a balance. Links to Transferir with its IBAN. */
export function enrolledCard(account) {
  return el(
    'div',
    { class: 'acct-card', 'data-entity': account.entity },
    el(
      'div',
      { class: 'acct-head' },
      el('span', { class: 'acct-label' }, `Matriculada · ${account.enrolledAt.slice(0, 10)}`),
      entityBadge(account.entity),
    ),
    el('div', { class: 'acct-name' }, account.name),
    el('div', { class: 'mono acct-iban' }, account.iban),
    el(
      'div',
      { class: 'tags' },
      tag(account.currency, 'neutral'),
      // The IBAN matches CR + 20 digits (it comes from the database), so it is safe in a URL.
      el(
        'a',
        { class: 'chip acct-action', href: `/transfers.html?to=${account.iban}` },
        'Transferir',
      ),
    ),
  );
}
