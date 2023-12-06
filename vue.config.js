// Fix errors with 'npm run build' for Node 17+.
// See: https://stackoverflow.com/a/72219174/135101
const crypto = require('crypto');
/**
 * The MD4 algorithm is not available anymore in Node.js 17+ (because of library SSL 3).
 * In that case, silently replace MD4 by the MD5 algorithm.
 */
try {
  crypto.createHash('md4');
} catch (e) {
  const origCreateHash = crypto.createHash;
  crypto.createHash = (alg, opts) => {
    return origCreateHash(alg === 'md4' ? 'md5' : alg, opts);
  };
}

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
  chainWebpack: config => {
    // Allows ApolloQuery Vue components to use gql.
    // See: https://apollo.vuejs.org/guide/components/query.html#query-gql-tag
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

    // Slim down the mammoth moment-timezone
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
