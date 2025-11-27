/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@repo/eslint-config/next.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@next/next/no-duplicate-head': 'off',
  },
  ignorePatterns: ['.next/', 'src/app/(payload)/admin/importMap.js'],
}
