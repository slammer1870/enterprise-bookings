/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@repo/eslint-config/next.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
  rules: {
    '@next/next/no-duplicate-head': 'off',
  },
  ignorePatterns: [
    '.next/',
    'src/app/(payload)/admin/importMap.js',
    'src/migrations_backup_*/**/*',
  ],
}
