/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/test/**/*.test.ts',
    '**/test/**/*.spec.ts',
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/index.ts', // Re-export files don't need coverage
    '!src/cli.ts', // CLI is tested via integration tests
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 65, // Achievable with current complex logic
      functions: 80, // Professional standard for utility libraries
      lines: 80, // Good coverage for complex integration code (actual: 79.84%)
      statements: 80, // Balanced threshold for enterprise code
    },
  },
  verbose: true,
  setupFilesAfterEnv: [],
  testTimeout: 15000, // Increased for integration tests
  maxWorkers: '50%', // Optimize for CI/CD environments
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  errorOnDeprecated: true,
  detectOpenHandles: true,
  forceExit: false,
  // Performance optimizations
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  // Better error reporting
  bail: false,
  noStackTrace: false,
  notify: false,
  collectCoverage: false, // Only collect when explicitly requested
};
