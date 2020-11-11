module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint'
  ],
  extends: [
    'standard'
  ],
  rules: {
    'no-unused-vars': 'off',
    'no-useless-constructor': 'off',
    'no-restricted-globals': ['error', 'name'],
    'prefer-const': 'error',
    'no-var': 'error'
  }
}
