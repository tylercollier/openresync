const downloaderLib = require('../../../../lib/sync/downloader')
const pino = require('pino')
const EventEmitter = require('events')
const moment = require('moment')

const testEmitter = new EventEmitter()
const testLogger = new pino({ level: 'silent' })
const testMoment = moment.utc('2021-02-22T02:08:30Z')
const internalConfig = {}
const flushInternalConfig = () => {}
const timestamps = {
  ModificationTimestamp: testMoment,
  PhotosChangeTimestamp: testMoment,
}
const batchTimestamp = testMoment
const top = 0

function makeDownloader(mlsResources) {
  const userConfig = {
    sources: [{
      name: 'aborTrestle',
      platformAdapterName: 'trestle',
      getReplicationEndpoint: mlsResourceObj => {
        return `https://api-prod.corelogic.com/trestle/odata/${mlsResourceObj.name}?replication=true`
      },
      mlsResources,
    }],
  }
  const configBundle = { userConfig, internalConfig, flushInternalConfig }
  const downloader = downloaderLib('aborTrestle', configBundle, testEmitter, testLogger)
  return downloader
}

describe('makeUrl', () => {
  describe('with expand', () => {
    test('expanded resources use $expand in URL', () => {
      const mlsResources = [
        {
          name: 'Property',
          expand: [
            {
              name: 'Member',
              fieldName: 'ListAgent',
              expand: [
                {
                  name: 'Media',
                  fieldName: 'Media',
                },
              ],
            },
            {
              name: 'Media',
              fieldName: 'Media',
            },
          ],
        },
      ]
      const downloader = makeDownloader(mlsResources)
      const url = new URL(downloader.private.makeUrl(mlsResources[0], timestamps, batchTimestamp, top))
      expect(url.searchParams.get('$expand')).toEqual('ListAgent($expand=Media),Media')
    })
  })

  describe('with expand and select', () => {
    test('expanded resources use $expand and $select in URL', () => {
      const mlsResources = [
        {
          name: 'Property',
          select: ['ListingKey', 'ListingKeyNumeric', 'ListPrice'],
          expand: [
            {
              name: 'Member',
              fieldName: 'ListAgent',
              select: ['MemberKey', 'MemberKeyNumeric', 'MemberCity'],
              expand: [
                {
                  name: 'Media',
                  fieldName: 'Media',
                  select: ['MediaKey', 'LongDescription'],
                },
              ],
            },
            {
              name: 'Media',
              fieldName: 'Media',
            },
          ],
        },
      ]
      const downloader = makeDownloader(mlsResources)
      const url = new URL(downloader.private.makeUrl(mlsResources[0], timestamps, batchTimestamp, top))
      expect(url.searchParams.get('$select')).toEqual('ListingKey,ListingKeyNumeric,ListPrice')
      expect(url.searchParams.get('$expand')).toEqual('ListAgent($select=MemberKey,MemberKeyNumeric,MemberCity&$expand=Media($select=MediaKey,LongDescription)),Media')
    })
  })
})
