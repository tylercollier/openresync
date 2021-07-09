const knex = require('knex')
const _ = require('lodash')
const fsPromises = require('fs').promises
const moment = require('moment')
const { getPrimaryKeyField, getTimestampFields } = require('../utils')
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
  const userMakeForeignKeyFieldName = destinationConfig.makeForeignKeyFieldName
  const userTransform = destinationConfig.transform

  function setPlatformAdapter(adapter) {
    platformAdapter = adapter
  }

  function setPlatformDataAdapter(adapter) {
    platformDataAdapter = adapter
  }

  async function maybeDropOrTruncateTable(mlsResourceObj) {
    // await db.raw(`drop table if exists \`${makeTableName(mlsResourceObj.name)}\``)
    // await db.raw(`truncate \`${makeTableName(mlsResourceObj.name)}\``)
  }

  async function syncStructure(mlsResourceObj, metadata) {
    // This is how we get around the fact that we have 600+ columns and the row size is greater than what's allowed.
    await db.raw('SET SESSION innodb_strict_mode=OFF')

    // For debug convenience.
    await maybeDropOrTruncateTable(mlsResourceObj)
    if (mlsResourceObj.expand) {
      for (const subMlsResourceObj of mlsResourceObj.expand) {
        await maybeDropOrTruncateTable(subMlsResourceObj)
      }
    }

    const schemas = metadata['edmx:Edmx']['edmx:DataServices'][0].Schema
    const entityTypes = platformAdapter.getEntityTypes(schemas)
    const [rows] = await db.raw(`SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()`)
    const tableNames = rows.map(x => x.tableName)
    await effectTable(mlsResourceObj, tableNames, entityTypes)
    if (mlsResourceObj.expand) {
      for (const subMlsResourceObj of mlsResourceObj.expand) {
        await effectTable(subMlsResourceObj, tableNames, entityTypes)
      }
    }
  }

  async function effectTable(mlsResourceObj, tableNames, entityTypes) {
    const tableName = makeTableName(mlsResourceObj.name)
    const entityType = entityTypes.find(x => x.$.Name === mlsResourceObj.name)
    const indexes = getIndexes(mlsResourceObj.name)
    if (tableNames.includes(tableName)) {
      await syncTableFields(mlsResourceObj, entityType, indexes)
    } else {
      await createTable(mlsResourceObj, entityType, indexes)
      await createIndexes(tableName, indexes, mlsResourceObj.name)
    }
  }

  async function createTable(mlsResourceObj, entityType, indexes) {
    const fieldsString = entityType.Property
      .filter(property => shouldIncludeField(property.$.Name, indexes, platformAdapter.shouldIncludeMetadataField, mlsResourceObj.select))
      .map(x => buildColumnString(mlsResourceObj.name, x)).join(", \n")
    const tableName = makeTableName(mlsResourceObj.name)
    const sql = `CREATE TABLE \`${tableName}\` (
      ${fieldsString}
    )`
    await db.raw(sql)
  }

  async function createIndexes(tableName, indexesToAdd, mlsResourceName) {
    for (const [indexName, indexProps] of Object.entries(indexesToAdd)) {
      const fieldNamesString = indexProps.fields.map(x => `\`${makeFieldName(mlsResourceName, x)}\``).join(', ')
      const indexType = indexProps.isPrimary ? 'PRIMARY KEY' : 'INDEX'
      const sql = `ALTER TABLE \`${tableName}\` ADD ${indexType} ${indexName} (${fieldNamesString})`
      await db.raw(sql)
    }
  }

  async function syncTableFields(mlsResourceObj, entityType, indexes) {
    const tableName = makeTableName(mlsResourceObj.name)
    const [rows] = await db.raw(`DESCRIBE \`${tableName}\``)
    const tableFields = rows.map(x => x.Field)

    const tableFieldNamesObj = _.reduce(tableFields, (a, v) => {
      a[v] = true
      return a
    }, {})
    const metadataFieldNamesObj = _.reduce(entityType.Property.map(x => makeFieldName(mlsResourceObj.name, x.$.Name)), (a, v) => {
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
      const tableFieldName = makeFieldName(mlsResourceObj.name, metadataProperty.$.Name)
      if (!(tableFieldName in tableFieldNamesObj)) {
        if (shouldIncludeField(metadataProperty.$.Name, indexes, platformAdapter.shouldIncludeMetadataField, mlsResourceObj.select)) {
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
      return 'DATETIME(3)'
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

  function makeFieldName(mlsResourceName, name) {
    return userMakeFieldName ? userMakeFieldName(mlsResourceName, name) : makeName(name)
  }

  function makeForeignKeyFieldName(parentMlsResourceName, mlsResourceName, name) {
    return userMakeForeignKeyFieldName ? userMakeForeignKeyFieldName(parentMlsResourceName, mlsResourceName, name) : makeName(name)
  }

  function transform(mlsResourceName, record, metadata) {
    return userTransform ? userTransform(mlsResourceName, record, metadata) : record
  }

// property is from the RESO Web API XML metadata data dictionary
  function buildColumnString(mlsResourceName, property) {
    const dbType = getDatabaseType(property)
    let sql = `\`${makeFieldName(mlsResourceName, property.$.Name)}\` ${dbType}`
    return sql
  }

  function shouldIncludeField(fieldName, indexes, platformAdapterShouldIncludeFieldFn, userSelect) {
    // We force the index fields
    const fieldNamesFromIndexes = Object.values(indexes).reduce((a, v) => {
      a = a.concat(v.fields)
      return a
    }, [])
    if (fieldNamesFromIndexes.includes(fieldName)) {
      return true
    }

    // The platform adapter can exclude fields, but not force-include them.
    if (platformAdapterShouldIncludeFieldFn(fieldName) === false) {
      return false
    }

    if (userSelect) {
      return userSelect.includes(fieldName)
    }
    return true
  }

  async function syncData(mlsResourceObj, mlsData, metadata, transaction = null) {
    if (!mlsData.length) {
      return
    }
    for (const d of mlsData) {
      for (const key in d) {
        if (key.endsWith('Timestamp') && d[key]) {
          d[key] = moment.utc(d[key]).format("YYYY-MM-DD HH:mm:ss.SSS")
        } else if (key.endsWith('YN')) {
          d[key] = d[key] ? 1 : 0
        }
      }
    }

    const tableName = makeTableName(mlsResourceObj.name)
    const indexes = getIndexes(mlsResourceObj.name)
    let fieldNames = Object.keys(mlsData[0])
      .filter(fieldName => shouldIncludeField(fieldName, indexes, platformAdapter.shouldIncludeJsonField, mlsResourceObj.select))
      // Filter out the 'expand' values, which we handle with a recursive call below.
      .filter(fieldName => !mlsResourceObj.expand || !mlsResourceObj.expand.map(sub => sub.fieldName).includes(fieldName))
    const q = fieldNames.sort()
    const transformedMlsData = mlsData.map(x => {
      const val = _.pick(x, fieldNames)
      return transform(mlsResourceObj.name, val, metadata)
    })
    fieldNames = Object.keys(transformedMlsData[0])
    const q2 = fieldNames.sort()
    const fieldNamesString = fieldNames.map(x => `\`${makeFieldName(mlsResourceObj.name, x)}\``).join(', ')
    const updateValuesString = fieldNames.map(x => {
      const fieldName = makeFieldName(mlsResourceObj.name, x)
      return `\`${fieldName}\`=VALUES(\`${fieldName}\`)`
    })
      .join(', ')
    const values = transformedMlsData.reduce((a, v) => {
      // I used this for CustomProperty, whose CustomFields value is supposed to be a string but comes as an object via the API.
      a.push(...fieldNames.map(fieldName => (typeof v[fieldName] === 'object' && v[fieldName] !== null) ? JSON.stringify(v[fieldName]) : v[fieldName]))
      // a.push(...fieldNames.map(fieldName => v[fieldName]))
      return a
    }, [])
    // Useful when debugging, when you get a SQL error, it'll help you track it down.
    // const insertValuesString = mlsData.map((v, i) => "\n/* " + i + ' */ (' + fieldNames.map((v) => "\n/* " + v + ' */ ?').join(', ') + ')').join(', ')
    const insertValuesString = transformedMlsData.map(() => '(' + fieldNames.map(() => '?').join(', ') + ')').join(', ')
    const sql = `INSERT INTO \`${tableName}\` (${fieldNamesString}) values ${insertValuesString} ON DUPLICATE KEY UPDATE ${updateValuesString}`

    if (transaction) {
      await transaction.raw(sql, values)
    } else {
      return db.transaction(async t => {
        await t.raw(sql, values)
        for (const subMlsResourceObj of (mlsResourceObj.expand || [])) {
          const subData = _.flatMap(mlsData.filter(x => x[subMlsResourceObj.fieldName]), x => x[subMlsResourceObj.fieldName])
          await syncData(subMlsResourceObj, subData, metadata, t)
        }
      })
    }
  }

  async function getTimestamps(mlsResourceName, indexes) {
    const tableName = makeTableName(mlsResourceName)
    const updateTimestampFields = _.pickBy(indexes, v => v.isUpdateTimestamp)
    const fieldsString = _.map(updateTimestampFields, (v, k) => `MAX(\`${makeFieldName(mlsResourceName, k)}\`) as ${k}`).join(', ')
    const [rows] = await db.raw(`SELECT ${fieldsString} FROM \`${tableName}\``)
    return _.mapValues(updateTimestampFields, (v, k) => rows[0][k] || new Date(0))
  }

  async function getAllIds(mlsResourceName, indexes) {
    const tableName = makeTableName(mlsResourceName)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
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

  async function getMostRecentTimestamp(mlsResourceName) {
    const tableName = makeTableName(mlsResourceName)
    const sql = `SELECT MAX(ModificationTimestamp) as value FROM ${tableName}`
    const [rows] = await db.raw(sql)
    if (!rows.length) {
      return null
    }
    return rows[0].value
  }

  async function purge(mlsResourceObj, idsToPurge, getIndexes) {
    const mlsResourceName = mlsResourceObj.name
    const tableName = makeTableName(mlsResourceName)
    const indexes = getIndexes(mlsResourceName)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const sql = `DELETE FROM ${tableName} WHERE ${userFieldName} IN (?)`
    return db.transaction(async trx => {
      await trx.raw(sql, [idsToPurge])
      if (mlsResourceObj.expand) {
        for (const expandedMlsResourceObj of mlsResourceObj.expand) {
          if (expandedMlsResourceObj.purgeFromParent) {
            await purgeFromParent(mlsResourceObj.name, expandedMlsResourceObj.name, idsToPurge, officialFieldName, trx)
          }
        }
      }
    })
  }

  // I'm not loving this way of doing things. But to explain it:
  // My current use case is to purge Media records that were originally synced as part of syncing Property records with
  // the expand feature. We need to delete from the Media table using the ResourceRecordKey field (or, what the user
  // maps it to in their table), using the parentIds from the parent table (Property).
  async function purgeFromParent(parentMlsResourceName, mlsResourceName, parentIds, officialFieldName, transaction) {
    const tableName = makeTableName(mlsResourceName)
    const userFieldName = makeForeignKeyFieldName(parentMlsResourceName, mlsResourceName, officialFieldName)
    // TODO: Loop this, say, for each 1,000 records.
    const sql = `DELETE FROM ${tableName} WHERE ${tickQuote(userFieldName)} IN (?)`
    return transaction.raw(sql, [parentIds])
  }

  async function closeConnection() {
    return db.destroy()
  }

  function tickQuote(term) {
    return '`' + term + '`'
  }

  async function getMissingIds(mlsResourceName, dataInMls, indexes) {
    const tableName = makeTableName(mlsResourceName)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const timestampFieldNames = getTimestampFields(mlsResourceName, indexes)
    const mysqlTimestampFieldNames = timestampFieldNames.map(x => makeFieldName(mlsResourceName, x))
    const fieldNamesSql = [userFieldName, ...mysqlTimestampFieldNames]
      .map(tickQuote)
      .join(', ')
    const sql = `SELECT ${fieldNamesSql} FROM ${tableName} ORDER BY ${userFieldName}`
    const [rows] = await db.raw(sql)

    // Debug, force a few changes
    // dataInMls[1] = rows[1]
    // dataInMls[3] = rows[3]

    const dataInMlsObj = dataInMls.reduce((a, v) => {
      a[v[officialFieldName]] = v
      return a
    }, {})
    const rowsObj = rows.reduce((a, v) => {
      a[v[userFieldName]] = v
      return a
    }, {})
    const missingOrOldObjs = dataInMls.reduce((a, v, index) => {
      const id = v[officialFieldName]
      const dbObj = rowsObj[id]
      if (dbObj) {
        for (let i = 0; i < timestampFieldNames.length; i++) {
          if (v[timestampFieldNames[i]] === null && dbObj[mysqlTimestampFieldNames[i]] === null) {
            continue
          }
          const mlsVal = moment.utc(v[timestampFieldNames[i]])
            // MySQL doesn't have milliseconds (at least in the version I'm currently using), so take them out for the
            // sake of comparison
            .milliseconds(0)
          const mysqlVal = moment.utc(dbObj[mysqlTimestampFieldNames[i]])
          if (!mlsVal.isSame(mysqlVal)) {
            a.push(v)
            break
          }
        }
      } else {
        a.push(v)
      }
      return a
    }, [])

    const missingOrOldIds = missingOrOldObjs.map(x => x[officialFieldName])
    return missingOrOldIds
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
    getMostRecentTimestamp,
    getMissingIds,
  }
}
