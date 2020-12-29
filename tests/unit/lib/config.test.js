const { buildUserConfig } = require('../../../lib/config')

test('Prove that tests are working', () => {
  expect(buildUserConfig().server.port).toEqual(4000)
})