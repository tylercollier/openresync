const webpack = require('webpack')

module.exports = {
  devServer: {
    port: 3461,
    host: 'openresync.test',
    proxy: {
      '/graphql': {
        target: 'http://openresync.test:4000',
      },
      '/subscriptions': {
        target: 'http://openresync.test:4000',
      },
    },
    // proxy: 'http://openresync.test:4000',
  },
}
