import { api } from './api.js';

const form = document.getElementById('login-form');
const alertBox = document.getElementById('login-alert');
const password = document.getElementById('password');
const submit = form.querySelector('button[type="submit"]');

document.getElementById('show-password').addEventListener('change', (event) => {
  password.type = event.target.checked ? 'text' : 'password';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  alertBox.hidden = true;
  submit.disabled = true;

  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: { username: form.username.value.trim(), password: password.value },
    });
    location.replace('/clients.html');
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.hidden = false;
    submit.disabled = false;
  }
});
