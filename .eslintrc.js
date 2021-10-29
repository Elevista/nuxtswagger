module.exports = {
  root: true,
  env: { node: true },
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    curly: ['error', 'multi-line'],
    'prefer-template': 'error',
    'prefer-const': ['error', { destructuring: 'all' }],
    'no-restricted-globals': ['error', 'name', 'status', 'origin'],
    'comma-dangle': ['error', 'always-multiline'],
    'space-infix-ops': 'error',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/type-annotation-spacing': ['error', {
      before: true,
      after: true,
      overrides: { colon: { before: false, after: true } },
    }],
  },
}
