const config = require('../../../lib/config')
const { SyncSource } = require('../../../lib/models/index')
const { Model } = require('objection')
const knex = require('knex')
const { setUp } = require('../../../lib/stats/setUp')
const { createQaDb } = require('../../lib/db')

async function go() {
  const db = await createQaDb()
  Model.knex(db)

  try {
    await setUp(db)

    await SyncSource.query().insertGraphAndFetch([{
      "name": "myMlsSource",
      "batch_id": "2021-02-17-T-06-24-07-623Z",
      "result": "error",
      "error": "bad thing happened",
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
    },{
      "name": "myMlsSource",
      "batch_id": "2021-02-17-T-06-24-07-623Z",
      "result": "success",
      "error": null,
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
    }])

    // Another way to do it that I used previously:
    // await (async () => {
    //   const syncSource1 = await SyncSource.query().insert({
    //     "name": "myMlsSource",
    //     "batch_id": "2021-02-17-T-06-24-07-623Z",
    //     "result": "error",
    //     "error": "bad thing happened",
    //   })
    //   const syncResource1 = await syncSource1.$relatedQuery('resources').insert({
    //     "name": "Member",
    //     "is_done": 1,
    //   })
    //   const syncDestination1 = await syncResource1.$relatedQuery('destinations').insert({
    //     "name": "my_destination",
    //     "num_records_synced": 1,
    //   })
    //   const syncResource2 = await syncSource1.$relatedQuery('resources').insert({
    //     "name": "Property",
    //     "is_done": 1,
    //   })
    //   const syncDestination2 = await syncResource2.$relatedQuery('destinations').insert({
    //     "name": "my_destination",
    //     "num_records_synced": 2,
    //   })
    // })()
    //
    // await (async () => {
    //   const syncSource1 = await SyncSource.query().insert({
    //     "name": "myMlsSource",
    //     "batch_id": "2021-02-17-T-06-24-07-623Z",
    //     "result": "success",
    //     "error": null,
    //   })
    //   const syncResource1 = await syncSource1.$relatedQuery('resources').insert({
    //     "name": "Member",
    //     "is_done": 1,
    //   })
    //   const syncDestination1 = await syncResource1.$relatedQuery('destinations').insert({
    //     "name": "my_destination",
    //     "num_records_synced": 1,
    //   })
    //   const syncResource2 = await syncSource1.$relatedQuery('resources').insert({
    //     "name": "Property",
    //     "is_done": 1,
    //   })
    //   const syncDestination2 = await syncResource2.$relatedQuery('destinations').insert({
    //     "name": "my_destination",
    //     "num_records_synced": 2,
    //   })
    // })()
  } catch (error) {
    db.destroy()
    throw error
  }
  console.log('Done setting up scenario')
}

module.exports = go
