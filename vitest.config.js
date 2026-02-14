const path = require('path');

module.exports = {
  testEnvironment: 'node',
  rootDir: path.join(__dirname),
  include: ['tests/**/*.test.mjs'],
  exclude: ['**/e2e/**', '**/node_modules/**'],
  moduleFileExtensions: ['js', 'mjs'],
  testTimeout: 5000
};
