function catcher(msg, { dataAdapter } = {}) {
  return function(error) {
    console.log('Error in ' + msg)
    console.log('error', error)
    let p = Promise.resolve()
    if (dataAdapter) {
      p = dataAdapter.closeConnection()
    }
    p.then(() => {
      process.exit(1)
    })
  }
}

module.exports = {
  catcher,
}
