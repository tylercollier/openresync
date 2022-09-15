// You are encouraged to think of this config file from a programmatic standpoint, as opposed to static configuration.
// For example, you might wish to reuse code that builds endpoint URLs. Such an idea is shown in this example config.
// You can see how getResourceEndpoint, getReplicationEndpoint, and getPurgeEndpoint all make use of the specific
// source's getResourceEndpoint function later in the file.


// All config values are required unless noted as optional.

const pathLib = require('path')
const _ = require("lodash");
const moment = require("moment");

const bridgeInteractive = {
  getResourceEndpoint: mlsResourceObj => {
    const endpoint = `https://api.bridgedataoutput.com/api/v2/OData/actris_ref/${mlsResourceObj.name}`
    const url = new URL(endpoint)
    // These can be useful subsets for dev purposes
    if (mlsResourceObj.name === 'Property') {
      url.searchParams.set('$filter', "City eq 'Georgetown'")
    } else if (mlsResourceObj.name === 'Member') {
      url.searchParams.set('$filter', "MemberCity eq 'Georgetown'")
    }
    return url.toString()
  },
}

const trestle = {
  getResourceEndpoint: mlsResourceObj => {
    const endpoint = `https://api-prod.corelogic.com/trestle/odata/${mlsResourceObj.name}`
    const url = new URL(endpoint)
    // These can be useful subsets for dev purposes
    if (mlsResourceObj.name === 'Property') {
      url.searchParams.set('$filter', "City eq 'Georgetown'")
    } else if (mlsResourceObj.name === 'Member') {
      url.searchParams.set('$filter', "MemberCity eq 'Georgetown'")
    }
    return url.toString()
  },
}

const mlsGridRealtracs = () => {
  function removeIdPrefix(val) {
    return val.substring(3)
  }

  return {
    getResourceEndpoint: mlsResourceObj => {
      const endpoint = `https://api.mlsgrid.com/v2/${mlsResourceObj.name}`
      const url = new URL(endpoint)
      const filter = url.searchParams.get('$filter')
      url.searchParams.set('$filter', `(${filter} and MlgCanView eq true and OriginatingSystemName eq 'realtrac')`)
      return url.toString()
    },
    mlsGridPrefixedKeyFields: {
      // This is not an exhaustive list for all resources.
      Property: new Set([
        'BuyerAgentKey',
        'BuyerAgentMlsId',
        'BuyerOfficeKey',
        'BuyerOfficeMlsId',
        'ListAgentKey',
        'ListAgentMlsId',
        'ListOfficeKey',
        'ListOfficeMlsId',
        'ListingId',
        'ListingKey',
      ]),
      Media: new Set([
        'MediaObjectID'
      ]),
    },
    maybeRemovePrefixFromKeyFieldValue(record, fieldName) {
      if (record[fieldName]) {
        record[fieldName] = removeIdPrefix(record[fieldName])
      }
    },
  }
}

