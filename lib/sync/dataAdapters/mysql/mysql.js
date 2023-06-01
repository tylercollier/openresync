const knex = require('knex')
const _ = require('lodash')
const fsPromises = require('fs').promises
const moment = require('moment')
const {
  getPrimaryKeyField,
  getTimestampFields,
  shouldIncludeField,
  getFieldNamesThatShouldBeIncluded,
} = require('../../utils')
const { Worker } = require('worker_threads')
const pathLib = require('path')

module.exports = ({ destinationConfig }) => {
  let platformAdapter
  let platformDataAdapter

  const db = knex({
    client: 'mysql2',
    connection: destinationConfig.connectionString,
    // debug: true,
    pool: {
      // Putting min:0 fixes the idle timeout message of:
      // "Connection Error: Error: Connection lost: The server closed the connection."
      // See: https://stackoverflow.com/a/55858656/135101
      min: 0,
    },
  })
  const userMakeTableName = destinationConfig.makeTableName
  const userMakeFieldName = destinationConfig.makeFieldName
  const userMakeForeignKeyFieldName = destinationConfig.makeForeignKeyFieldName
  const userTransform = destinationConfig.transform
  const userShouldSyncTableSchema = destinationConfig.shouldSyncTableSchema
  const userMakePrimaryKeyValueForDestination = destinationConfig.makePrimaryKeyValueForDestination
  const userMakePrimaryKeyValueForMls = destinationConfig.makePrimaryKeyValueForMls

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
    if (shouldSyncTableSchema(mlsResourceObj.name)) {
      await effectTable(mlsResourceObj, tableNames, entityTypes)
    }
    if (mlsResourceObj.expand) {
      for (const subMlsResourceObj of mlsResourceObj.expand) {
        if (shouldSyncTableSchema(subMlsResourceObj.name)) {
          await effectTable(subMlsResourceObj, tableNames, entityTypes)
        }
      }
    }
  }

  async function effectTable(mlsResourceObj, tableNames, entityTypes) {
    const tableName = makeTableName(mlsResourceObj.name)
    const entityType = entityTypes.find(x => x.$.Name === mlsResourceObj.name)
    const indexes = platformAdapter.getIndexes(mlsResourceObj.name)
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

    // In my first production case, this is hosing me. I'm transforming Media records into my own field names, and those
    // field names are causing this code to throw. I don't currently need warnings myself, so I will punt on creating a
    // warning system.
    //
    // // If there are any fields in our database that aren't in the metadata, let's warn.
    // for (const tableFieldName in tableFieldNamesObj) {
    //   if (!(tableFieldName in metadataFieldNamesObj)) {
    //     if (tableFieldName === 'id') {
    //       continue
    //     }
    //     // Throw for now, until we set up a warning system.
    //     throw new Error(`Table field ${tableFieldName} is not in MLS metadata`)
    //   }
    // }

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
    } else if (type === 'Edm.Int16') {
      return 'SMALLINT'
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

  function transform(mlsResourceName, record, metadata, parentTransformedMlsData, cache) {
    return userTransform
      ? userTransform(mlsResourceName, record, metadata, parentTransformedMlsData, cache)
      : record
  }

  function shouldSyncTableSchema(mlsResourceName) {
    return userShouldSyncTableSchema ? userShouldSyncTableSchema(mlsResourceName) : true
  }

  // The intent is originally for MLS Grid, whose primary keys look like e.g. RTC123: the primary key of 123 prefixed
  // with the MLS abbreviation of RTC for Realtracs, but you might want just the 123 part in your destination.
  function makePrimaryKeyValueForDestination(mlsResourceName, id) {
    return userMakePrimaryKeyValueForDestination ? userMakePrimaryKeyValueForDestination(mlsResourceName, id) : id
  }

  // This is basically the opposite of makePrimaryKeyValueForDestination.
  function makePrimaryKeyValueForMls(mlsResourceName, id) {
    return userMakePrimaryKeyValueForMls ? userMakePrimaryKeyValueForMls(mlsResourceName, id) : id
  }

  // 'property' is from the RESO Web API XML metadata data dictionary
  function buildColumnString(mlsResourceName, property) {
    const dbType = getDatabaseType(property)
    let sql = `\`${makeFieldName(mlsResourceName, property.$.Name)}\` ${dbType}`
    return sql
  }

  async function syncData(
    mlsResourceObj,
    mlsData,
    metadata,
    transaction = null,
    mapFromSubToTransformedParent = null,
  ) {
    if (!mlsData.length) {
      return
    }
    // TODO: Now that we have the metadata passed to us, should use it to know field types rather than guessing by the
    // field name.
    for (const d of mlsData) {
      for (const key in d) {
        if (key.endsWith('Timestamp') && d[key]) {
          d[key] = moment.utc(d[key]).format("YYYY-MM-DD HH:mm:ss.SSS")
        }
      }
    }

    const tableName = makeTableName(mlsResourceObj.name)
    const indexes = platformAdapter.getIndexes(mlsResourceObj.name)
    const fieldNames = getFieldNamesThatShouldBeIncluded(
      mlsResourceObj,
      metadata,
      indexes,
      shouldIncludeField,
      platformAdapter,
      makeFieldName,
    )
    // The "cache" is an (initially empty) object that we pass each time to the transform function. This allows the
    // transform function to e.g. do lookup work when it chooses, storing it on the cache object. For example, it could
    // do it all on the first pass and not again, or it could potentially do it only on-demand somehow. But we don't
    // have to force it to do it at any particular time.
    const cache = {}
    const transformedMlsData = mlsData.map(x => {
      // At this point, fieldNames have been transformed, but x's have not, if we do pick() by itself, it tries to pick
      // fields that don't exist. So we need to use it in combo with mapKeys()
      const val = _.pick(_.mapKeys(x, (value, f) => makeFieldName(mlsResourceObj.name, f)), fieldNames)
      const transformedParentRecord = mapFromSubToTransformedParent ? mapFromSubToTransformedParent.get(x) : null
      const transformedRecord = transform(mlsResourceObj.name, val, metadata, transformedParentRecord, cache)
      // I'm probably doing something wrong, but Knex doesn't seem to handle array values properly. For example, if the
      // transformed record has these values: { ListingId: 'abc123', MyColumn: ['hello', 'world'] }, it would make an
      // insert statement like this: insert into MyTable (ListingId, MyColumn) values ('abc123', 'hello', 'world'),
      // which produces the error: Column count doesn't match value count at row 1.
      // To fix, we assume any value that is an object is meant for a JSON field, so we stringify it.
      for (const [key, value] of Object.entries(transformedRecord)) {
        if (typeof value === 'object' && value) {
          transformedRecord[key] = JSON.stringify(value)
        }
      }
      return transformedRecord
    })

    function upsert(trx) {
      return trx(tableName)
        .insert(transformedMlsData)
        .onConflict()
        .merge()
    }

    if (transaction) {
      await upsert(transaction)
    } else {
      return db.transaction(async t => {
        await upsert(t)
        for (const subMlsResourceObj of (mlsResourceObj.expand || [])) {
          // Delete the records of the expanded resource. We then re-sync them with the recursive call to syncData.
          if (subMlsResourceObj.purgeFromParent) {
            const officialFieldName = getPrimaryKeyField(mlsResourceObj.name, indexes)
            const idsToPurge = mlsData.map(x => x[officialFieldName])
            const modifiedIdsToPurge = idsToPurge.map(x => makePrimaryKeyValueForDestination(mlsResourceObj.name, x))
            await purgeFromParent(mlsResourceObj.name, subMlsResourceObj.name, modifiedIdsToPurge, officialFieldName, t)
          }
          // MLS Grid doesn't have foreign keys on the subresource data, which we need for relational data. So we create
          // a map here, from sub to parent, so that it can be used later. The transformed parent record will be passed
          // to the user transform function (if supplied). We could also pass the original/non-transformed parent, but
          // we don't yet just because I haven't needed it.
          const subData = []
          const mapFromSubToTransformedParent = new Map()
          for (let i = 0; i < mlsData.length; i++) {
            const parentRecord = mlsData[i]
            const subRecords = parentRecord[subMlsResourceObj.fieldName]
            if (!subRecords) {
              continue
            }
            subData.push(...subRecords)
            const transformedParent = transformedMlsData[i]
            for (const subRecord of subRecords) {
              mapFromSubToTransformedParent.set(subRecord, transformedParent)
            }
          }
          await syncData(subMlsResourceObj, subData, metadata, t, mapFromSubToTransformedParent)
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

  async function getAllMlsIds(mlsResourceName, indexes) {
    const tableName = makeTableName(mlsResourceName)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const [rows] = await db.raw(`SELECT ${userFieldName} AS id FROM \`${tableName}\` ORDER BY ${userFieldName}`)
    const ids = rows.map(x => makePrimaryKeyValueForMls(mlsResourceName, x.id))
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

  async function purge(mlsResourceObj, mlsIdsToPurge, getIndexes) {
    const mlsResourceName = mlsResourceObj.name
    const tableName = makeTableName(mlsResourceName)
    const indexes = getIndexes(mlsResourceName)
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const modifiedIdsToPurge = mlsIdsToPurge.map(x => makePrimaryKeyValueForDestination(mlsResourceName, x))
    const sql = `DELETE FROM ${tableName} WHERE ${userFieldName} IN (?)`
    return db.transaction(async trx => {
      await trx.raw(sql, [modifiedIdsToPurge])
      if (mlsResourceObj.expand) {
        for (const expandedMlsResourceObj of mlsResourceObj.expand) {
          if (expandedMlsResourceObj.purgeFromParent) {
            await purgeFromParent(mlsResourceObj.name, expandedMlsResourceObj.name, modifiedIdsToPurge,
              officialFieldName, trx)
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

  // "Missing IDs data" means that the goal is to understand which records are not up to date in a reconcile process.
  // So to do that, we look at fields like ModificationTimestamp, PhotosChangeTimestamp, etc. It's those multiple fields
  // that we look at that I'm calling the "data".
  async function fetchMissingIdsData(mlsResourceName, indexes) {
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
    return rows
  }

  function computeMissingIds(mlsResourceName, dataInMls, dataInAdapter, indexes) {
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes)
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName)
    const timestampFieldNames = getTimestampFields(mlsResourceName, indexes)
    const mysqlTimestampFieldNames = timestampFieldNames.map(x => makeFieldName(mlsResourceName, x))
    const workerPath = pathLib.resolve(__dirname, 'worker.js')
    // We copy the data, so we can (possibly) transform the IDs (originally for MLS Grid). I don't love this idea due to
    // the extra memory use. But we can't pass the makePrimaryKeyValueForDestination function to the worker (node throws a
    // DataCloneError). The good news is it's only the index/timestamp fields per record.
    const modifiedDataInMls = _.cloneDeep(dataInMls)
    for (const record of modifiedDataInMls) {
      record[officialFieldName] = makePrimaryKeyValueForDestination(mlsResourceName, record[officialFieldName])
    }
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: {
          dataInAdapter,
          userFieldName,
          dataInMls: modifiedDataInMls,
          officialFieldName,
          timestampFieldNames,
          mysqlTimestampFieldNames,
        },
      })
      worker.on('message', missingOrOldIds => {
        const missingOrOldIdsForMls = missingOrOldIds.map(x => makePrimaryKeyValueForMls(mlsResourceName, x))
        resolve(missingOrOldIdsForMls)
      })
      worker.on('error', error => {
        reject(error)
      })
    })
  }

  return {
    syncStructure,
    syncData,
    getTimestamps,
    closeConnection,
    setPlatformAdapter,
    setPlatformDataAdapter,
    getAllMlsIds,
    purge,
    getCount,
    getMostRecentTimestamp,
    fetchMissingIdsData,
    computeMissingIds,
  }
}
