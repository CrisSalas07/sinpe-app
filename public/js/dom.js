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
