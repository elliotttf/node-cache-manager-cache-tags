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
      branches: 72.88,
      functions: 100,
      lines: 84.09,
      statements: 84.78,
    },
  },
  testEnvironment: 'node',
};