const bridgeExample = {
  // The name should be thought of as an ID. It will be used for directories and URLs, so don't use spaces, or other
  // characters not permitted in a URL. This name is arbitrary but must be unique among sources.
  name: 'bridgeInteractive',

  // Bridge Interactive only requires an access token, so we do not bother to specify a client ID or client secret
  // here. We show that lower in the Trestle example.
  accessToken: process.env.BRIDGE_INTERACTIVE_ACCESS_TOKEN,

  // What's the URL to download the metadata XML?
  metadataEndpoint: 'https://api.bridgedataoutput.com/api/v2/OData/actris_ref/$metadata',

  // Optional
  // metadataPath is mainly for debug uses. It overrides fetching the metadata from metadataEndpoint. If you want to
  // speed up your syncs, perhaps during your initial testing phase, you could save the metadata locally on your system
  // and use that file. However, you'll want to not use this value in production, such that the metadataEndpoint URL is
  // used.
  // metadataPath: pathLib.resolve(__dirname, 'sources/bridge_interactive/actris_ref_metadata.xml'),

  // getResourceEndpoint is used in non replication scenarios, such as to display stats on the website like how
  // many records are in the source MLS system. You may include $filter values if desired, such as:
  // $filter=PropertyType eq 'Residential'
  // The function accepts an object, which is of type MlsResource, described in the 'mlsResources' item below.
  getResourceEndpoint: bridgeInteractive.getResourceEndpoint,

  // Get the replication endpoint for a given MLS Resource. This should be a function that returns a string.
  // The function accepts an object, which is of type MlsResource, described in the 'mlsResources' item below.
  // You may include a $filter query parameter, but that $filter query parameter will be appended (using an AND
  // condition) with timestamps by the openresync application.
  getReplicationEndpoint: mlsResourceObj => {
    const resourceEndpoint = bridgeInteractive.getResourceEndpoint(mlsResourceObj)
    const url = new URL(resourceEndpoint)
    url.pathname += '/replication'
    return url.toString()
  },

  // Get the replication endpoint for a given MLS Resource, but meant for purging. This should be a function that
  // returns a string.
  // The function accepts two parameters:
  // 1) MlsResource object, as described in the 'mlsResources' item below.
  // 2) isExpandedMlsResource, a boolean which indicates if the resource is a root or was used as an $expand'ed
  // resource. In the latter case, you might perhaps not want to use any $filter condition.
  // Do not include a $select query string parameter; it will be overwritten with the primary key(s) of the
  // resource.

  getPurgeEndpoint: (mlsResourceObj, isExpandedMlsResource) => {
    const resourceEndpoint = bridgeInteractive.getResourceEndpoint(mlsResourceObj)
    const url = new URL(resourceEndpoint)
    url.pathname += '/replication'
    if (isExpandedMlsResource) {
      url.searchParams.delete('$filter')
    }
    return url.toString()
  },

  // Optional. If not specified, will use getPurgeEndpoint.
  // Get the reconcile endpoint for a given MLS Resource, but meant for reconciling. This should be a function that
  // returns a string.
  // The function accepts two parameters:
  // 1) MlsResource object, as described in the 'mlsResources' item below.
  // 2) isExpandedMlsResource, a boolean which indicates if the resource is a root or was used as an $expand'ed
  // resource. In the latter case, you might perhaps not want to use any $filter condition.
  // Do not include a $select query string parameter; it will be overwritten with the primary key(s) of the
  // resource.
  // getReconcileEndpoint: (mlsResourceObj, isExpandedMlsResource) => string

  // This should be the largest $top value allowed by the MLS during replication. Bridge Interactive allows 2000.
  top: 2000,

  // This should be the largest $top value allowed by the MLS during replication. This value is no different than
  // top for Bridge Interactive: 2000.
  topForPurge: 2000,

  // Bridge Interactive doesn't allow $orderby during replication.
  useOrderBy: false,

  // Specify the name of the platform. It's one of 1) bridgeInteractive 2) trestle, or 3) mlsgrid. This will determine
  // things like how authentication is handled, how the XML metadata is interpreted, which fields are ignored, etc.
  platformAdapterName: 'bridgeInteractive',

  // mlsResources is an array of objects. Each object represents a resource in the MLS, such as Property, Member,
  // etc. The name is the case sensitive name from the MLS.
  // Other optional fields are
  //   * select: used for $select on the replication endpoint. An array of strings that are the field names.
  //   * expand: used for $expand. An array of objects, where each object is a subresource. Has these properties:
  //     * name: The TYPE of the subresource, for example Property might have an $expand of BuyerAgent. In this
  //             case, the TYPE of the subresource maps to Member, so set the name to Member.
  //     * fieldName: with the example above where Property has an $expand of BuyerAgent, the 'fieldName' would be
  //                  BuyerAgent
  //     * purgeFromParent: boolean (optional, default false). For an expanded resource, should we delete the records
  //                        when the parent is updated or purged (deleted)? In short, you'd want to set this to false if
  //                        the $expand'ed resource can stand on its own, and true if it only makes sense to exist with
  //                        the parent. Let's use an example. If we are syncing the Property resource, with an $expand
  //                        of Media, and an update of the Property record comes in, how should we handle the existing
  //                        Media records we've already synced for that Property record? We probably want to delete
  //                        them, because we will be syncing the new set of Media records, and this simply solves the
  //                        problem whereby the new set of Media records has fewer or different records than before. As
  //                        another example though, if we are syncing the Property resource, with an $expand of Member,
  //                        and if the MLS the Property record has been deleted, do we want to delete its related Member
  //                        record? Probably not, because of the likelihood that other Property records refer to that
  //                        Member.
  //     The name and fieldName might be identical, for example Property has an $expand of Media whose fieldName is
  //     also Media.
  mlsResources: [
    {
      name: 'Member',
    },
    {
      name: 'Property',
      expand: [
        {
          name: 'Media',
          fieldName: 'Media',
          purgeFromParent: true,
        },
      ],
    },
  ],

  // destinations is an array of objects. Each object is a 'destination', or where data will be written to, such as
  // a MySQL database or Solr.
  destinations: [
    {
      // Here's an example of a destination using the MySQL data adapter. There's an example for Solr later.

      // The type of the destination, which is 'mysql' or 'solr'.
      type: 'mysql',

      // The name should be thought of as an ID, meant for computers. It is arbitrary but must be unique among
      // destinations.
      name: 'mysql1',

      // This is the config block specifically meant for the destination. The keys/values vary per destination. Here's
      // an example for MySQL.
      config: {
        // The username, password, host, port, database name all wrapped into one.
        connectionString: 'mysql://user1:password1@localhost:33033/mymls_bridge',

        // Optional
        // makeTableName allows you to change the name of the table used. It's a function that takes the name of the
        // resource and you should return a string. An example use case is if you are using a single database for
        // multiple MLS sources, you might not want each to use the name 'Property' for a table name, so you could use a
        // prefix perhaps based on the name of the MLS, e.g. abor_Property (for Austin Board of Realtors) and
        // crmls_Property (for California Regional MLS). If not specified, the resource name will be used.
        // makeTableName: name => 'mytableprefix_' + name,

        // Optional
        // makeFieldName allows you to change the name of the field used. RESO Web API field names are
        // PascalCase, but you might prefer, for example, snake_case.
        // Note: if you use the transform function, described below, the field names your function will receive are
        // the keys from the object you return from transform().
        // makeFieldName: name => 'myfieldprefix_' + name,

        // Optional
        // shouldSyncTableSchema allows you to opt out of a table's schema being synced. The MySQL data adapter
        // synchronizes table schema, which is handy when new fields are added or removed
        // over time. It takes the MLS resource name and should return a boolean. Default returns true.
        // If you return false, it means that you are responsible for creating the table as well as altering.
        // shouldSyncTableSchema: function(mlsResourceName) {
        //   if (mlsResourceName === 'Media') {
        //     return false
        //   }
        //   return true
        // }

        // Optional
        // makeForeignKeyFieldName is used in the purge process. If, in the mlsResources section above, you use the
        // 'expand' property to sync subresources, and the primary key of the subresource's table differs from the
        // MLS's, you will need to use this. It's a function that takes in the parent MLS resource name, the sub-
        // resource name, and the field name, and returns the name of your primary key.
        // makeForeignKeyFieldName: (parentMlsResourceName, mlsResourceName, fieldName) => {
        //   if (mlsResourceName === 'Media') {
        //     if (parentMlsResourceName === 'Property') {
        //       return 'Content-ID'
        //     }
        //   }
        //   return fieldName
        // }

        // Optional
        // transform allows you to change the record of what would be inserted/updated in the destination. If the only
        // difference between what you want inserted/updated is the field names, then you should use the
        // makeFieldName option. But this function would allow you to modify the data in any way, for example change
        // keys, values, add key/value pairs, remove some, etc. It takes the MLS resource name, the record as
        // downloaded, the metadata, and, if the record is from an $expand'ed resource, the (potentially transformed)
        // parent object, and finally, a cache object, and should return an object. Do not mutate the record passed in.
        // Note: For the primary key's value, you may return null if your table's primary key is auto-incremented, which
        // is the default.
        // The "cache" is an (initially empty) object that we pass each time to the transform function, on which you may
        // put any data you wish. This allows the transform function to e.g. do lookup work when it chooses; it could do
        // it all on the first pass and not again, or it could potentially do it only on-demand somehow.
        // transform: (mlsResourceName, record, metadata, transformedParentRecord, cache) => {
        //   // Return an object. Do not mutate record. As in, make a copy, modify and return that.
        // }
      },

      // Optional
      // Because this is primarily targeted for use with the MLS Grid platform, it will be explained in the MLS Grid
      // example below.
      // makePrimaryKeyValueForDestination: (mlsResourceName, id) => id

      // Optional
      // Because this is primarily targeted for use with the MLS Grid platform, it will be explained in the MLS Grid
      // example below.
      // makePrimaryKeyValueForMls: (mlsResourceName, id) => id
    },
    {
      // Here's an example of a destination using the Solr data adapter.

      // The type of the destination, which is 'mysql' or 'solr'.
      type: 'solr',

      // The name should be thought of as an ID, meant for computers. It is arbitrary but must be unique among
      // destinations.
      name: 'solr1',

      // Optional
      // host: The host of the Solr instance.

      // Optional
      // port: The port of the Solr instance.

      // Optional
      // makeCoreName allows you to change the name of the core used. It takes the name of the resource and
      // you should return a string. An example use case is if you are using a single Solr instance for multiple MLS
      // sources, you might not want each to use the name 'Property' for a core name, so you could use a prefix
      // perhaps based on the name of the MLS, e.g. abor_Property (for Austin Board of Realtors) and
      // crmls_Property (for California Regional MLS). If not specified, the resource name will be used.
      // makeCoreName: name => 'mycoreprefix_' + name,

      // FIXME: This option is not yet used in syncData().
      // Optional
      // makeFieldName allows you to change the name of the field used. RESO Web API field names are
      // PascalCase, but you might prefer, for example, camelCase.
      // Note: if you use the transform function, described below, the field names your function will receive are
      // the keys from the object you return from transform().
      // makeFieldName: name => 'myfieldprefix_' + name,

      // Optional
      // transform allows you to change the record of what would be inserted/updated in the core. If the only
      // difference between what you want inserted/updated is the field names, then you should use the
      // makeFieldName option. But this function would allow you to modify the data in any way, for example change
      // keys, values, add key/value pairs, remove some, etc. It takes the MLS resource name, the record as
      // downloaded, the metadata object, and a cache object, and should return an object.
      // The "cache" is an (initially empty) object that we pass each time to the transform function, on which you may
      // put any data you wish. This allows the transform function to e.g. do lookup work when it chooses; it could do
      // it all on the first pass and not again, or it could potentially do it only on-demand somehow.
      // TODO: The transformedParentRecord parameter doesn't exist, as it does in the MySQL data adapter, because I
      // have not personally needed it. Its main motivation is for relational databases and might not be needed in Solr,
      // which supports nested documents, although it wouldn't hurt to have it. It could be added by request.
      // transform: (mlsResourceName, record, metadata, cache) => {
      //   // Return an object. Do not mutate record. As in, make a copy, modify and return that.
      // }

      // Optional
      // Because this is primarily targeted for use with the MLS Grid platform, it will be explained in the MLS Grid
      // example below.
      // makePrimaryKeyValueForDestination: (mlsResourceName, id) => id

      // Optional
      // Because this is primarily targeted for use with the MLS Grid platform, it will be explained in the MLS Grid
      // example below.
      // makePrimaryKeyValueForMls: (mlsResourceName, id) => id
    },
  ],

  // Optional
  // Here you can configure when this source and its resources will sync, be purged, or be reconciled (see the
  // README for the difference) on a schedule. It is an object with three properties: sync, purge, and reconcile, which
  // are each objects. Their only property is called cronStrings, and it is an array of cron strings, in the
  // [normal cron format](https://www.npmjs.com/package/cron#cron-ranges). It is technically possible to specify
  // a cron schedule to run too often (like once per second), which should be avoided. A suggested cron schedule for
  // syncing would be `*/15 * * * *`, or every 15 minutes. Consult with your platform to know what's recommended.
  cron: {
    // Optional. If not included, syncs will not be performed.
    sync: {
      // Optional
      // Specify whether sync cron jobs will be run.
      // enabled: true,

      // Optional. If not included, syncs will not be performed.
      // Specify an array of cron strings for when the sync cron job(s) should be run.
      cronStrings: ['0 * * * *'],
    },

    // Optional. If not included, purges will not be performed.
    purge: {
      // Optional
      // Specify whether purge cron jobs will be run.
      // enabled: true,

      // Optional. If not included, purges will not be performed.
      // Specify an array of cron strings for when the purge cron job(s) should be run.
      cronStrings: ['15 * * * *'],
    },

    // Optional. If not included, reconciles will not be performed.
    reconcile: {
      // Optional
      // Specify whether reconcile cron jobs will be run.
      // enabled: true,

      // Optional. If not included, reconciles will not be performed.
      // Specify an array of cron strings for when the reconcile cron job(s) should be run.
      cronStrings: ['30 * * * *']
    },
  },
}

