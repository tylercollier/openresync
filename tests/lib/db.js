const knex = require('knex')
const crypto = require('crypto')

// Can be useful if you're doing a single test and want to observe the data after the test has run
let forceSingleDb = false

async function createRandomTestDb({ forcedDbName } = {}) {
  if (forcedDbName) {
    forceSingleDb = true
  }

  let testDbName
  testDbName = 'test_' + crypto.randomBytes(5).toString('hex')
  if (forcedDbName) {
    testDbName = forcedDbName
  } else if (forceSingleDb) {
    testDbName = 'test_db'
  }

  db = knex({
    client: 'mysql2',
    connection: `mysql://${process.env.TEST_DB_ADMIN_USER}:${process.env.TEST_DB_ADMIN_PASSWORD}@localhost:33033/`
  })
  if (forceSingleDb) {
    await db.raw(`DROP DATABASE IF EXISTS ${testDbName}`)
  }
  await db.raw(`CREATE DATABASE ${testDbName}`)
  await db.raw(`GRANT ALL PRIVILEGES ON ${testDbName}.* TO user1`)
  db.destroy()
  db = knex({
    client: 'mysql2',
    connection: `mysql://user1:password1@localhost:33033/${testDbName}`
  })
  return db
}

async function dropAndDestroyTestDb(db) {
  if (!forceSingleDb) {
    const testDbName = db.client.database()
    await db.raw(`DROP DATABASE ${testDbName}`)
  }
  db.destroy()
}

module.exports = {
  createRandomTestDb,
  dropAndDestroyTestDb,
}
