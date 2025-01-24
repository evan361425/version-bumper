import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const languageOptions = {
  parserOptions: {
    project: "tsconfig.json",
  },
};
const baseRules = {
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-shadow": "warn",
  "@typescript-eslint/restrict-template-expressions": "off",
  "@typescript-eslint/require-await": "off",
  "@typescript-eslint/no-unused-vars": [
    "off",
    { "argsIgnorePattern": "^_" }
  ],
  "eqeqeq": "warn",
};

export default tseslint.config(
  {
    languageOptions,
    files: ["src/**/*.ts"],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      prettier,
    ],
    rules: baseRules,
  },
  {
    languageOptions,
    files: ["test/**/*.ts"],
    extends: [
      tseslint.configs.stylisticTypeChecked,
      prettier,
    ],
    rules: {
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      ...baseRules,
    },
  }
);

// const eslintPluginSecurity = require("eslint-plugin-security");

// module.exports = [eslintPluginSecurity.configs.recommended];

// module.exports = {
//   extends: [
//     "eslint:recommended",
//     "plugin:@typescript-eslint/eslint-recommended",
//     "plugin:@typescript-eslint/recommended",
//   ],
//   globals: {
//     Atomics: "readonly",
//     SharedArrayBuffer: "readonly",
//   },
//   parser: "@typescript-eslint/parser",
//   parserOptions: {
//     ecmaVersion: 2022,
//     project: "tsconfig.json",
//     sourceType: "module",
//   },
//   plugins: ["@typescript-eslint"],
//   rules: {
//     "@typescript-eslint/array-type": "warn",
//     "@typescript-eslint/no-floating-promises": "warn",
//     "@typescript-eslint/no-shadow": "warn",
//     "@typescript-eslint/no-unused-vars": [
//       "warn",
//       {
//         argsIgnorePattern: "^_",
//       },
//     ],
//     eqeqeq: "warn",
//     indent: ["warn", 2, { SwitchCase: 1, offsetTernaryExpressions: true }],
//     "no-console": "off",
//     "no-shadow": "off",
//     "object-curly-spacing": ["warn", "always"],
//     "operator-linebreak": ["warn", "after", { overrides: { "?": "before", ":": "before" } }],
//     radix: "warn",
//     "require-jsdoc": "off",
//   },
// };
