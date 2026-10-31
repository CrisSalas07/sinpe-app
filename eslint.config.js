import { builtinRules } from 'eslint/use-at-your-own-risk';

// ESLint 10 no longer ships @eslint/js, so build the "recommended" preset from the built-in rules.
const recommended = Object.fromEntries(
  [...builtinRules]
    .filter(([, rule]) => rule.meta?.docs?.recommended)
    .map(([name]) => [name, 'error']),
);

const nodeGlobals = { process: 'readonly', console: 'readonly', Buffer: 'readonly' };
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  location: 'readonly',
  fetch: 'readonly',
  Node: 'readonly',
  localStorage: 'readonly',
  URLSearchParams: 'readonly',
  console: 'readonly',
};

export default [
  { ignores: ['node_modules/'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals },
    rules: recommended,
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: browserGlobals },
  },
];
