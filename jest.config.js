module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.(spec|test).ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      branches: 80.49,
      functions: 100,
      lines: 94.64,
      statements: 95,
    },
  },
  testEnvironment: 'node',
};
