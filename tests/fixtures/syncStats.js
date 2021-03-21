const moment = require('moment')
const _ = require('lodash')

const testMoment = moment.utc('2021-03-20T12:00:00Z')
const testDateTime = testMoment.toDate()

let id = 1

function makeSyncBatch() {
  return {
    name: 'myMlsSource',
    batch_id: '2021-02-17-T-06-24-07-623Z',
    result: 'error',
    error: 'bad thing happened',
    resources: [{
      name: 'Member',
      is_done: true,
      destinations: [{
        name: 'my_destination',
        num_records_synced: 1,
      }]
    }, {
      name: 'Property',
      is_done: true,
      destinations: [{
        name: 'my_destination',
        num_records_synced: 2,
      }]
    }]
  }
}

function makeSet1() {
  const batch = makeSyncBatch()
  const batch1 = _.cloneDeep(batch)
  const batch2 = _.cloneDeep(batch)
  _.merge(batch2, {
    result: 'success',
    error: null,
  })
  return [
    batch1,
    batch2,
  ]
}

module.exports = {
  syncSourceDataSet1: makeSet1(),
}
