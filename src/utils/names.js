const titleCase = (text) => text.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());

/** First given name + first surname: "LEONARDO ANTONIO", "AGUILAR" → "Leonardo Aguilar". */
export function compactName(nombres, primerApellido) {
  return titleCase(`${nombres.split(' ')[0]} ${primerApellido}`);
}
