/**
 * Flat ESLint config for the naiwa-pet repository.
 *
 * Four runtimes are linted with different global sets:
 *   - Node ESM: verification scripts, tests, the plugin host half and shared ESM sources.
 *   - Browser script: the generated DSH client bundle (side-effect script, no ESM syntax).
 *   - Browser script: the generated desktop renderer bundle.
 *   - CommonJS: the Electron main process, preload and the pure physics module.
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
  navigator: 'readonly',
  performance: 'readonly',
  localStorage: 'readonly',
  Image: 'readonly',
  fetch: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  console: 'readonly',
};

const commonjsGlobals = {
  ...nodeGlobals,
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/**',
      '.temp/**',
      '.git/**',
      'tools/**',
      '**/*.png',
      'pnpm-lock.yaml',
      'naiwa-pet/client.js',
      'naiwa-pet/desktop/pet-app.js',
    ],
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals },
    rules: commonRules,
  },
  {
    files: ['naiwa-pet/index.js', 'naiwa-pet/content.js', 'naiwa-pet/pet-core.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals },
    rules: commonRules,
  },
  {
    files: ['naiwa-pet/src/client-shell.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...browserGlobals,
        // 构建时内联进来的共享符号（scripts/build-client.mjs 负责替换 @embed 占位）。
        ACTIONS: 'readonly',
        ACTION_ORDER: 'readonly',
        BUBBLE_TEXT: 'readonly',
        BUILTIN_APPS: 'readonly',
        CLICK_BUBBLES: 'readonly',
        DEFAULT_FRAME_RATIO: 'readonly',
        DRAG_BUBBLE: 'readonly',
        DROP_BUBBLE: 'readonly',
        EXPRESSIONS: 'readonly',
        FRAME_NAMES: 'readonly',
        GREET_BUBBLE: 'readonly',
        IDLE_BUBBLES: 'readonly',
        PET_CSS: 'readonly',
        POSITION_MODES: 'readonly',
        WALK_BUBBLE: 'readonly',
        createPet: 'readonly',
      },
    },
    rules: commonRules,
  },
  {
    files: ['naiwa-pet/src/desktop-renderer.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: browserGlobals },
    rules: commonRules,
  },
  {
    files: ['naiwa-pet/desktop/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: commonjsGlobals },
    rules: commonRules,
  },
];
