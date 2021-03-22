const moment = require('moment')
const _ = require('lodash')

const testMoment = moment.utc('2021-03-20T12:00:00Z')
const testDateTime = testMoment.toDate()

let id = 1

function makeSyncBatch() {
  return {
    name: 'aborTrestle',
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

function makeSet2() {
  const set1 = makeSet1()
  let set2 = makeSet1()
  set2[0].name = 'aborBridgeInteractive'
  set2[1].name = 'aborBridgeInteractive'
  set2 = set2.concat(makeSet1())
  set2[2].name = 'aborBridgeInteractive'
  set2[3].name = 'aborBridgeInteractive'
  const set3 = makeSet1()
  set3[0].name = 'myMlsSource3'
  set3[1].name = 'myMlsSource3'
  return set1.concat(set2).concat(set3)
}

module.exports = {
  syncSourceDataSet1: makeSet1(),
  syncSourceDataSet2: makeSet2(),
}
