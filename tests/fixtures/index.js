const fs = require('fs')
const fsPromises = fs.promises
const pathLib = require('path')
const xml2js = require('xml2js')

async function getMetadata(filePath) {
  const metadataString = await fsPromises.readFile(filePath, 'utf8')
  const parser = new xml2js.Parser()
  const metadata = await parser.parseStringPromise(metadataString)
  return metadata
}

async function getBridgeMetadata() {
  const filePath = pathLib.resolve(__dirname, './files/actris_ref_metadata.xml')
  return getMetadata(filePath)
}

module.exports = {
  getBridgeMetadata,
}
