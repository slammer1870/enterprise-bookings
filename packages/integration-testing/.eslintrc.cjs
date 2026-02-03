/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-config/react-internal.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.lint.json",
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
    node: true,
  },
  globals: {
    globalThis: "readonly",
  },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "src/**/*.ts"],
      rules: {
        "no-unused-vars": "off",
      },
    },
  ],
};
