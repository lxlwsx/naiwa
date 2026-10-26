/**
 * Flat ESLint config for the naiwa-pet repository.
 *
 * Two runtimes are linted with different global sets:
 *   - Node: verification scripts, tests and the plugin host half.
 *   - Browser script: the plugin client half (side-effect script, no ESM syntax).
 */
const commonRules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'smart'],
  'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  structuredClone: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  performance: 'readonly',
  localStorage: 'readonly',
  Image: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
};

export default [
  {
    ignores: ['node_modules/**', '.temp/**', '.git/**', 'tools/**', '**/*.png', 'pnpm-lock.yaml'],
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals },
    rules: commonRules,
  },
  {
    files: ['naiwa-pet/index.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals },
    rules: commonRules,
  },
  {
    files: ['naiwa-pet/client.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: browserGlobals },
    rules: commonRules,
  },
];
