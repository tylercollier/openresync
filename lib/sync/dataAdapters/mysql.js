const knex = require('knex')
const _ = require('lodash')
const fsPromises = require('fs').promises
const moment = require('moment')

async function syncStructure(userConfig, mlsSourceName, metadata) {
  const db = knex({
    client: 'mysql2',
    connection: userConfig.sources[mlsSourceName].mysql.dsn,
    debug: true,
  })
  // This is how we get around the fact that we have 600+ columns and the row size is greater than what's allowed.
  await db.raw('SET SESSION innodb_strict_mode=OFF')
  await db.raw('drop table if exists `Property`')
  await db.raw('drop table if exists `Member`')

  const schemas = metadata['edmx:Edmx']['edmx:DataServices'][0].Schema
  const entityTypes = schemas.find(x => x.$.Namespace === 'CoreLogic.DataStandard.RESO.DD').EntityType
  const [rows] = await db.raw(`SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()`)
  const tableNames = rows.map(x => x.tableName)
  for (const entityType of entityTypes) {
    if (userConfig.sources[mlsSourceName].mlsResources.includes(entityType.$.Name)) {
      const tableName = makeTableName(entityType.$.Name)
      if (tableNames.includes(tableName)) {
        await syncTableFields(tableName, entityType, db)
      } else {
        await createTable(tableName, entityType, db)
        await createIndexes(tableName, db, userConfig)
      }
    }
  }
  await db.destroy()
}

async function createIndexes(tableName, db, userConfig) {
  await db.raw(`ALTER TABLE \`${tableName}\` ADD INDEX ModificationTimestamp (ModificationTimestamp)`)
  await db.raw(`ALTER TABLE \`${tableName}\` ADD INDEX PhotosChangeTimestamp (PhotosChangeTimestamp)`)
}

async function syncTableFields(tableName, entityType, db) {
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
  const type = property.$.Type;
  if (type.startsWith('CoreLogic.DataStandard.RESO.DD.Enums')) {
    return 'TEXT'
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
    if (maxLength >= 255) {
      return 'TEXT'
    }
    // return `VARCHAR(${maxLength})`
    return `VARCHAR(${maxLength})`
  } else {
    throw new Error('Unknown type: ' + type)
  }
  // Additional types
  // Edm.GeographyPoint - Trestle only has one field with this type and its name is X_Location so it's not used.
}

function makeName(name) {
  return name
}

function makeTableName(name) {
  return makeName(name)
}

function makeFieldName(name) {
  return makeName(name)
}

// property is from the RESO Web API XML metadata data dictionary
function buildColumnString(property) {
  const dbType = getDatabaseType(property)
  let sql = `\`${makeFieldName(property.$.Name)}\` ${dbType}`
  if (property.$.Name === 'ListingKey') {
    sql = 'ListingKey VARCHAR(255) PRIMARY KEY'
  }
  return sql
}

function shouldIncludeField(property) {
  // We could filter out fields that have an Annotation where their StandardName is blank.
  // I'm assuming this means it's specific to Trestle.
  // I'm not sure if people want such data so I'll leave it in for now.

  if (property.$.Name.startsWith('X_')) {
    return false
  }
  return true
}

async function createTable(tableName, entityType, db) {
  const types = _.groupBy(entityType.Property, x => x.$.Type)
  // const filteredtypes = _.groupBy(entityType.Property.filter(x => !x.$.Type.startsWith('CoreLogic.DataStandard.RESO.DD.Enums')), x => x.$.Type)
  let fieldsString = entityType.Property.filter(shouldIncludeField).map(x => buildColumnString(x)).join(", \n")
  const sql = `CREATE TABLE \`${tableName}\` (
    ${fieldsString}
  )`
  await db.raw(sql)
}

async function syncData(userConfig, mlsSourceName, mlsResource, mlsData) {
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
  const db = knex({
    client: 'mysql2',
    connection: userConfig.sources[mlsSourceName].mysql.dsn,
    debug: true,
  })

  const tableName = makeTableName(mlsResource)
  const fieldNames = Object.keys(mlsData[0]).filter(x => !x.startsWith('X_'))
  const fieldNamesString = fieldNames.map(x => `\`${makeFieldName(x)}\``).join(', ')
  const updateValuesString = fieldNames.map(x => {
    const fieldName = makeFieldName(x)
    return `${fieldName}=VALUES(${fieldName})`
  })
    .join(', ')
  const values = mlsData.reduce((a, v) => {
    a.push(...fieldNames.map(fieldName => v[fieldName]))
    return a
  }, [])
  const insertValuesString = mlsData.map(() => '(' + fieldNames.map(() => '?').join(', ') + ')').join(', ')
  const sql = `INSERT INTO \`${tableName}\` (${fieldNamesString}) values ${insertValuesString} ON DUPLICATE KEY UPDATE ${updateValuesString}`
  return db.raw(sql, values)
}

async function getTimestamps(userConfig, mlsSourceName, mlsResource) {
  const tableName = makeTableName(mlsResource)
  const db = knex({
    client: 'mysql2',
    connection: userConfig.sources[mlsSourceName].mysql.dsn,
    debug: true,
  })
  const [rows] = await db.raw(`SELECT MAX(ModificationTimestamp), MAX(PhotosChangeTimestamp) FROM \`${tableName}\``)
  if (rows.length) {
    return {
      modificationTimestamp: rows[0].ChangeTimestamp || new Date(0),
      photosChangeTimestamp: rows[0].photosChangeTimestamp || new Date(0),
    }
  }
  return {
    modificationTimestamp: new Date(0),
    photosChangeTimestamp: new Date(0),
  }
}

module.exports = {
  syncStructure,
  syncData,
  getTimestamps,
}
