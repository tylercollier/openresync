const utils = require('../../../../lib/sync/utils')

test('getOldestBatchId', () => {
  const filesPerMlsResource = [
    [
      'batch_2021-02-17-T-06-44-06-623Z_seq_2021-01-17-T-06-45-37-666Z.json',
    ],
    [
      'batch_2021-01-17-T-06-44-06-623Z_seq_2021-01-17-T-06-45-37-666Z.json',
    ],
  ]

  expect(utils.getOldestBatchId(filesPerMlsResource)).toEqual('2021-01-17-T-06-44-06-623Z')
})