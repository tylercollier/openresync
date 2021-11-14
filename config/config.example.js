// You are encouraged to think of this config file from a programmatic standpoint, as opposed to static configuration.
// For example, you might wish to reuse code that builds endpoint URLs. Such an idea is shown in this example config.
// You can see how getResourceEndpoint, getReplicationEndpoint, and getPurgeEndpoint all make use of the specific
// source's getResourceEndpoint function later in the file.


// All config values are required unless noted as optional.

const pathLib = require('path')

module.exports = () => ({
  // Use the expected config version. This allows us to detect if you are using improper config.
  userConfigVersion: '0.2.0',

  // sources is an array of objects. Each object is a "source", or a connection to an MLS. However, there is nothing
  // preventing you from connecting to an MLS multiple times if necessary. For example, from a single MLS, if you wanted
  // Property resources for the city of Georgetown to go to a MySQL destination table named PropertyA and Property
  // resources for the city of Austin to go to a MySQL destination table named Property B, you'd use two different
  // resources. For convenience, you could share more of their configuration.
  sources: [
    {
      // This first example source uses Bridge Interactive. There is a second example source below that uses Trestle.

      // The name should be thought of as an ID. It will be used for directories and URLs, so don't use spaces, or other
      // characters not permitted in a URL. This name is arbitrary but must be unique among sources.
      name: 'aborBridgeInteractive',

      // Bridge Interactive only requires an access token, so we do not bother to specify a client ID or client secret
      // here. We show that lower in the Trestle example.
      accessToken: process.env.ABOR_BRIDGE_INTERACTIVE_ACCESS_TOKEN,

      // What's the URL to download the metadata XML?
      metadataEndpoint: 'https://api.bridgedataoutput.com/api/v2/OData/actris_ref/$metadata',

      // metadataPath is mainly for debug uses. If you want to speed up your syncs, perhaps during your initial testing
      // phase, you could save the metadata locally on your system and use that file. However, you'll want to not use
      // this value in production.
      // metadataPath: pathLib.resolve(__dirname, 'sources/abor_bridge_interactive/actris_ref_metadata.xml'),

      // getResourceEndpoint is used in non replication scenarios, such as to display stats on the website like how
      // many records are in the source MLS system. You may include $filter values if desired, such as:
      // $filter=PropertyType eq 'Residential'
      // The function accepts an object, which is of type MlsResource, described in the 'mlsResources' item below.
      getResourceEndpoint: aborBridgeInteractive.getResourceEndpoint,

      // Get the replication endpoint for a given MLS Resource. This should be a function that returns a string.
      // The function accepts an object, which is of type MlsResource, described in the 'mlsResources' item below.
      // You may include a $filter query parameter, but that $filter query parameter will be appended (using an AND
      // condition) with timestamps by the openresync application.
      getReplicationEndpoint: mlsResourceObj => {
        const resourceEndpoint = aborBridgeInteractive.getResourceEndpoint(mlsResourceObj)
        const url = new URL(resourceEndpoint)
        url.pathname += '/replication'
        return url.toString()
      },

      // Get the replication endpoint for a given MLS Resource, but meant for purging. This should be a function that
      // returns a string.
      // The function accepts two parameters: 1) MlsResource object, as described in the 'mlsResources' item below.
      // 2) isExpandedMlsResource, a boolean which indicates if the resource is a root or was used as an $expand'd
      // resource. In the latter case, you might perhaps not want to use any $filter condition.
      // Do not include a $select query string parameter; it will be overwritten with the primary key(s) of the
      // resource.

      getPurgeEndpoint: (mlsResourceObj, isExpandedMlsResource) => {
        const resourceEndpoint = aborBridgeInteractive.getResourceEndpoint(mlsResourceObj)
        const url = new URL(resourceEndpoint)
        url.pathname += '/replication'
        if (isExpandedMlsResource) {
          url.searchParams.delete('$filter')
        }
        return url.toString()
      },

      // This should be the largest $top value allowed by the MLS during replication. Bridge Interactive allows 2000.
      top: 2000,

      // This should be the largest $top value allowed by the MLS during replication. This value is no different than
      // top for Bridge Interactive: 2000.
      topForPurge: 2000,

      // Bridge Interactive doesn't allow $orderby during replication.
      useOrderBy: false,

      // Specify the name of the platform. It's either 'bridgeInteractive' or 'trestle'. This will determine things like
      // how authenticatoin is handled, how the XML metadata is interpreted, which fields are ignored, etc.
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
            },
          ],
        },
      ],

      // destinations is an array of objects. Each object is a 'destination', or where data will be written to, such as
      // a MySQL database or Solr.
      destinations: [
        {
          // Here's an example of a destination using the mysql data adapter.

          // The type of the destination, which is 'mysql' or 'solr'.
          type: 'mysql',

          // The name should be thought of as an ID, meant for computers. It is arbitrary but must be unique among
          // destinations.
          name: 'mysql1',

          // This is the config block specifically meant for the destination. It differs per destination. Here's an
          // example for MySQL.
          config: {
            // The username, password, host, port, database name all wrapped into one.
            connectionString: 'mysql://user1:password1@localhost:33033/mymls_bridge',

            // Optional
            // makeTableName allows you to change the name of the table used. It takes the name of the resource and
            // you should return a string. An example use case is if you are using a single database for multiple MLS
            // sources, you might not want each to use the name 'Property' for a table name, so you could use a prefix
            // perhaps based on the name of the MLS, e.g. abor_Property (for Austin Board of Realtors) and
            // crmls_Property (for California Regional MLS). This is optional and if not specified, the resource name
            // will be used.
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
            //       if (fieldName === 'ListingKey') {
            //         return 'Content-ID'
            //       }
            //     }
            //   }
            //   return fieldName
            // }

            // Optional
            // transform allows you to change the record of what would be inserted/updated in the database. If the only
            // difference between what you want inserted/updated is the field names, then you should use the
            // makeFieldName option. But this function would allow you to modify the data in any way, for example change
            // keys, values, add key/value pairs, remove some, etc. It takes the MLS resource name, the record as
            // downloaded, and the metadata object, and should return an object.
            // Note: For the primary key's value, you may return null if your table's primary key is auto-incremented,
            // which is the default.
            // transform: (mlsResourceName, record, metadata) => {
            //   // Return an object. Do not mutate record.
            // }
          },
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
          // crmls_Property (for California Regional MLS). This is optional and if not specified, the resource name
          // will be used.
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
          // downloaded, and the metadata object, a cache object (described below), and should return an object.
          // The "cache" is an (originally an empty) object that we pass each time to the transform function. This
          // allows the transform function to do lookup work when it chooses, e.g. it could do it all on the first pass
          // and not again, or it could potentially do it only on-demand somehow.
          // transform: (mlsResourceName, record, metadata, cache) => {
          //   // Return an object. Do not mutate record.
          // }
        },
      ],

      // Optional
      // Here you can configure when this source and its resources will sync, be purged, or be reconciled (see the
      // README for the difference). It is an object with three properties, sync, purge, and reconcile, which are each
      // objects. Their only property is called cronStrings, and it is an array of cron strings, in the
      // [normal cron format](https://www.npmjs.com/package/cron#cron-ranges). It is technically possible to specify
      // a cron schedule to run too often (like once per second), which should be avoided. A suggested cron schedule for
      // syncing would be `*/15 * * * *`, or every 15 minutes. Check in with your platform to know what's recommended.
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
    },

    // This second source is shown to contrast with the first. It is for Trestle as opposed to Bridge Interactive.
    // Not all values will be commented, just the ones that are different enough to explain.
    {
      name: 'aborTrestle',
      metadataEndpoint: 'https://api-prod.corelogic.com/trestle/odata/$metadata',
      getResourceEndpoint: aborTrestle.getResourceEndpoint,
      getReplicationEndpoint: mlsResourceObj => {
        const resourceEndpoint = aborTrestle.getResourceEndpoint(mlsResourceObj)
        const url = new URL(resourceEndpoint)
        url.searchParams.set('replication', true)
        return url.toString()
      },
      getPurgeEndpoint: (mlsResourceObj, isExpandedMlsResource) => {
        const resourceEndpoint = aborTrestle.getResourceEndpoint(mlsResourceObj)
        const url = new URL(resourceEndpoint)
        url.searchParams.set('replication', true)
        if (isExpandedMlsResource) {
          url.searchParams.delete('$filter')
        }
        return url.toString()
      },

      // Trestle's max for $top is 1000 while Bridge Interactive is 2000.
      top: 1000,

      // This should be the largest $top value allowed by the MLS during replication. Trestle calls the purge process
      // reconciliation, and when only fetching ID fields, allows the $top value to be 300,000.
      // https://trestle-documentation.corelogic.com/webapi-at-scale.html#reconciliation
      topForPurge: 300000,

      // For Trestle, we specify a client ID and client secret.
      clientId: process.env.ABOR_TRESTLE_CLIENT_ID,
      clientSecret: process.env.ABOR_TRESTLE_CLIENT_SECRET,

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
    },
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

const aborBridgeInteractive = {
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

const aborTrestle = {
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
  }
}
