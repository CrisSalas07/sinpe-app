import * as transfersRepository from '../repositories/transfers.repository.js';
import { ValidationError } from '../utils/errors.js';
import { compactName } from '../utils/names.js';

const ORIGIN_NOT_OWNED = 'La cuenta de origen no pertenece al cliente';
const NOT_REGISTERED = 'El numero de destino no esta registrado';
const NOT_ENROLLED = 'El numero de destino no esta afiliado a SINPE Movil';
const NO_DESTINATION_ACCOUNT = 'La cuenta destino no existe';

// Stored procedure / trigger messages that belong to one form field, so the form can highlight it.
// The message itself is shown unchanged. Rules that could be about either account stay unmapped.
const SINPE_FIELDS = {
  [ORIGIN_NOT_OWNED]: 'originIban',
  'La cuenta de origen no esta activa': 'originIban',
  'SINPE Movil solo permite cuentas en CRC': 'originIban',
  [NOT_REGISTERED]: 'destinationNumber',
  [NOT_ENROLLED]: 'destinationNumber',
  'La cuenta de destino no esta activa': 'destinationNumber',
  'No se puede transferir a la misma cuenta': 'destinationNumber',
  'El monto debe ser positivo': 'amount',
  'El monto supera su limite diario de SINPE Movil': 'amount',
  'Saldo insuficiente': 'amount',
};
const IBAN_FIELDS = {
  [ORIGIN_NOT_OWNED]: 'originIban',
  [NO_DESTINATION_ACCOUNT]: 'destinationIban',
  'No se puede transferir a la misma cuenta': 'destinationIban',
  'Las cuentas deben tener la misma moneda': 'destinationIban',
  'El monto debe ser positivo': 'amount',
  'Saldo insuficiente': 'amount',
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

const toReceipt = (row) => ({ ...row, receipt: `TR-${row.id}` });

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

async function recipientByIban(iban) {
  const row = await transfersRepository.findRecipientByIban(iban);
  if (!row) throw new ValidationError(NO_DESTINATION_ACCOUNT, 'destinationIban');
  return row;
}

/** Only the compact name and the entity: never the balance, status or identification of a third party. */
export async function recipient({ number, iban }) {
  const row = number ? await recipientByNumber(number) : await recipientByIban(iban);
  return { name: compactName(row.names, row.firstSurname), entity: row.entity };
}

export async function limit({ entityId, clientId }, iban) {
  const row = await transfersRepository.findDailyLimit(entityId, clientId, iban);
  if (!row) throw new ValidationError(ORIGIN_NOT_OWNED, 'originIban');
  return row;
}
