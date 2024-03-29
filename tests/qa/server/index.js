const express = require('express')
const statsScenario = require('../scenarios/stats')
const { syncSourceDataSet2 } = require('../../fixtures/syncStats')
const { purgeSourceDataSet1 } = require('../../fixtures/purgeStats')
const { SyncSource, PurgeSource } = require('../../../lib/models/index')
const pathLib = require('path')
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config({
  path: pathLib.resolve(__dirname, '../../../.env'),
})

const app = express()
app.use(express.json())
app.use(cors({
  origin: 'http://storybook.openresync.test:6006',
}))

async function startServer() {

  app.get('/qa/stats1', async (req, res) => {
    const data = await statsScenario(syncSourceDataSet1, { useQaDb: false })
    res.json(data)
  })

  app.get('/qa/stats2', async (req, res) => {
    const fns = [
      () => SyncSource.query().insertGraphAndFetch(syncSourceDataSet2),
      () => PurgeSource.query().insertGraphAndFetch(purgeSourceDataSet1),
    ]
    const [s, p] = await statsScenario(fns)
    res.json({
      sync: s,
      purge: p,
    })
  })

  app.listen(4001, () => {
    console.log(`🚀 QA Server ready`);
  })
}

startServer()
