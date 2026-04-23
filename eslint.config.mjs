import _import from 'eslint-plugin-import';
import mocha from 'eslint-plugin-mocha';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.extends('airbnb-base', 'eslint:recommended'),
  {
    plugins: { _import, mocha },
    languageOptions: {
      globals: { ...globals.node, ...globals.mocha },
      parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
    },
    rules: {
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      indent: ['error', 2, { SwitchCase: 1 }],
      'linebreak-style': ['error', 'unix'],
      'react/display-name': 'off',
      'max-len': ['error', { code: 120, tabWidth: 2 }],
      'no-console': ['error', { allow: ['error'] }],
      'no-trailing-spaces': 'error',
      'arrow-parens': [2, 'as-needed', { requireForBlockBody: true }],
      'import/order': ['error', { groups: [['builtin', 'external'], ['parent', 'sibling']] }],
      'comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'never',
        },
      ],
      'default-case': 0,
      'func-names': 0,
      'guard-for-in': 0,
      'global-require': 0,
      'implicit-arrow-linebreak': 0,
      'import/no-extraneous-dependencies': 0,
      'import/extensions': ['error', 'never'],
      'import/prefer-default-export': 0,
      'import/no-unresolved': 0,
      'no-await-in-loop': 0,
      'no-continue': 0,
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'no-restricted-syntax': 0,
      'no-underscore-dangle': 0,
      'no-use-before-define': 0,
      'object-curly-newline': ['error', { consistent: true, multiline: true }],
      'operator-linebreak': [
        'error',
        'before',
        { overrides: { '&&': 'after', '||': 'after', '=': 'after' } },
      ],
      strict: 0,
      'function-paren-newline': 0,
      'no-unused-vars': ['error', { caughtErrorsIgnorePattern: '_' }],
    },
  },
];
