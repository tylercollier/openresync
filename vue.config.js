const config = require('./lib/config').buildUserConfig()

module.exports = {
  devServer: {
    port: 3461,
    host: 'openresync.test',
    proxy: {
      '.*': {
        target: 'http://openresync.test:' + config.server.port,
        ws: true,
      },
    },
  },
  // Allows ApolloQuery Vue components to use gql. See: https://apollo.vuejs.org/guide/components/query.html#query-gql-tag
  chainWebpack: config => {
    config.module
      .rule('vue')
      .use('vue-loader')
      .loader('vue-loader')
      .tap(options => {
        options.transpileOptions = {
          transforms: {
            dangerousTaggedTemplateString: true,
          },
        }
        return options
      })
  },
}
