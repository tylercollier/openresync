const { buildConfig } = require('../../../lib/config')

test('Prove that tests are working', () => {
  expect(buildConfig().server.port).toEqual(4000)
})