// Shared header (brand, per-role nav, entity, role, user, logout), session and role check for every app page.
import { api } from './api.js';
import { el, icon, tag } from './dom.js';

const MENUS = {
  ADMIN: [
    { id: 'clients', label: 'Clientes', href: '/clients.html' },
    { id: 'accounts', label: 'Cuentas IBAN', href: '/accounts.html' },
    { id: 'phones', label: 'Teléfonos', href: '/phones.html' },
    { id: 'sinpe', label: 'SINPE Móvil', href: '/sinpe.html' },
    { id: 'reports', label: 'Informes', href: '/reports.html' },
    { id: 'backups', label: 'Respaldos', href: '/backups.html' },
  ],
  CLIENTE: [
    { id: 'home', label: 'Inicio', href: '/home.html' },
    { id: 'my-phones', label: 'Mis teléfonos', href: '/my-phones.html' },
    { id: 'transfers', label: 'Transferir', href: '/transfers.html' },
    { id: 'movements', label: 'Mis movimientos', href: '/movements.html' },
  ],
};

const ROLE_LABELS = { ADMIN: 'Administrador', CLIENTE: 'Cliente' };

export const HOME_PAGES = { ADMIN: '/clients.html', CLIENTE: '/home.html' };

/**
 * Checks the session (401 → login) and that `role` may open this page. Another role goes to its
 * home page and this promise never resolves, so the script of the page stops here.
 * What actually protects the data is requireRole on the server.
 */
export async function initLayout(activePage, role) {
  const user = await api('/api/auth/me');
  if (user.role !== role) {
    location.replace(HOME_PAGES[user.role]);
    return new Promise(() => {});
  }
  // The brand colors of the session entity (tokens.css) apply to the whole page.
  document.documentElement.dataset.entity = user.entityCode;
  document.body.prepend(buildHeader(activePage, user));
  return user;
}

function buildHeader(activePage, user) {
  const nav = el(
    'nav',
    { class: 'nav', 'aria-label': 'Principal' },
    ...MENUS[user.role].map((page) =>
      el(
        'a',
        { href: page.href, 'aria-current': page.id === activePage ? 'page' : null },
        page.label,
      ),
    ),
  );

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
      // Full name, or only the code where the header is tight (app.css); the name stays in the title.
      el(
        'span',
        { class: 'entity-pill', title: user.entityName },
        el('span', { class: 'entity-long' }, `${user.entityName} (${user.entityCode})`),
        el('span', { class: 'entity-short' }, user.entityCode),
      ),
      tag(ROLE_LABELS[user.role], 'neutral'),
      el('span', { class: 'header-user' }, user.displayName),
      logoutButton,
    ),
  );
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
