module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'jest'],
  extends: ['eslint:recommended', 'prettier'],
  env: {
    node: true,
    es2020: true,
    jest: true,
  },
  ignorePatterns: ['commitlint.config.cjs', 'node_modules/', 'dist/', 'coverage/', '*.d.ts'],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/prefer-readonly': 'error',

    // Code quality rules
    complexity: ['error', { max: 15 }],
    'max-depth': ['error', { max: 4 }],
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
    'max-params': ['error', { max: 5 }],
    'max-statements': ['error', { max: 25 }],
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'no-nested-ternary': 'error',
    'no-unneeded-ternary': 'error',
    'no-else-return': 'error',
    'consistent-return': 'error',

    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Jest specific rules
    'jest/expect-expect': 'error',
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/valid-expect': 'error',
  },
  overrides: [
    {
      files: ['test/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        'max-lines': 'off', // Test files can be longer
        'max-lines-per-function': 'off',
        'max-statements': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['src/cli.ts', 'src/CSPInjector.ts'],
      rules: {
        'no-console': 'off', // CLI and main injector need console output
        'max-lines': 'off', // Legacy large files - gradually refactor
        'max-lines-per-function': ['error', { max: 150 }],
        complexity: ['error', { max: 25 }],
        'max-statements': ['error', { max: 50 }],
        'no-unused-expressions': 'off', // Some CLI expressions are intentional
      },
    },
    {
      files: ['test/helpers/*.ts'],
      rules: {
        '@typescript-eslint/prefer-readonly': 'off', // Test helpers may need mutable properties
      },
    },
  ],
};
