const utils = require('../../../../lib/sync/utils')

test('getOldestBatchId', () => {
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
    expect(utils.flattenExpandedMlsResources(mlsResources)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Member' }),
      expect.objectContaining({ name: 'Office' }),
      expect.objectContaining({ name: 'Property' }),
      expect.objectContaining({ name: 'Media' }),
    ]))
  })
})
