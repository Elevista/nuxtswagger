module.exports = {
  root: true,
  env: { node: true },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    '@nuxtjs/eslint-config-typescript',
    'plugin:nuxt/recommended',
  ],
  rules: {
    curly: ['error', 'multi-line'],
    quotes: ['error', 'single'],
    'no-console': 'off',
    'arrow-parens': ['error', 'as-needed'],
    'prefer-template': 'error',
    'prefer-const': ['error', { destructuring: 'all' }],
    'no-restricted-globals': ['error', 'name', 'status', 'origin'],
    'comma-dangle': ['error', 'always-multiline'],
    'space-infix-ops': 'error',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/type-annotation-spacing': ['error', {
      before: true,
      after: true,
      overrides: { colon: { before: false, after: true } },
    }],
  },
}
