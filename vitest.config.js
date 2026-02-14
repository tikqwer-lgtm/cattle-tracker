const path = require('path');

module.exports = {
  testEnvironment: 'node',
  rootDir: path.join(__dirname),
  testMatch: ['**/tests/**/*.test.mjs'],
  moduleFileExtensions: ['js'],
  testTimeout: 5000
};
