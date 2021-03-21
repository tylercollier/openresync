const moment = require('moment')
const _ = require('lodash')

const testMoment = moment.utc('2021-03-20T12:00:00Z')
const testDateTime = testMoment.toDate()

function makeSyncBatch() {
  return {
    id: 1,
    name: 'myMlsSource',
    batch_id: '2021-02-17-T-06-24-07-623Z',
    result: 'error',
    error: 'bad thing happened',
    created_at: testDateTime,
    updated_at: testDateTime,
    resources: [{
      id: 1,
      sync_source_id: 1,
      name: 'Member',
      is_done: true,
      created_at: testDateTime,
      updated_at: testDateTime,
      destinations: [{
        id: 1,
        sync_resource_id: 1,
        name: 'my_destination',
        num_records_synced: 1,
        created_at: testDateTime,
        updated_at: testDateTime,
      }]
    }, {
      id: 2,
      sync_source_id: 1,
      name: 'Property',
      is_done: true,
      created_at: testDateTime,
      updated_at: testDateTime,
      destinations: [{
        id: 2,
        sync_resource_id: 2,
        name: 'my_destination',
        num_records_synced: 2,
        created_at: testDateTime,
        updated_at: testDateTime,
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

function makeSet2() {
  return null
}

module.exports = {
  syncSourceDataSet1: makeSet1(),
  syncSourceDataSet2: makeSet2(),
}
