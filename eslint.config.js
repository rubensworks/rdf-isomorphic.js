const config = require('@rubensworks/eslint-config');

module.exports = config([
  {
    files: [ '**/*.ts' ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: [ './tsconfig.eslint.json' ],
      },
    },
  },
  {
    files: [ '**/test/**/*.ts' ],
    rules: {
      'import/no-nodejs-modules': 'off',
    },
  },
  {
    rules: {
      'ts/prefer-nullish-coalescing': 'off',
    },
  },
  {
    ignores: [
      'node_modules',
      'coverage',
      '**/*.js',
      '**/*.d.ts',
      '**/*.js.map',
    ],
  },
]);
