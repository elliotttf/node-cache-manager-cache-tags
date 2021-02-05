const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  extends: [
    "episource-base",
    "episource-base/typescript",
    "episource-base/jest",
  ],
  rules: {
    "class-methods-use-this": OFF,
    "@typescript-eslint/ban-ts-comment": OFF,
    "@typescript-eslint/no-unused-vars": OFF,
    "@typescript-eslint/no-unused-vars-experimental": WARN,
    "import/no-cycle": OFF,
    "import/prefer-default-export": OFF,
    "import/no-extraneous-dependencies": ["error", { devDependencies: true }],
    "jest/expect-expect": [
      ERROR,
      {
        assertFunctionNames: [
          "expect",
          "request.*.expect",
          "request.**.expect",
          "request.*.expect*",
        ],
      },
    ],
    "jest/no-test-return-statement": WARN,
    "jest/no-done-callback": WARN,
    "no-console": WARN,
    "no-empty-function": OFF,
    "no-unused-vars": OFF,
    "no-useless-constructor": OFF,
  },
};
