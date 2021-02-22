const downloaderLib = require('../../../../lib/sync/downloader')
const pino = require('pino')
const EventEmitter = require('events')
const moment = require('moment')

const testEmitter = new EventEmitter()
const testLogger = new pino({ level: 'silent' })
const testMoment = moment.utc('2021-02-22T02:08:30Z')

describe('makeUrl', () => {
  describe('with expand and select', () => {
    test('expanded resources use $expand in URL', () => {
      const userConfig = {
        sources: {
          aborTrestle: {
            platformAdapterName: 'trestle',
            getReplicationEndpoint: mlsResourceOb => {
              return `https://api-prod.corelogic.com/trestle/odata/${mlsResourceObj.name}?replication=true`
            },
            mlsResources: [
              {
                name: 'Property',
                // selectFn: fieldName => ['ListingKey', 'ListingKeyNumeric', 'ListPrice'].includes(fieldName),
                select: ['ListingKey', 'ListingKeyNumeric', 'ListPrice'],
                expand: [
                  {
                    name: 'Member',
                    fieldName: 'ListAgent',
                    // selectFn: fieldName => ['MemberKey', 'MemberKeyNumeric', 'MemberCity'].includes(fieldName),
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
            ],
          },
        },
      }
      const internalConfig = {}
      const flushInternalConfig = () => {}
      const configBundle = { userConfig, internalConfig, flushInternalConfig }
      const downloader = downloaderLib('aborTrestle', configBundle, testEmitter, testLogger)
      const mlsResourceObj = userConfig.sources.aborTrestle.mlsResources[0]
      const timestamps = {
        ModificationTimestamp: testMoment,
        PhotosChangeTimestamp: testMoment,
      }
      const batchTimestamp = testMoment
      const top = 0
      const url = new URL(downloader.private.makeUrl(mlsResourceObj, timestamps, batchTimestamp, top))
      expect(url.searchParams.get('$select')).toEqual('ListingKey,ListingKeyNumeric,ListPrice')
      expect(url.searchParams.get('$expand')).toEqual('ListAgent($select=MemberKey,MemberKeyNumeric,MemberCity&$expand=Media($select=MediaKey,LongDescription)),Media')
    })
  })
})
