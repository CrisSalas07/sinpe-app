// Display formatting. Money arrives as a DECIMAL string ("123991.00") and is never parsed to a float.

const NBSP = ' ';
const CURRENCY_SYMBOLS = { CRC: '₡', USD: '$' };

/** "LEONARDO ANTONIO" → "Leonardo Antonio". */
export function titleCase(text) {
  return text.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

/** First given name + first surname: "Leonardo Aguilar". */
export function compactName(nombres, primerApellido) {
  return titleCase(`${nombres.split(' ')[0]} ${primerApellido}`);
}

/** Every name and both surnames: "Leonardo Antonio Aguilar Berrocal". */
export function fullName(nombres, primerApellido, segundoApellido) {
  return titleCase(`${nombres} ${primerApellido} ${segundoApellido}`);
}

/** "80000001" → "8000-0001". */
export function formatPhone(number) {
  return `${number.slice(0, 4)}-${number.slice(4)}`;
}

/** "CR00000000000000000001" → "CR00 …001". */
export function shortIban(iban) {
  return `${iban.slice(0, 4)} …${iban.slice(-3)}`;
}

/** CRC: "₡ 123 991" (decimals only when not ,00). USD: "$ 377,00". */
export function formatMoney(amount, currency) {
  const [rawInt, rawDec = ''] = String(amount).split('.');
  const negative = rawInt.startsWith('-');
  const digits = negative ? rawInt.slice(1) : rawInt;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = rawDec.padEnd(2, '0').slice(0, 2);
  const showDecimals = currency === 'USD' || decimals !== '00';
  const sign = negative ? '-' : '';
  return `${sign}${CURRENCY_SYMBOLS[currency]}${NBSP}${grouped}${showDecimals ? `,${decimals}` : ''}`;
}

/** Lowercase, accent-free text for "Buscar en la lista". */
export function searchText(...parts) {
  return parts
    .join(' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