// This source is shown to contrast with the Bridge Interactive one above. It is for Trestle. Not all values will be
// commented, just the ones that are different enough merit explanation. If you aren't using Bridge Interactive, you
// should still look at the example for Bridge Interactive above because the options are mainly documented there.
const trestleExample = {
  name: 'trestle',
  metadataEndpoint: 'https://api-prod.corelogic.com/trestle/odata/$metadata',
  getResourceEndpoint: trestle.getResourceEndpoint,
  getReplicationEndpoint: mlsResourceObj => {
    const resourceEndpoint = trestle.getResourceEndpoint(mlsResourceObj)
    const url = new URL(resourceEndpoint)
    url.searchParams.set('replication', true)
    return url.toString()
  },
  getPurgeEndpoint: (mlsResourceObj, isExpandedMlsResource) => {
    const resourceEndpoint = trestle.getResourceEndpoint(mlsResourceObj)
    const url = new URL(resourceEndpoint)
    url.searchParams.set('replication', true)
    if (isExpandedMlsResource) {
      url.searchParams.delete('$filter')
    }
    return url.toString()
  },

  top: 200,

  // This should be the largest $top value allowed by the MLS during replication. Trestle calls the purge process
  // reconciliation, and when only fetching ID fields, allows the $top value to be 300,000.
  // https://trestle-documentation.corelogic.com/webapi-at-scale.html#reconciliation
  topForPurge: 300000,

  // For Trestle, we specify a client ID and client secret.
  clientId: process.env.TRESTLE_CLIENT_ID,
  clientSecret: process.env.TRESTLE_CLIENT_SECRET,

  // Trestle allows $orderby during replication.
  useOrderBy: true,

  platformAdapterName: 'trestle',
  mlsResources: [
    {
      name: 'Property',
      expand: [
        {
          name: 'Member',
          fieldName: 'ListAgent',
        },
        {
          name: 'Media',
          fieldName: 'Media',
          purgeFromParent: true,
        },
      ],
    },
  ],
  destinations: [
    {
      name: 'mysql1',
      type: 'mysql',
      config: {
        connectionString: 'mysql://user1:password1@localhost:33033/mymls_trestle',
      },
    },
  ],
  cron: {
    sync: {
      cronStrings: ['10 * * * *'],
    },
    purge: {
      cronStrings: ['25 * * * *'],
    },
    reconcile: {
      cronStrings: ['40 * * * *'],
    },
  },
}

