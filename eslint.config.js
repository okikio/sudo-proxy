// @ts-check
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const parserTs = require('@typescript-eslint/parser');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  // Ignore generated/built artefacts and config files at root
  {
    ignores: ['dist/**', '.output/**', '.nitro/**', '*.js', '*.mjs', '*.cjs'],
  },

  // TypeScript source — use @typescript-eslint/recommended flat config
  ...tsPlugin.configs['flat/recommended'].map((cfg) => ({
    ...cfg,
    files: ['src/**/*.ts'],
  })),

  // Prettier (disables conflicting rules + enables prettier/prettier rule)
  {
    ...prettierRecommended,
    files: ['src/**/*.ts'],
  },

  // Project-specific overrides
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: parserTs,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'no-console': 'off',
      'no-shadow': 'off',
      'no-restricted-syntax': 'off',
      'consistent-return': 'off',
      'no-continue': 'off',
      'no-await-in-loop': 'off',
      'no-nested-ternary': 'off',
      'prefer-destructuring': 'off',
      'no-underscore-dangle': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-shadow': ['error'],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
