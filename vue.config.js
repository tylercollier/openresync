const config = require('./lib/config').buildUserConfig()
const MomentLocalesPlugin = require('moment-locales-webpack-plugin')
const MomentTimezoneDataPlugin = require('moment-timezone-data-webpack-plugin')

const currentYear = new Date().getFullYear()

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
    config
      .plugin('MomentLocalesPlugin')
      .use(new MomentLocalesPlugin())
    config
      .plugin('MomentTimezoneDataPlugin')
      .use(new MomentTimezoneDataPlugin({
        matchZones: /^America/,
        startYear: currentYear - 1,
        endYear: currentYear + 1,
      }))
  },
}
