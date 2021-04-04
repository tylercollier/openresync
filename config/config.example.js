// This is a copy of my config file (as of this commit). So it's not documented but you can see
// real examples of how I'm using it, including making use of JavaScript and programming. As in,
// showing why the config file is a JS file instead of JSON.
// In the future it'd be best to have the config documented and show examples.



const pathLib = require('path')

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

module.exports = () => ({
  version: '0.1.0',
  sources: [
    {
      name: 'aborBridgeInteractive',
      clientId: process.env.ABOR_BRIDGE_INTERACTIVE_CLIENT_ID,
      clientSecret: process.env.ABOR_BRIDGE_INTERACTIVE_CLIENT_SECRET,
      accessToken: process.env.ABOR_BRIDGE_INTERACTIVE_ACCESS_TOKEN,
      metadataEndpoint: 'https://api.bridgedataoutput.com/api/v2/OData/actris_ref/$metadata',
      metadataPath: pathLib.resolve(__dirname, 'sources/abor_bridge_interactive/actris_ref_metadata.xml'),
      getResourceEndpoint: aborBridgeInteractive.getResourceEndpoint,
      getReplicationEndpoint: mlsResourceObj => {
        const resourceEndpoint = aborBridgeInteractive.getResourceEndpoint(mlsResourceObj)
        const url = new URL(resourceEndpoint)
        url.pathname += '/replication'
        return url.toString()
      },
      getPurgeEndpoint: (mlsResourceObj, isExpandedMlsResource) => {
        const resourceEndpoint = aborBridgeInteractive.getResourceEndpoint(mlsResourceObj)
        const url = new URL(resourceEndpoint)
        url.pathname += '/replication'
        if (isExpandedMlsResource) {
          url.searchParams.delete('$filter')
        }
        return url.toString()
      },
      top: 2000,
      topForPurge: 2000,
      // top: 2,
      useOrderBy: false,
      destinations: [
        {
          name: 'mysql1',
          type: 'mysql',
          config: {
            // connectionString: 'mysql://user1:password1@localhost:33033/mymls_bridge',
            connectionString: 'mysql://user1:password1@localhost:33033/openresync',

            // These are here basically as a reminder that I could use them.
            // makeTableName: name => 'tyler' + name,
            // makeFieldName: name => 'myfield' + name,
          },
        },
        // {
        //   name: 'devnull1',
        //   type: 'devnull',
        // },
      ],
      platformAdapterName: 'bridgeInteractive',
      // mlsResources: [
      //   {
      //     name: 'Member',
      //   },
      // ],
      // mlsResources: [
      //   {
      //     name: 'Property',
      //   },
      // ],
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
      cron: {
        // sync: {
        //   cronString: '0 * * * *',
        // },
        // purge: {
        //   cronString: '30 0 * * *',
        // },
      },
    },
    {
      name: 'aborTrestle',
      metadataEndpoint: 'https://api-prod.corelogic.com/trestle/odata/$metadata',
      metadataPath: pathLib.resolve(__dirname, 'sources/abor_trestle/austin_metadata_trestle.xml'),
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
      top: 1000,
      topForPurge: 300000,
      clientId: process.env.ABOR_TRESTLE_CLIENT_ID,
      clientSecret: process.env.ABOR_TRESTLE_CLIENT_SECRET,
      useOrderBy: true,
      platformAdapterName: 'trestle',
      mlsResources: [
        // {
        //   name: 'Member',
        // },
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

      // These are listed in the Trestle docs but don't show up in the metadata. Hmm.
      // mlsResources: ['TeamMembers'],
      // mlsResources: ['Teams'],
      destinations: [
        {
          name: 'mysql1',
          type: 'mysql',
          config: {
            // connectionString: 'mysql://user1:password1@localhost:33033/mymls_trestle',
            connectionString: 'mysql://user1:password1@localhost:33033/openresync',
          },
        },
        // {
        //   name: 'devnull1',
        //   type: 'devnull',
        // },
      ],
      cron: {
        sync: {
          cronString: '*/1 * * * *',
        },
        // purge: {
        //   cronString: '45 0 * * *',
        // },
      },
    },
  ],
  server: {
    // port: 4000,
  },
  database: {
    connectionString: 'mysql://user1:password1@localhost:33033/openresync',
    // connectionString: 'mysql://user1:password1@localhost:33033/qa',
  },
})
