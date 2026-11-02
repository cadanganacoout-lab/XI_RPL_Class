const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    files: ["api/**/*.js", "scripts/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: js.configs.recommended.rules,
  },
  {
    files: ["scripts/puppeteer-check.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
