import * as transfersRepository from '../repositories/transfers.repository.js';
import { ValidationError } from '../utils/errors.js';
import { compactName } from '../utils/names.js';

const ORIGIN_NOT_OWNED = 'La cuenta de origen no pertenece al cliente';
const NOT_REGISTERED = 'El número de destino no está registrado';
const NOT_ENROLLED = 'El número de destino no está afiliado a SINPE Móvil';
const NO_DESTINATION_ACCOUNT = 'La cuenta destino no existe';
const ID_REQUIRED = 'Indique la identificación del titular de la cuenta destino';
const ID_MISMATCH = 'La identificación no corresponde al titular de la cuenta destino';

// Stored procedure / trigger messages that belong to one form field, so the form can highlight it.
// The message itself is shown unchanged. Rules that could be about either account stay unmapped.
const SINPE_FIELDS = {
  [ORIGIN_NOT_OWNED]: 'originIban',
  'La cuenta de origen no está activa': 'originIban',
  'SINPE Móvil solo permite cuentas en CRC': 'originIban',
  [NOT_REGISTERED]: 'destinationNumber',
  [NOT_ENROLLED]: 'destinationNumber',
  'La cuenta de destino no está activa': 'destinationNumber',
  'No se puede transferir a la misma cuenta': 'destinationNumber',
  'El monto debe ser positivo': 'amount',
  'El monto supera su límite diario de SINPE Móvil': 'amount',
  'Saldo insuficiente': 'amount',
};
const IBAN_FIELDS = {
  [ORIGIN_NOT_OWNED]: 'originIban',
  [NO_DESTINATION_ACCOUNT]: 'destinationIban',
  'La cuenta destino no está matriculada': 'destinationIban',
  'No se puede transferir a la misma cuenta': 'destinationIban',
  'Las cuentas deben tener la misma moneda': 'destinationIban',
  'El monto debe ser positivo': 'amount',
  'La cuenta de origen no está activa': 'originIban',
  'La cuenta de destino no está activa': 'destinationIban',
  'Saldo insuficiente': 'amount',
};
const ENROLL_FIELDS = {
  [NO_DESTINATION_ACCOUNT]: 'destinationIban',
  'Sus propias cuentas no necesitan matrícula': 'destinationIban',
  [ID_REQUIRED]: 'destinationIdentification',
  [ID_MISMATCH]: 'destinationIdentification',
};

async function withFieldErrors(fields, call) {
  try {
    return await call();
  } catch (err) {
    const field = err.sqlState === '45000' && fields[err.sqlMessage];
    if (field) throw new ValidationError(err.sqlMessage, field);
    throw err;
  }
}

const toReceipt = ({
  originNames,
  originSurname,
  destinationNames,
  destinationSurname,
  ...row
}) => ({
  ...row,
  originName: compactName(originNames, originSurname),
  destinationName: compactName(destinationNames, destinationSurname),
});

export async function bySinpe(user, transfer) {
  return toReceipt(
    await withFieldErrors(SINPE_FIELDS, () => transfersRepository.transferBySinpe(user, transfer)),
  );
}

export async function byIban(user, transfer) {
  return toReceipt(
    await withFieldErrors(IBAN_FIELDS, () => transfersRepository.transferByIban(user, transfer)),
  );
}

async function recipientByNumber(number) {
  const row = await transfersRepository.findRecipientByNumber(number);
  if (!row) throw new ValidationError(NOT_REGISTERED, 'destinationNumber');
  if (!row.entity) throw new ValidationError(NOT_ENROLLED, 'destinationNumber');
  return row;
}

async function recipientByIban(iban, user) {
  const row = await transfersRepository.findRecipientByIban(iban, user);
  if (!row) throw new ValidationError(NO_DESTINATION_ACCOUNT, 'destinationIban');
  return row;
}

/**
 * Only the compact name and the entity: never the balance, status or identification of a third
 * party. For an IBAN also whether it is the user's own account and whether they enrolled it.
 */
export async function recipient(user, { number, iban }) {
  if (number) {
    const row = await recipientByNumber(number);
    return { name: compactName(row.names, row.firstSurname), entity: row.entity };
  }
  const row = await recipientByIban(iban, user);
  return {
    name: compactName(row.names, row.firstSurname),
    entity: row.entity,
    own: Boolean(row.own),
    enrolled: Boolean(row.enrolled),
  };
}

/** Enrolls a third party's account and answers with its recipient data, now enrolled. */
export async function enroll(user, enrollment) {
  await withFieldErrors(ENROLL_FIELDS, () => transfersRepository.enrollAccount(user, enrollment));
  return recipient(user, { iban: enrollment.iban });
}

export async function limit({ entityId, clientId }, iban) {
  const row = await transfersRepository.findDailyLimit(entityId, clientId, iban);
  if (!row) throw new ValidationError(ORIGIN_NOT_OWNED, 'originIban');
  return row;
}
