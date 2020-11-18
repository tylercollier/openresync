module.exports = {
  devServer: {
    port: 3461,
    host: 'openresync.test',
    proxy: 'http://openresync.test:4000',
  },
}
