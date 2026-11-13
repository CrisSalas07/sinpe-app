// Safe DOM builders: data is always inserted as text, never parsed as HTML.
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an element. `props` become attributes ("class" sets className; null/false are skipped).
 * Children may be nodes, strings or numbers; strings become text nodes.
 * Never pass user data as an href/src attribute.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

/** An <svg> that references a symbol in /img/icons.svg. Decorative (aria-hidden). */
export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `/img/icons.svg#${name}`);
  svg.append(use);
  return svg;
}

/** Code of a financial entity ("BCR") in that entity's brand color (see tokens.css). */
export function entityBadge(code) {
  return el('span', { class: 'entity-badge', 'data-entity': code }, code);
}

/** Status tag. kind: 'ok' | 'bad' | 'neutral'. */
export function tag(text, kind) {
  return el('span', { class: `tag tag-${kind}` }, text);
}

/** Hides the alert and every field error of a form, restoring the help texts. */
export function clearFormErrors(form, alertBox) {
  alertBox.hidden = true;
  for (const input of form.querySelectorAll('[aria-invalid]'))
    input.removeAttribute('aria-invalid');
  for (const error of form.querySelectorAll('.field-error')) error.hidden = true;
  for (const help of form.querySelectorAll('.help')) help.hidden = false;
}

/**
 * Shows an API error in the form's red alert. If the server named a field, that input turns red
 * and the .field-error of its .field replaces the .help text. Lookups stay inside the field,
 * so a page can have several forms with the same field names.
 */
export function showFormError(form, alertBox, err) {
  alertBox.textContent = err.message;
  alertBox.hidden = false;

  const input = err.field && form.elements.namedItem(err.field);
  if (!input) return;
  input.setAttribute('aria-invalid', 'true');
  const field = input.closest('.field');
  const error = field?.querySelector('.field-error');
  if (error) {
    error.textContent = err.message;
    error.hidden = false;
  }
  const help = field?.querySelector('.help');
  if (help) help.hidden = true;
  input.focus();
}

/**
 * Puts `rows` in a table body, or one row with `emptyText` across every column when there are none.
 * While a body is still empty the CSS shows "Cargando…".
 */
export function fillRows(tbody, rows, emptyText) {
  if (rows.length > 0) return tbody.replaceChildren(...rows);
  const columns = tbody.closest('table').tHead.rows[0].cells.length;
  tbody.replaceChildren(
    el('tr', {}, el('td', { class: 'table-empty', colspan: columns }, emptyText)),
  );
}

/**
 * Table rows grouped by owner, so a person is not repeated on every row. Each group gets a summary
 * row with a disclosure button; its item rows show only while it is open.
 * groups: [{ key, label, summary: [cell, …], items: [[cell, …], …] }]. A cell is a node or a string.
 * open: Set of keys kept between renders. forceOpen: show every group open (while searching).
 */
export function groupedRows(groups, open, forceOpen = false) {
  return groups.flatMap(({ key, label, summary, items }) => {
    const cells = (values) => values.map((value) => el('td', {}, value));
    const itemRows = items.map((values) =>
      el('tr', { class: 'group-item' }, el('td', {}), ...cells(values)),
    );
    const button = el('button', { type: 'button', class: 'disclosure' }, label);
    const summaryRow = el('tr', { class: 'group-row' }, el('td', {}, button), ...cells(summary));

    const show = (expanded) => {
      button.setAttribute('aria-expanded', String(expanded));
      for (const row of itemRows) row.hidden = !expanded;
    };
    const toggle = () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      if (expanded) open.add(key);
      else open.delete(key);
      show(expanded);
    };
    button.addEventListener('click', toggle);
    // The whole summary row is clickable; the button keeps it usable with the keyboard.
    summaryRow.addEventListener('click', (event) => {
      if (!button.contains(event.target)) toggle();
    });
    show(forceOpen || open.has(key));
    return [summaryRow, ...itemRows];
  });
}

/** Groups items by key, keeping the order in which each key first appears. */
export function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()];
}

/** "1 teléfono" / "2 teléfonos". */
export function count(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}
