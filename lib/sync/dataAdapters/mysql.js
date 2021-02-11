const knex = require('knex')
const _ = require('lodash')
const fsPromises = require('fs').promises
const moment = require('moment')
const { getPrimaryKeyField } = require('../utils')
const { getIndexes } = require('../indexes')

module.exports = ({ destinationConfig }) => {
  let platformAdapter
  let platformDataAdapter

  const db = knex({
    client: 'mysql2',
    connection: destinationConfig.connectionString,
    // debug: true,
  })
  const userMakeTableName = destinationConfig.makeTableName
  const userMakeFieldName = destinationConfig.makeFieldName

  function setPlatformAdapter(adapter) {
    platformAdapter = adapter
  }

  function setPlatformDataAdapter(adapter) {
    platformDataAdapter = adapter
  }

  async function syncStructure(metadata, mlsResourceObj) {
    // This is how we get around the fact that we have 600+ columns and the row size is greater than what's allowed.
    await db.raw('SET SESSION innodb_strict_mode=OFF')

    // For debug convenience.
    // await db.raw(`drop table if exists \`${makeTableName(mlsResourceObj.name)}\``)
    // await db.raw(`truncate \`${makeTableName(mlsResourceObj.name)}\``)

    const schemas = metadata['edmx:Edmx']['edmx:DataServices'][0].Schema
    const entityTypes = platformAdapter.getEntityTypes(schemas)
    const [rows] = await db.raw(`SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()`)
    const tableNames = rows.map(x => x.tableName)
    const tableName = makeTableName(mlsResourceObj.name)
    // In the following, we call recursive methods. This assumes that the "expand" resources, aka subresources, have
    // the same status as their parents. As in, parent and child both previously existed or both previously didn't.
    // It's not necessarily true but probably likely enough in real life.
    // TODO: Instead of making the above assumption, why don't we just move the check for "expand" resources here.
    // This would obviate checking for expanded resources elsewhere. We could get rid of the effectNewTable and
    // effectTableFields methods, which basically only exist to do such a check.
    // Then our integration test could just call syncStructure instead of effectNewTable.
    if (tableNames.includes(tableName)) {
      await effectTableFields(mlsResourceObj, entityTypes)
    } else {
      await effectNewTable(mlsResourceObj, entityTypes)
    }
  }

  async function effectNewTable(mlsResourceObj, entityTypes) {
    const tableName = makeTableName(mlsResourceObj.name)
    const entityType = entityTypes.find(x => x.$.Name === mlsResourceObj.name)
    await createTable(tableName, entityType)
    await createIndexes(tableName, getIndexes(mlsResourceObj.name))

    if (mlsResourceObj.expand) {
      for (const subMlsResourceObj of mlsResourceObj.expand) {
        await effectNewTable(subMlsResourceObj, entityTypes)
      }
    }
  }

  async function createIndexes(tableName, indexesToAdd) {
    for (const [indexName, indexProps] of Object.entries(indexesToAdd)) {
      const fieldNamesString = indexProps.fields.map(x => `\`${makeFieldName(x)}\``).join(', ')
      const indexType = indexProps.isPrimary ? 'PRIMARY KEY' : 'INDEX'
      await db.raw(`ALTER TABLE \`${tableName}\` ADD ${indexType} ${indexName} (${fieldNamesString})`)
    }
  }

  async function effectTableFields(mlsResourceObj, entityTypes) {
    const tableName = makeTableName(mlsResourceObj.name)
    const entityType = entityTypes.find(x => x.$.Name === mlsResourceObj.name)
    await syncTableFields(tableName, entityType)

    if (mlsResourceObj.expand) {
      for (const subMlsResourceObj of mlsResourceObj.expand) {
        await effectTableFields(subMlsResourceObj, entityTypes)
      }
    }
  }

  async function syncTableFields(tableName, entityType) {
    const [rows] = await db.raw(`DESCRIBE \`${tableName}\``)
    const tableFields = rows.map(x => x.Field)

    const tableFieldNamesObj = _.reduce(tableFields, (a, v) => {
      a[v] = true
      return a
    }, {})
    const metadataFieldNamesObj = _.reduce(entityType.Property.map(x => makeFieldName(x.$.Name)), (a, v) => {
      a[v] = true
      return a
    }, {})

    // If there are any fields in our database that aren't in the metadata, let's warn.
    for (const tableFieldName in tableFieldNamesObj) {
      if (!(tableFieldName in metadataFieldNamesObj)) {
        if (tableFieldName === 'id') {
          continue
        }
        // Throw for now, until we set up a warning system.
        throw new Error(`Table field ${tableFieldName} is not in MLS metadata`)
      }
    }

    for (const metadataProperty of entityType.Property) {
      const tableFieldName = makeFieldName(metadataProperty.$.Name)
      if (!(tableFieldName in tableFieldNamesObj)) {
        if (shouldIncludeField(metadataProperty)) {
          const typeString = getDatabaseType(metadataProperty)
          const nullableString = metadataProperty.$.Nullable === 'false' ? '' : 'NULL'
          await db.raw(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${tableFieldName}\` ${typeString} ${nullableString}`)
        }
      }
    }
  }

  function getDatabaseType(property) {
    if (platformDataAdapter.overridesDatabaseType(property)) {
      return platformDataAdapter.getDatabaseType(property)
    }

    const type = property.$.Type;
    if (type === 'Edm.Double') {
      const precision = parseInt(property.$.Precision, 10)
      if (precision <= 23) {
        return `FLOAT(${precision})`
      } else {
        return `DOUBLE(${precision})`
      }
    } else if (type === 'Edm.Decimal') {
      return 'DECIMAL(' + property.$.Precision + ', ' + property.$.Scale + ')'
    } else if (type === 'Edm.Boolean') {
      return 'BOOL'
    } else if (type === 'Edm.Date') {
      return 'DATE'
    } else if (type === 'Edm.Int32') {
      return 'INT'
    } else if (type === 'Edm.DateTimeOffset') {
      return 'DATETIME'
    } else if (type === 'Edm.Int64') {
      return 'BIGINT'
    } else if (type === 'Edm.String') {
      if (!property.$.MaxLength) {
        return 'TEXT'
      }
      const maxLength = parseInt(property.$.MaxLength, 10)
      if (maxLength > 255) {
        return 'TEXT'
      }
      return `VARCHAR(${maxLength})`
    } else if (type === 'Edm.GeographyPoint') {
      return 'JSON'
    } else {
      throw new Error('Unknown type: ' + type)
    }
  }

  function makeName(name) {
    return name
  }

  function makeTableName(name) {
    return userMakeTableName ? userMakeTableName(name) : makeName(name)
  }

  function makeFieldName(name) {
    return userMakeFieldName ? userMakeFieldName(name) : makeName(name)
  }

// property is from the RESO Web API XML metadata data dictionary
  function buildColumnString(property) {
    const dbType = getDatabaseType(property)
    let sql = `\`${makeFieldName(property.$.Name)}\` ${dbType}`
    return sql
  }

  function shouldIncludeField(property) {
    // We could filter out fields that have an Annotation where their StandardName is blank.
    // I'm assuming this means it's specific to Trestle.
    // I'm not sure if people want such data so I'll leave it in for now.

    if (property.$.Name.startsWith('X_')) {
      return false
    // } else if (property.$.Type.startsWith('Collection(PropertyComplexTypes')) {
    //   return false
    }
    return true
  }

  async function createTable(tableName, entityType) {
    const fieldsString = entityType.Property.filter(shouldIncludeField).map(buildColumnString).join(", \n")
    const sql = `CREATE TABLE \`${tableName}\` (
      ${fieldsString}
    )`
    await db.raw(sql)
  }

  async function syncData(mlsResourceName, mlsData) {
    if (!mlsData.length) {
      return
    }
    for (const d of mlsData) {
      for (const key in d) {
        if (key.endsWith('Timestamp') && d[key]) {
          d[key] = moment.utc(d[key]).format("YYYY-MM-DD HH:mm:ss")
        } else if (key.endsWith('YN')) {
          d[key] = d[key] ? 1 : 0
        }
      }
    }

    const tableName = makeTableName(mlsResourceName)
    const fieldNames = Object.keys(mlsData[0]).filter(platformAdapter.filterField)
    const fieldNamesString = fieldNames.map(x => `\`${makeFieldName(x)}\``).join(', ')
    const updateValuesString = fieldNames.map(x => {
      const fieldName = makeFieldName(x)
      return `\`${fieldName}\`=VALUES(\`${fieldName}\`)`
    })
      .join(', ')
    const values = mlsData.reduce((a, v) => {
      // I used this for CustomProperty, whose CustomFields value is supposed to be a string but comes as an object via the API.
      a.push(...fieldNames.map(fieldName => (typeof v[fieldName] === 'object' && v[fieldName] !== null) ? JSON.stringify(v[fieldName]) : v[fieldName]))
      // a.push(...fieldNames.map(fieldName => v[fieldName]))
      return a
    }, [])
    // Useful when debugging, when you get a SQL error, it'll help you track it down.
    // const insertValuesString = mlsData.map((v, i) => "\n/* " + i + ' */ (' + fieldNames.map((v) => "\n/* " + v + ' */ ?').join(', ') + ')').join(', ')
    const insertValuesString = mlsData.map(() => '(' + fieldNames.map(() => '?').join(', ') + ')').join(', ')
    const sql = `INSERT INTO \`${tableName}\` (${fieldNamesString}) values ${insertValuesString} ON DUPLICATE KEY UPDATE ${updateValuesString}`
    return db.transaction(trx => trx.raw(sql, values))
  }

  async function getTimestamps(mlsResourceName, indexes) {
    const tableName = makeTableName(mlsResourceName)
    const updateTimestampFields = _.pickBy(indexes, v => v.isUpdateTimestamp)
    const fieldsString = _.map(updateTimestampFields, (v, k) => `MAX(\`${makeFieldName(k)}\`) as ${k}`).join(', ')
    const [rows] = await db.raw(`SELECT ${fieldsString} FROM \`${tableName}\``)
    return _.mapValues(updateTimestampFields, (v, k) => rows[0][k] || new Date(0))
  }

  async function getAllIds(mlsResourceName, indexes) {
    const tableName = makeTableName(mlsResourceName)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(officialFieldName)
    const [rows] = await db.raw(`SELECT ${userFieldName} AS id FROM \`${tableName}\` ORDER BY ${userFieldName}`)
    const ids = rows.map(x => x.id)
    return ids
  }

  async function getCount(mlsResourceName) {
    const tableName = makeTableName(mlsResourceName)
    const sql = `SELECT COUNT(*) as count FROM ${tableName}`
    const [rows] = await db.raw(sql)
    return rows[0].count
  }

  async function purge(mlsResourceName, idsToPurge, indexes) {
    const tableName = makeTableName(mlsResourceName)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(officialFieldName)
    const sql = `DELETE FROM ${tableName} WHERE ${userFieldName} IN (?)`
    return db.transaction(trx => trx.raw(sql, [idsToPurge]))
  }

  async function closeConnection() {
    return db.destroy()
  }

  return {
    syncStructure,
    syncData,
    getTimestamps,
    closeConnection,
    setPlatformAdapter,
    setPlatformDataAdapter,
    getAllIds,
    purge,
    getCount,

    // Private means it shouldn't be used except for testing.
    private: {
      // We don't need to check $select or $expand in syncStructure directly, as long as we do it in createTable et al.
      // In downloader, we can check if their replication endpoint includes $select and we'll tell them don't do it there,
      // do it in $select under mlsResources. Or perhaps we allow them, and we just merge? No... we can't merge or we
      // might end up downloading data that we haven't created a table field for.
      effectNewTable,
    },
  }
}
