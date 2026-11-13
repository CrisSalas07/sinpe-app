import { api } from './api.js';
import { el } from './dom.js';
import { HOME_PAGES } from './layout.js';

const DEFAULT_ENTITY = 'BCR';

const form = document.getElementById('login-form');
const alertBox = document.getElementById('login-alert');
const entity = document.getElementById('entityId');
const password = document.getElementById('password');
const submit = form.querySelector('button[type="submit"]');

function showError(message) {
  alertBox.textContent = message;
  alertBox.hidden = false;
}

async function loadEntities() {
  submit.disabled = true;
  try {
    const entities = await api('/api/auth/entities');
    entity.replaceChildren(
      ...entities.map((item) =>
        el(
          'option',
          { value: item.id, 'data-code': item.code, selected: item.code === DEFAULT_ENTITY },
          item.name,
        ),
      ),
    );
    showEntityColors();
    submit.disabled = false;
  } catch (err) {
    showError(err.message);
  }
}

// The page takes the brand colors of the chosen entity (tokens.css).
function showEntityColors() {
  const code = entity.selectedOptions[0]?.dataset.code;
  if (code) document.documentElement.dataset.entity = code;
  else delete document.documentElement.dataset.entity;
}

entity.addEventListener('change', showEntityColors);

document.getElementById('show-password').addEventListener('change', (event) => {
  password.type = event.target.checked ? 'text' : 'password';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  alertBox.hidden = true;
  submit.disabled = true;

  try {
    const user = await api('/api/auth/login', {
      method: 'POST',
      body: {
        entityId: Number(entity.value),
        username: form.username.value.trim(),
        password: password.value,
      },
    });
    location.replace(HOME_PAGES[user.role]);
  } catch (err) {
    showError(err.message);
    submit.disabled = false;
  }
});

loadEntities();
