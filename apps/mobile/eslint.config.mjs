import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['**/dist/**', '**/node_modules/**', '**/.expo/**'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-constant-condition': 'warn',
      'no-debugger': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
