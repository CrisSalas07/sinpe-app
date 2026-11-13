import * as meRepository from '../repositories/me.repository.js';
import { ValidationError } from '../utils/errors.js';
import { compactName } from '../utils/names.js';
import * as phonesService from './phones.service.js';
import * as sinpeService from './sinpe.service.js';

const RECENT_MOVEMENTS = 5;

export const summary = ({ entityId, clientId }) => meRepository.findSummary(entityId, clientId);

export const accounts = ({ entityId, clientId }) => meRepository.findAccounts(entityId, clientId);

// The counterpart is shown with the same compact name as the rest of the app ("Ana De La Cruz").
const withCounterpart = ({ counterpartNames, counterpartSurname, ...row }) => ({
  ...row,
  counterpart: compactName(counterpartNames, counterpartSurname),
});

export async function recentMovements({ entityId, clientId }) {
  const rows = await meRepository.findRecentMovements(entityId, clientId, RECENT_MOVEMENTS);
  return rows.map(withCounterpart);
}

export async function movements({ entityId, clientId }, query) {
  const result = await meRepository.findMovements(entityId, clientId, query);
  return { ...result, movements: result.movements.map(withCounterpart) };
}

export const phones = ({ entityId, clientId }) => meRepository.findPhones(entityId, clientId);

// The procedure's message speaks about "this client"; the client reads it about themselves.
const OWN_PHONE = 'El teléfono ya está registrado a este cliente';

// The admin form names its fields phoneId/accountId; the client form uses number/iban.
const CLIENT_FIELDS = { phoneId: 'number', accountId: 'iban' };
// The procedure tells the admin to "Use Cambiar cuenta", an option the client does not have.
const CLIENT_MESSAGES = {
  'El teléfono ya está afiliado en esta entidad. Use Cambiar cuenta.':
    'Ese número ya está afiliado a SINPE Móvil en esta entidad.',
};

/**
 * The client enrolls one of their phones to one of their accounts in the session entity.
 * Both must be theirs: the session decides the owner, never the request. The rest of the rules
 * (ACTIVA, colones, not enrolled here or in another entity) are checked by sp_afiliar_sinpe.
 * An account never changes owner, and the procedure rejects a phone and an account of different
 * owners, so a phone that changed owner after this check is still rejected.
 */
export async function enrollPhone({ entityId, clientId }, { number, iban }) {
  const phoneId = await meRepository.findOwnPhoneId(clientId, number);
  if (!phoneId) throw new ValidationError('Ese número no está registrado a su nombre.', 'number');
  const accountId = await meRepository.findOwnAccountId(entityId, clientId, iban);
  if (!accountId) throw new ValidationError('Esa cuenta no es suya en esta entidad.', 'iban');
  try {
    await sinpeService.enroll(entityId, phoneId, accountId);
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new ValidationError(
        CLIENT_MESSAGES[err.message] ?? err.message,
        CLIENT_FIELDS[err.field] ?? err.field,
      );
    }
    throw err;
  }
}

/**
 * The client unenrolls one of their numbers. sp_desafiliar_sinpe checks that it is enrolled and
 * that the enrollment is in the session entity: only that entity can remove it. The owner of an
 * enrolled phone cannot change (trg_telefono_validar_update), so this check cannot go stale.
 */
export async function unenrollPhone({ entityId, clientId }, number) {
  if (!(await meRepository.findOwnPhoneId(clientId, number))) {
    throw new ValidationError('Ese número no está registrado a su nombre.', 'number');
  }
  await sinpeService.unenroll(entityId, number);
}

export async function registerPhone({ entityId, clientId }, number) {
  try {
    await phonesService.register(entityId, clientId, number);
  } catch (err) {
    if (err instanceof ValidationError && err.message === OWN_PHONE) {
      throw new ValidationError('Ese número ya está registrado a su nombre.', err.field);
    }
    throw err;
  }
}