// This source is shown to contrast with the Bridge Interactive one above. It is for MLS Grid. Not all values will be
// commented, just the ones that are different enough merit explanation. If you aren't using Bridge Interactive, you
// should still look at the example for Bridge Interactive above because the options are mainly documented there.
//
// Note that MLS Grid has enough differences that it is discussed in the file at docs/mls-grid.md.
// As an instance of a major difference compared to other platforms, MLS Grid requires an OriginatingSystemName in every
// request that essentially specifies the MLS you want to work with (even if your license only gives you access to one
// MLS anyway). In this example, the MLS named Realtracs is used.
const mlsGridExample = {
  name: 'mlsGrid',
  metadataEndpoint: "https://api.mlsgrid.com/v2/$metadata",
  getResourceEndpoint: mlsGridRealtracs.getResourceEndpoint,
  // MLS Grid only supports replication (not live queries), so there's not a separate query for replication.
  getReplicationEndpoint: mlsGridRealtracs.getResourceEndpoint,
  getPurgeEndpoint: mlsGridRealtracs.getResourceEndpoint,

  top: 100,
  topForPurge: 5000,

  accessToken: process.env.REALTRACS_ACCESS_TOKEN,

  // MLS Grid doesn't allow $orderby during replication.
  useOrderBy: false,

  platformAdapterName: 'mlsGrid',
  mlsResources: [
    {
      name: 'Property',
      expand: [
        {
          name: 'Media',
          fieldName: 'Media',
          purgeFromParent: true,
        },
      ],
    },
  ],
  destinations: [
    {
      name: 'mysql1',
      type: 'mysql',
      config: {
        connectionString: 'mysql://user1:password1@localhost:33033/mymls_trestle',
        transform: (mlsResourceName, record, metadata, transformedParentRecord) => {
          if (mlsResourceName === 'Property') {
            const r = _.clone(record)

            // MLS Grid uses JSON arrays for fields that allow multiple values, e.g. Appliances. You could stick them
            // directly into your database as JSON. However, this serves as an example of if you wanted them to be a
            // flat value. In this case, put them into a single comma-delimited string.
            // for (const key of Object.keys(r)) {
            //   if (Array.isArray(r[key])) {
            //     r[key] = r[key].join(',')
            //   }
            // }

            // See docs/mls-grid.md for a longer explanation of this, but essentially they prefix their keys with three
            // letters (corresponding to the MLS, e.g. for Realtracs, it's RTC). To get the "real" key, we need to strip
            // off those first 3 letters for all fields that have them.
            for (const key of mlsGridRealtracs.mlsGridPrefixedKeyFields[mlsResourceName]) {
              mlsGridRealtracs.maybeRemovePrefixFromKeyFieldValue(r, key)
            }

            return r
          } else if (mlsResourceName === 'Media') {
            // MLS Grid doesn't have foreign keys on Media records because Media records can only be obtained via
            // $expand. That makes sense, but since we are using a relational database, we need a key to tie the Media
            // record back to its parent. We use the transformedParentRecord.
            const r = _.clone(record)
            for (const key of mlsGridRealtracs.mlsGridPrefixedKeyFields[mlsResourceName]) {
              mlsGridRealtracs.maybeRemovePrefixFromKeyFieldValue(r, key)
            }
            return {
              ListingId: transformedParentRecord.ListingId,
              ...r,
            }
          }
          return record
        },
        // Optional
        // makePrimaryKeyValueForDestination() allows you to manipulate the primary key when storing in your
        // destination(s). The original use case is this: MLS Grid prefixes its primary keys with the MLS abbreviation
        // identifier. For example, for the Realtracs MLS, it uses RTC, such that the primary key of abc123 is in the
        // data feed as RTCabc123. If you, for example, wanted to display the ID on a website, you wouldn't want to show
        // RTCabc123 though, you'd want to display abc123. Perhaps when interacting with other (non MLS Grid) systems,
        // you'd want to use abc123. In such case, in this function you'd want to strip off the prefix of RTC and return
        // 'abc123'. However, when interacting with MLS Grid, you need to use RTCabc123. That's what the function
        // makePrimaryKeyValueForMls() is for. It's basically the inverse.
        makePrimaryKeyValueForDestination: (mlsResourceName, id) => {
          if (mlsResourceName === 'Property') {
            return id.substring(3)
          }
          return id
        },
        // Optional
        // See the description above about makePrimaryKeyValueForDestination().
        makePrimaryKeyValueForMls: (mlsResourceName, id) => {
          if (mlsResourceName === 'Property') {
            return 'RTC' + id
          }
          return id
        },
      },
    },
    {
      name: 'solr1',
      type: 'solr',
      config: {
        host: 'solr.test',
        makeCoreName: mlsResourceName => {
          // Ensure we use a different core than our other OpenReSync sources use.
          return `realtracs_${mlsResourceName}`
        },
        transform: (mlsResourceName, record, metadata, cache) => {
          if (mlsResourceName === 'Property') {
            const r = _.extend({}, record)

            // MLS Grid uses JSON arrays for fields that allow multiple values, e.g. Appliances. You could stick them
            // directly into your database as JSON. However, this serves as an example of if you wanted them to be a
            // flat value. In this case, put them into a single comma-delimited string.
            // for (const key of Object.keys(r)) {
            //   if (Array.isArray(r[key])) {
            //     r[key] = r[key].join(',')
            //   }
            // }

            // See docs/mls-grid.md for a longer explanation of this, but essentially they prefix their keys with three
            // letters (corresponding to the MLS, e.g. for Realtracs, it's RTC). To get the "real" key, we need to strip
            // off those first 3 letters for all fields that have them.
            for (const key of mlsGridRealtracs.mlsGridPrefixedKeyFields[mlsResourceName]) {
              mlsGridRealtracs.maybeRemovePrefixFromKeyFieldValue(r, key)
            }

            // OpenReSync does not generate Solr schemas. The exact value for dates, for your Solr core, can't be known
            // by OpenReSync. It's your option to format as desired here. This example determines date fields by their
            // name as a simple example, but you could also use the metadata.
            // for (const key in r) {
            //   if ((key.endsWith('Date') || key.endsWith('Timestamp') || key.endsWith('Time')) && r[key]) {
            //     r[key] = moment.utc(r[key]).format("YYYY-MM-DDTHH:mm:ss.SSS") + 'Z'
            //   }
            // }

            return r
          }
          throw new Error("Wasn't expecting to get to here in transformDocument")
        },
        makePrimaryKeyValueForDestination: (mlsResourceName, id) => {
          if (mlsResourceName === 'Property') {
            return id.substring(3)
          }
          throw new Error("Wasn't expecting to get here in makePrimaryKeyValueForDestination")
        },
        makePrimaryKeyValueForMls: (mlsResourceName, id) => {
          if (mlsResourceName === 'Property') {
            return 'RTC' + id
          }
          throw new Error("Wasn't expecting to get here in makePrimaryKeyValueForMls")
        },
      },
    },
  ],
  cron: {
    sync: {
      cronStrings: ['12 * * * *'],
    },
    purge: {
      cronStrings: ['27 * * * *'],
    },
    reconcile: {
      cronStrings: ['42 * * * *'],
    },
  },
}

module.exports = () => ({
  // Use the expected config version. This allows us to detect if you are using improper config.
  userConfigVersion: '0.3.0',

  // sources is an array of objects. Each object is a "source", or a connection to an MLS. However, there is nothing
  // preventing you from connecting to an MLS multiple times if necessary. For example, from a single MLS, if you wanted
  // Property resources for the city of Georgetown to go to a MySQL destination table named PropertyA and Property
  // resources for the city of Austin to go to a MySQL destination table named Property B, you'd use two different
  // resources. For convenience, you could share more of their configuration.
  sources: [
    // See these example source objects later in this config file. Regardless of which platform you are connecting to,
    // be sure to see the bridgeExample example source because it contains the most documentation on the possible
    // values.
    bridgeExample,
    trestleExample,
    mlsGridExample,
  ],

  // Optional
  server: {
    // Optional
    // The server runs on this port. Defaults to 4000.
    // port: 4000,
  },

  // This database is used for stats, such as keeping the history of the sync, e.g. when the sync (or purge) occurred,
  // how many records were synced per resource and destination, etc.
  database: {
    // connectionString: 'mysql://user1:password1@localhost:33033/openresync',
    connectionString: 'mysql://user1:password1@localhost:33033/qa',
  },
})
