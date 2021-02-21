const utils = require('../../../../lib/sync/utils')

describe('flattenExpandedMlsResources', () => {
  const mlsResources = [{
    name: 'Member',
    expand: [{
      name: 'Property',
      expand: [{
        name: 'Media',
      }],
    }],
  }, {
    name: 'Office',
    expand: [{
      name: 'Property',
    }],
  }]

  test('flattens and uniquifies', () => {
    expect(utils.flattenExpandedMlsResources(mlsResources)).toEqual([{
      name: 'Member',
      expand: [{
        name: 'Property',
        expand: [{
          name: 'Media',
        }],
      }],
    }, {
      name: 'Property',
      expand: [{
        name: 'Media',
      }],
    }, {
      name: 'Media',
    }, {
      name: 'Office',
      expand: [{
        name: 'Property',
      }],
    }])
  })
})

describe('getOldestBatchId', () => {
  test('finds oldest timestamp', () => {
    const filesPerMlsResource = [
      [
        'sync_batch_2021-02-17-T-06-44-06-623Z_seq_2021-01-17-T-06-45-37-666Z.json',
      ],
      [
        'sync_batch_2021-01-17-T-06-44-06-623Z_seq_2021-01-17-T-06-45-37-666Z.json',
      ],
    ]

    expect(utils.getOldestBatchId(filesPerMlsResource, 'sync')).toEqual('2021-01-17-T-06-44-06-623Z')
  })

  test('it returns null if no files are passed', () => {
    expect(utils.getOldestBatchId([[]], 'sync')).toEqual(null)
  })

  test('it returns null if no files are matched', () => {
    const filesPerMlsResource = [['purge_batch_2021-02-20-T-05-18-04-901Z_seq_2021-02-20-T-05-18-27-018Z.json']]
    expect(utils.getOldestBatchId(filesPerMlsResource, 'sync')).toEqual(null)
  })
})
