/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@repo/eslint-config/next.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
  env: {
    node: true,
    browser: true,
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-redeclare': 'off',
    'turbo/no-undeclared-env-vars': 'off',
  },
  ignorePatterns: [
    '.next/',
    '**/importMap.js',
    'src/migrations/**/*',
  ],
}
