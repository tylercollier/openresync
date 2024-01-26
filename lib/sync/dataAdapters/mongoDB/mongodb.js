const { MongoClient } = require("mongodb");
const _ = require("lodash");

const moment = require("moment");
const {
  getPrimaryKeyField,
  getTimestampFields,
  shouldIncludeField,
  getFieldNamesThatShouldBeIncluded
} = require("../../utils");
const { Worker } = require("worker_threads");
const pathLib = require("path");

module.exports = ({ destinationConfig }) => {
  let platformAdapter;
  let platformDataAdapter;

  let client = new MongoClient(destinationConfig.connectionString);
  client.connect();
  const userMakeCollectionName = destinationConfig.makeCollectionName;
  const userMakeFieldName = destinationConfig.makeFieldName;
  const userMakeForeignKeyFieldName = destinationConfig.makeForeignKeyFieldName;
  const userTransform = destinationConfig.transform;
  const userShouldSyncTableSchema = destinationConfig.shouldSyncTableSchema;
  const userMakePrimaryKeyValueForDestination =
    destinationConfig.makePrimaryKeyValueForDestination;
  const userMakePrimaryKeyValueForMls =
    destinationConfig.makePrimaryKeyValueForMls;

  async function setPlatformAdapter(adapter) {
    platformAdapter = adapter;
  }

  function setPlatformDataAdapter(adapter) {
    platformDataAdapter = adapter;
  }


  async function syncStructure(mlsResourceObj, metadata) {
    const schemas = metadata["edmx:Edmx"]["edmx:DataServices"][0].Schema;
    const entityTypes = platformAdapter.getEntityTypes(schemas);
    const collections = await client
      .db()
      .listCollections()
      .toArray();
    const collectionNames = collections.map(x => x.name);
    if (shouldSyncTableSchema(mlsResourceObj.name)) {
      await effectCollection(
        mlsResourceObj,
        collectionNames,
        entityTypes,
        client
      );
    }
    // if (mlsResourceObj.expand) {
    //   for (const subMlsResourceObj of mlsResourceObj.expand) {
    //     if (shouldSyncTableSchema(subMlsResourceObj.name)) {
    //       await effectCollection(subMlsResourceObj, tableNames, entityTypes)
    //     }
    //   }
    // }
  }

  async function effectCollection(
    mlsResourceObj,
    collectionNames,
    entityTypes,
    client
  ) {
    const collectionName = makeCollectionName(mlsResourceObj.name);
    const entityType = entityTypes.find(x => x.$.Name === mlsResourceObj.name);
    const indexes = platformAdapter.getIndexes(mlsResourceObj.name);
    if (!collectionNames.includes(collectionName)) {
      await createCollection(mlsResourceObj, entityType, indexes, client);
      await createIndexes(collectionName, indexes, mlsResourceObj.name);
      // await syncTableFields(mlsResourceObj, entityType, indexes);
    }
  }

  async function createCollection(mlsResourceObj, entityType, indexes, client) {
    const collectionName = makeCollectionName(mlsResourceObj.name);
    return await client.db().createCollection(collectionName);
  }

  async function createIndexes(collectionName, indexesToAdd, mlsResourceName) {
    for (const [indexName, indexProps] of Object.entries(indexesToAdd)) {
      return client
        .db()
        .collection(collectionName)
        .createIndex(
          {
            [indexName]: 1
          },
          {
            unique: indexProps.isPrimary ? true : false
          }
        );
    }
  }

  function makeName(name) {
    return name;
  }

  function makeCollectionName(name) {
    return userMakeCollectionName
      ? userMakeCollectionName(name)
      : makeName(name);
  }

  function makeFieldName(mlsResourceName, name) {
    return userMakeFieldName
      ? userMakeFieldName(mlsResourceName, name)
      : makeName(name);
  }

  function makeForeignKeyFieldName(
    parentMlsResourceName,
    mlsResourceName,
    name
  ) {
    return userMakeForeignKeyFieldName
      ? userMakeForeignKeyFieldName(
          parentMlsResourceName,
          mlsResourceName,
          name
        )
      : makeName(name);
  }

  function transform(
    mlsResourceName,
    record,
    metadata,
    parentTransformedMlsData,
    cache
  ) {
    return userTransform
      ? userTransform(
          mlsResourceName,
          record,
          metadata,
          parentTransformedMlsData,
          cache
        )
      : record;
  }

  function shouldSyncTableSchema(mlsResourceName) {
    return userShouldSyncTableSchema
      ? userShouldSyncTableSchema(mlsResourceName)
      : true;
  }

  // The intent is originally for MLS Grid, whose primary keys look like e.g. RTC123: the primary key of 123 prefixed
  // with the MLS abbreviation of RTC for Realtracs, but you might want just the 123 part in your destination.
  function makePrimaryKeyValueForDestination(mlsResourceName, id) {
    return userMakePrimaryKeyValueForDestination
      ? userMakePrimaryKeyValueForDestination(mlsResourceName, id)
      : id;
  }

  // This is basically the opposite of makePrimaryKeyValueForDestination.
  function makePrimaryKeyValueForMls(mlsResourceName, id) {
    return userMakePrimaryKeyValueForMls
      ? userMakePrimaryKeyValueForMls(mlsResourceName, id)
      : id;
  }


  async function syncData(
    mlsResourceObj,
    mlsData,
    metadata,
    transaction = null,
    mapFromSubToTransformedParent = null
  ) {
    if (!mlsData.length) {
      return;
    }
    // TODO: Now that we have the metadata passed to us, should use it to know field types rather than guessing by the
    // field name.
    for (const d of mlsData) {
      for (const key in d) {
        if (key.endsWith("Timestamp") && d[key]) {
          d[key] = moment.utc(d[key]).format("YYYY-MM-DD HH:mm:ss.SSS");
        }
      }
    }

    const collectionName = makeCollectionName(mlsResourceObj.name);
    const indexes = platformAdapter.getIndexes(mlsResourceObj.name);

    const fieldNames = getFieldNamesThatShouldBeIncluded(
      mlsResourceObj,
      metadata,
      indexes,
      shouldIncludeField,
      platformAdapter,
      makeFieldName
    );
    // The "cache" is an (initially empty) object that we pass each time to the transform function. This allows the
    // transform function to e.g. do lookup work when it chooses, storing it on the cache object. For example, it could
    // do it all on the first pass and not again, or it could potentially do it only on-demand somehow. But we don't
    // have to force it to do it at any particular time.
    const cache = {};
    const transformedMlsData = mlsData.map(x => {
      const val = _.pick(x, fieldNames);
      const transformedParentRecord = mapFromSubToTransformedParent
        ? mapFromSubToTransformedParent.get(x)
        : null;
      const transformedRecord = transform(
        mlsResourceObj.name,
        val,
        metadata,
        transformedParentRecord,
        cache
      );
      // I'm probably doing something wrong, but Knex doesn't seem to handle array values properly. For example, if the
      // transformed record has these values: { ListingId: 'abc123', MyColumn: ['hello', 'world'] }, it would make an
      // insert statement like this: insert into MyTable (ListingId, MyColumn) values ('abc123', 'hello', 'world'),
      // which produces the error: Column count doesn't match value count at row 1.
      // To fix, we assume any value that is an object is meant for a JSON field, so we stringify it.
      return transformedRecord;
    });

    function upsert() {
      return client
        .db()
        .collection(collectionName)
        .insertMany(transformedMlsData);
    }

    if (transaction) {
      await upsert();
    } else {
      await upsert();

      for (const subMlsResourceObj of mlsResourceObj.expand || []) {
        // Delete the records of the expanded resource. We then re-sync them with the recursive call to syncData.
        if (subMlsResourceObj.purgeFromParent) {
          const officialFieldName = getPrimaryKeyField(
            mlsResourceObj.name,
            indexes
          );
          const idsToPurge = mlsData.map(x => x[officialFieldName]);
          const modifiedIdsToPurge = idsToPurge.map(x =>
            makePrimaryKeyValueForDestination(mlsResourceObj.name, x)
          );
          await purgeFromParent(
            mlsResourceObj.name,
            subMlsResourceObj.name,
            modifiedIdsToPurge,
            officialFieldName,
            t
          );
        }
        // MLS Grid doesn't have foreign keys on the subresource data, which we need for relational data. So we create
        // a map here, from sub to parent, so that it can be used later. The transformed parent record will be passed
        // to the user transform function (if supplied). We could also pass the original/non-transformed parent, but
        // we don't yet just because I haven't needed it.
        const subData = [];
        const mapFromSubToTransformedParent = new Map();
        for (let i = 0; i < mlsData.length; i++) {
          const parentRecord = mlsData[i];
          const subRecords = parentRecord[subMlsResourceObj.fieldName];
          if (!subRecords) {
            continue;
          }
          subData.push(...subRecords);
          const transformedParent = transformedMlsData[i];
          for (const subRecord of subRecords) {
            mapFromSubToTransformedParent.set(subRecord, transformedParent);
          }
        }
        await syncData(
          subMlsResourceObj,
          subData,
          metadata,
          t,
          mapFromSubToTransformedParent
        );
      }
    }
  }

  async function getTimestamps(mlsResourceName, indexes) {
    const collectionName = makeCollectionName(mlsResourceName);
    const updateTimestampFields = _.pickBy(indexes, v => v.isUpdateTimestamp);
    const fieldsString = _.map(updateTimestampFields, (v, k) =>
      makeFieldName(mlsResourceName, k)
    );

    const rows = await client
      .db()
      .collection(collectionName)
      .find({})
      .sort({ [fieldsString[0]]: -1 })
      .limit(1)
      .toArray();
    return _.mapValues(
      updateTimestampFields,
      (v, k) => (rows.length && rows[0][k]) || new Date(0)
    );
  }

  async function getAllMlsIds(mlsResourceName, indexes) {
    const collectionName = makeCollectionName(mlsResourceName);
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes);
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName);
    const rows = await client
      .db()
      .collection(collectionName)
      .find({}, { [userFieldName]: 1 })
      .sort({ [userFieldName]: -1 });
    const ids = rows.map(x =>
      makePrimaryKeyValueForMls(mlsResourceName, x[userFieldName])
    );
    return ids;
  }

  async function getCount(mlsResourceName) {
    const collectionName = makeCollectionName(mlsResourceName);
    const count = await client
      .db()
      .collection(collectionName)
      .count({});
    return count;
  }

  async function getMostRecentTimestamp(mlsResourceName) {
    const collectionName = makeCollectionName(mlsResourceName);
    const rows = await client
      .db()
      .collection(collectionName)
      .find({}, { ModificationTimestamp: 1 })
      .sort({ ModificationTimestamp: -1 })
      .limit(1)
      .toArray();
    if (!rows.length) {
      return null;
    }
    return rows[0].ModificationTimestamp;
  }

  async function purge(mlsResourceObj, mlsIdsToPurge, getIndexes) {
    const mlsResourceName = mlsResourceObj.name;
    const collectionName = makeCollectionName(mlsResourceName);
    const indexes = getIndexes(mlsResourceName);
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes);
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName);
    const modifiedIdsToPurge = mlsIdsToPurge.map(x =>
      makePrimaryKeyValueForDestination(mlsResourceName, x)
    );

    await client
      .db()
      .collection(collectionName)
      .deleteMany({ [userFieldName]: { $in: [modifiedIdsToPurge] } });

    if (mlsResourceObj.expand) {
      for (const expandedMlsResourceObj of mlsResourceObj.expand) {
        if (expandedMlsResourceObj.purgeFromParent) {
          await purgeFromParent(
            mlsResourceObj.name,
            expandedMlsResourceObj.name,
            modifiedIdsToPurge,
            officialFieldName
          );
        }
      }
    }
  }

  // I'm not loving this way of doing things. But to explain it:
  // My current use case is to purge Media records that were originally synced as part of syncing Property records with
  // the expand feature. We need to delete from the Media table using the ResourceRecordKey field (or, what the user
  // maps it to in their table), using the parentIds from the parent table (Property).
  async function purgeFromParent(
    parentMlsResourceName,
    mlsResourceName,
    parentIds,
    officialFieldName
  ) {
    const collectionName = makeCollectionName(mlsResourceName);
    const userFieldName = makeForeignKeyFieldName(
      parentMlsResourceName,
      mlsResourceName,
      officialFieldName
    );

    return client
      .db()
      .collection(collectionName)
      .deleteMany({ [userFieldName]: { $in: parentIds } });
  }

  async function closeConnection() {
    return client.close();
  }

  // "Missing IDs data" means that the goal is to understand which records are not up to date in a reconcile process.
  // So to do that, we look at fields like ModificationTimestamp, PhotosChangeTimestamp, etc. It's those multiple fields
  // that we look at that I'm calling the "data".
  async function fetchMissingIdsData(mlsResourceName, indexes) {
    const collectionName = makeCollectionName(mlsResourceName);
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes);
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName);
    const timestampFieldNames = getTimestampFields(mlsResourceName, indexes);
    const mongoTimestampFieldNames = timestampFieldNames.map(x =>
      makeFieldName(mlsResourceName, x)
    );

    const fieldNamesMongo = [userFieldName, ...mongoTimestampFieldNames].reduce(
      (prev, curr) => {
        prev[curr] = 1;
        return prev;
      },
      {}
    );
    const rows = await client
      .db()
      .collection(collectionName)
      .find({}, fieldNamesMongo)
      .sort({ [userFieldName]: -1 })
      .toArray();
    return rows;
  }

  function computeMissingIds(
    mlsResourceName,
    dataInMls,
    dataInAdapter,
    indexes
  ) {
    const officialFieldName = getPrimaryKeyField(mlsResourceName, indexes);
    const userFieldName = makeFieldName(mlsResourceName, officialFieldName);
    const timestampFieldNames = getTimestampFields(mlsResourceName, indexes);
    const mongoDBTimestampFieldNames = timestampFieldNames.map(x =>
      makeFieldName(mlsResourceName, x)
    );
    const workerPath = pathLib.resolve(__dirname, "worker.js");
    // We copy the data, so we can (possibly) transform the IDs (originally for MLS Grid). I don't love this idea due to
    // the extra memory use. But we can't pass the makePrimaryKeyValueForDestination function to the worker (node throws a
    // DataCloneError). The good news is it's only the index/timestamp fields per record.
    const modifiedDataInMls = _.cloneDeep(dataInMls);
    for (const record of modifiedDataInMls) {
      record[officialFieldName] = makePrimaryKeyValueForDestination(
        mlsResourceName,
        record[officialFieldName]
      );
    }
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: {
          dataInAdapter: dataInAdapter,
          userFieldName,
          dataInMls: modifiedDataInMls,
          officialFieldName,
          timestampFieldNames,
          mongoDBTimestampFieldNames
        }
      });
      worker.on("message", missingOrOldIds => {
        const missingOrOldIdsForMls = missingOrOldIds.map(x =>
          makePrimaryKeyValueForMls(mlsResourceName, x)
        );
        resolve(missingOrOldIdsForMls);
      });
      worker.on("error", error => {
        reject(error);
      });
    });
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
    computeMissingIds
  };
};
