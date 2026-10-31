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
