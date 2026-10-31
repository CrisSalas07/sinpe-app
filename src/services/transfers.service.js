import * as transfersRepository from '../repositories/transfers.repository.js';
import { ValidationError } from '../utils/errors.js';

// Stored procedure / trigger messages that belong to one form field, so the form can highlight it.
// The message itself is shown unchanged. Rules that could be about either account stay unmapped.
const SINPE_FIELDS = {
  'Ambos numeros deben estar afiliados a SINPE Movil': 'destinationNumber',
  'El monto debe ser positivo': 'amount',
};
const IBAN_FIELDS = {
  'La cuenta origen no existe': 'originIban',
  'La cuenta destino no existe': 'destinationIban',
  'Las cuentas deben tener la misma moneda': 'destinationIban',
  'El monto debe ser positivo': 'amount',
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

export async function bySinpe(transfer) {
  return toReceipt(
    await withFieldErrors(SINPE_FIELDS, () => transfersRepository.transferBySinpe(transfer)),
  );
}

export async function byIban(transfer) {
  return toReceipt(
    await withFieldErrors(IBAN_FIELDS, () => transfersRepository.transferByIban(transfer)),
  );
}
