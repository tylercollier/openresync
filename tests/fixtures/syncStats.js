const moment = require('moment')

const testMoment = moment.utc('2021-03-20T12:00:00Z')
const testDateTime = testMoment.toDate()

const syncSourceDataSet1 = [{
  name: "myMlsSource",
  batch_id: "2021-02-17-T-06-24-07-623Z",
  result: "error",
  error: "bad thing happened",
  created_at: testDateTime,
  updated_at: testDateTime,
  resources: [{
    name: 'Member',
    is_done: true,
    created_at: testDateTime,
    updated_at: testDateTime,
    destinations: [{
      name: 'my_destination',
      num_records_synced: 1,
      created_at: testDateTime,
      updated_at: testDateTime,
    }]
  }, {
    name: 'Property',
    is_done: true,
    created_at: testDateTime,
    updated_at: testDateTime,
    destinations: [{
      name: 'my_destination',
      num_records_synced: 2,
      created_at: testDateTime,
      updated_at: testDateTime,
    }]
  }]
}, {
  name: "myMlsSource",
  batch_id: "2021-02-17-T-06-24-07-623Z",
  result: "success",
  error: null,
  created_at: testDateTime,
  updated_at: testDateTime,
  resources: [{
    name: 'Member',
    is_done: true,
    created_at: testDateTime,
    updated_at: testDateTime,
    destinations: [{
      name: 'my_destination',
      num_records_synced: 1,
      created_at: testDateTime,
      updated_at: testDateTime,
    }]
  }, {
    name: 'Property',
    is_done: true,
    created_at: testDateTime,
    updated_at: testDateTime,
    destinations: [{
      name: 'my_destination',
      num_records_synced: 2,
      created_at: testDateTime,
      updated_at: testDateTime,
    }]
  }]
}]

module.exports = {
  syncSourceDataSet1,
}
