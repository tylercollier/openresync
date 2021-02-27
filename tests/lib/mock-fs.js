// This is to fix the inability to use console.log with jest after using mock-fs.
// See: https://github.com/tschaub/mock-fs/issues/234#issuecomment-446980942

const fsMock = require('mock-fs')

let logsTemp = []
let logMock

exports.mockFs = (config) => {
  logMock = jest.spyOn(console, 'log').mockImplementation((...args) => {
    logsTemp.push(args)
  })
  fsMock(config)
}

exports.restoreFs = () => {
  logMock.mockRestore()
  fsMock.restore()
  logsTemp.map(el => console.log(...el))
  logsTemp = []
}
