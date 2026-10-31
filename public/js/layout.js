// Shared header (brand, nav, theme, operator, logout) and session check for every app page.
import { api } from './api.js';
import { el, icon } from './dom.js';

const PAGES = [
  { id: 'clients', label: 'Clientes', href: '/clients.html' },
  { id: 'accounts', label: 'Cuentas IBAN', href: '/accounts.html' },
  { id: 'phones', label: 'Teléfonos', href: '/phones.html' },
  { id: 'sinpe', label: 'SINPE Móvil', href: '/sinpe.html' },
  { id: 'transfers', label: 'Transferencias', href: '/transfers.html' },
  { id: 'reports', label: 'Historial e informes', href: '/reports.html' },
];

/** Builds the header with `activePage` highlighted, then checks the session (401 → login). */
export async function initLayout(activePage) {
  document.body.prepend(buildHeader(activePage));
  const { user } = await api('/api/auth/me');
  return user;
}

function buildHeader(activePage) {
  const nav = el(
    'nav',
    { class: 'nav', 'aria-label': 'Principal' },
    ...PAGES.map((page) =>
      el(
        'a',
        { href: page.href, 'aria-current': page.id === activePage ? 'page' : null },
        page.label,
      ),
    ),
  );

  const isDark = document.documentElement.dataset.theme === 'dark';
  const themeButton = el(
    'button',
    {
      type: 'button',
      class: 'icon-btn',
      'aria-label': 'Cambiar tema',
      'aria-pressed': String(isDark),
    },
    icon('sun'),
  );
  themeButton.addEventListener('click', () => toggleTheme(themeButton));

  const logoutButton = el(
    'button',
    { type: 'button', class: 'btn btn-secondary' },
    icon('logout'),
    'Cerrar sesión',
  );
  logoutButton.addEventListener('click', () => logout(logoutButton));

  return el(
    'header',
    { class: 'app-header' },
    el(
      'div',
      { class: 'brand' },
      el('span', { class: 'brand-mark' }, icon('logo')),
      el(
        'div',
        {},
        el('div', { class: 'brand-name' }, 'JUNTAUCR'),
        el('div', { class: 'brand-sub' }, 'SINPE Móvil · prototipo'),
      ),
    ),
    nav,
    el(
      'div',
      { class: 'header-actions' },
      themeButton,
      el('span', { class: 'operator' }, 'Operador JUNTAUCR'),
      logoutButton,
    ),
  );
}

function toggleTheme(button) {
  const root = document.documentElement;
  const dark = root.dataset.theme !== 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  button.setAttribute('aria-pressed', String(dark));
  try {
    localStorage.setItem('theme', root.dataset.theme);
  } catch {
    // Storage blocked: the theme just won't be remembered.
  }
}

// Only leaves the page once the server confirms the session is destroyed.
async function logout(button) {
  button.disabled = true;
  try {
    await api('/api/auth/logout', { method: 'POST' });
    location.replace('/');
  } catch (err) {
    console.error(err);
    button.disabled = false;
  }
}
