const knex = require('knex')
const crypto = require('crypto')

async function createRandomTestDb() {
  const testDbName = 'test_' + crypto.randomBytes(5).toString('hex')

  db = knex({
    client: 'mysql2',
    connection: `mysql://${process.env.TEST_DB_ADMIN_USER}:${process.env.TEST_DB_ADMIN_PASSWORD}@localhost:33033/`
  })
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
  const testDbName = db.client.database()
  await db.raw(`DROP DATABASE ${testDbName}`)
  db.destroy()
}

module.exports = {
  createRandomTestDb,
  dropAndDestroyTestDb,
}
