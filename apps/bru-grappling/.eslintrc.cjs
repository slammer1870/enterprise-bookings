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
    '@next/next/no-duplicate-head': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-redeclare': 'off',
    'turbo/no-undeclared-env-vars': 'off',
  },
  ignorePatterns: [
    '.next/',
    'src/app/(payload)/admin/importMap.js',
    'src/migrations_backup_*/**/*',
    'src/migrations/**/*',
  ],
}
