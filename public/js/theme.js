// Classic (non-module) script loaded in <head>: applies the saved theme before the first paint.
try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
} catch {
  // Storage can be blocked (private mode); the light theme is the default.
}
