// The rules are the ones that catch real mistakes: undefined names, unused imports, hooks
// called wrong. Nothing about style; Prettier is not in use and the code reads fine as it is.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'mcp/node_modules/', '.vercel/', '.claude/', '.omc/', 'design/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Only the hooks rule that catches a real bug. The plugin's newer compiler rules (no
      // setState in effects, no refs in render) would mean rewriting patterns that work.
      'react-hooks/rules-of-hooks': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_|^React$', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
