// You are encouraged to think of this config file from a programmatic standpoint, as opposed to static configuration.
// For example, you might wish to reuse code that builds endpoint URLs. Such an idea is shown in this example config.
// You can see how getResourceEndpoint, getReplicationEndpoint, and getPurgeEndpoint all make use of the specific
// source's getResourceEndpoint function later in the file.




const pathLib = require('path')

module.exports = () => ({
  // Use the expected config version. This allows us to detect if you are using improper config.
  version: '0.1.0',

  // sources is an array of objects. Each object is a "source", or a connection to an MLS. However, there is nothing
  // preventing you from connecting to an MLS multiple times if necessary. For example, from a single MLS, if you wanted
  // Property resources for the city of Georgetown to go to a MySQL destination table named PropertyA and Property
  // resources for the city of Austin to go to a MySQL destination table named Property B, you'd use two different
  // resources. For convenience, you could share more of their configuration.
  sources: [
    {
      // The name should be thought of as an ID. It will be used for directories and URLs, so don't spaces, or other characters not
      // permitted in a URL. This name is arbitrary but must be unique among sources.
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

      // getResourceEndpoint is used in non replication scenarios, such as to displaying stats on the website like how
      // many records are in the source MLS system.
      getResourceEndpoint: aborBridgeInteractive.getResourceEndpoint,

      // Get the replication endpoint for a given MLS Resource. This should be a function that returns a string.
      // The function accepts an object, which is of type MlsResource, described in the 'mlsResources' item below.
      // It made include a $filter query parameter, but that $filter query parameter will be appended to (with an AND
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
      // resource. In the latter case, you might perhaps want to use any $filter condition.
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

      // destinations is an array of objects. Each object is a 'destination', or where data will be written to, such as
      // a MySQL database.
      destinations: [
        {
          // The name should be thought of as an ID, meant for computers. It is arbitrary but must be unique among
          // destinations.
          name: 'mysql1',

          // The type of the destination, which is 'mysql' or 'devnull' (meant for debug purposes).
          type: 'mysql',

          // This is the config block specifically meant for the destination. It differs per destination,
          // although it's moot now since only MySQL is supported.
          config: {
            // The username, password, host, port, database name all wrapped into one.
            connectionString: 'mysql://user1:password1@localhost:33033/mymls_bridge',

            // makeTableName allows you to change the name of the table used. It takes the name of the resource and
            // you should return a string. An example use case is if you are using a single database for multiple MLS
            // sources, you might not want each to use the name 'Property' for a table name, so you could use a prefix
            // perhaps based on the name of the MLS, e.g. abor_Property (for Austin Board of Realtors) and
            // crmls_Property (for California Regional MLS). This is optional and if not specified, the resource name
            // will be used.
            // makeTableName: name => 'mytableprefix_' + name,

            // Same idea as makeTableName above
            // makeFieldName: name => 'myfieldprefix_' + name,
          },
        },
      ],

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

      // Here you can configure when this source and its resources will sync (or be purged). It is an object with two
      // properties, sync and purge, which are both objects. Their only property is called cronString, and it is in the
      // [normal cron format](https://www.npmjs.com/package/cron#cron-ranges). It is technically possible to specify
      // a cron schedule to run too often (like once per second), which should be avoided. A suggested cron schedule for
      // syncing would be `*/15 * * * *`, or every 15 minutes. Check in with your platform to know what's recommended.
      cron: {
        sync: {
          cronString: '0 * * * *',
        },
        purge: {
          cronString: '30 0 * * *',
        },
      },
    },

    // This second source is shown to contrast with the first. It is for Trestle as opposed to Brige Interactive.
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
          cronString: '15 * * * *',
        },
        purge: {
          cronString: '45 0 * * *',
        },
      },
    },
  ],

  // The server runs on this port. Defaults to 4000.
  server: {
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
