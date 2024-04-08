const eslintPluginSecurity = require("eslint-plugin-security");

module.exports = [eslintPluginSecurity.configs.recommended];

module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    project: "tsconfig.json",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/array-type": "warn",
    "@typescript-eslint/no-floating-promises": "warn",
    "@typescript-eslint/no-shadow": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
      },
    ],
    eqeqeq: "warn",
    indent: ["warn", 2, { SwitchCase: 1, offsetTernaryExpressions: true }],
    "no-console": "off",
    "no-shadow": "off",
    "object-curly-spacing": ["warn", "always"],
    "operator-linebreak": ["warn", "after", { overrides: { "?": "before", ":": "before" } }],
    radix: "warn",
    "require-jsdoc": "off",
  },
};
