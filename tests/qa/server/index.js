const express = require('express')
const statsScenario = require('../scenarios/stats')
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

let data

async function setUpQaScenario() {
  data = await statsScenario()
  console.log('Done setting up scenario')
}

async function startServer() {
  await setUpQaScenario()

  app.get('/qa/stats1', (req, res) => {
    res.json(data)
  })

  app.listen(4001, () => {
    console.log(`🚀 QA Server ready`);
  })
}

startServer()
