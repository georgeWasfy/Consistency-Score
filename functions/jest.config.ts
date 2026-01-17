module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['<rootDir>/src/**/*.test.ts'], // fix: include rootDir
    collectCoverageFrom: [
      'src/**/*.ts',
      '!src/**/*.test.ts',
      '!src/index.ts'
    ],
    // optional but recommended for ts-jest
    transform: {
      '^.+\\.ts$': 'ts-jest'
    },
    moduleFileExtensions: ['ts', 'js', 'json', 'node']
  };
  