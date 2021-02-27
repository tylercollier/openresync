const dotenv = require('dotenv')
dotenv.config()

module.exports = {
  roots: ['tests/', 'lib/', 'server/', 'src/'],
  testEnvironment: 'node',
}
