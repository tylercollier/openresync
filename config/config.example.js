const pathLib = require('path')



// Reminder: this isn't a great example file currently. It needs to be cleaned up and documented.
// But I figured it's better to capture what I've got now in case I lose the config.js file,
// rather than try to recreate it from the code.




module.exports = {
  version: '0.1.0',
  sources: {
    aborBridgeInteractive: {
      clientId: '',
      clientSecret: '',
      accessToken: '',
      metadataEndpoint: 'https://api.bridgedataoutput.com/api/v2/OData/actris_ref/$metadata',
      replicationEndpoint: 'https://api.bridgedataoutput.com/api/v2/OData/actris_ref/{resource}/replication',
      // replicationEndpoint: 'https://api.bridgedataoutput.com/api/v2/OData/abor_ref/{resource}',
      top: 2000,
      // top: 2,
      // metadataPath: pathLib.resolve(__dirname + '/sources/abor_bridge_interactive/abor_ref_metadata.xml'),
      metadataPath: pathLib.resolve(__dirname, 'sources/abor_bridge_interactive/actris_ref_metadata.xml'),
      useOrderBy: false,
      dataAdapterName: 'mysql',
      mysql: {
        connectionString: 'mysql://user1:password1@localhost:33033/mymls',
      },
      // mlsResources: ['Property'],
      // mlsResources: ['Property', 'Member'],

      // Reminder: The Property resource always includes Media. You can't get rid of it.
      // mlsResources: ['Property', 'Media'],
      makeTableName: name => 'AborBridge' + name,
    },
    aborTrestle: {
      metadataEndpoint: 'https://api-prod.corelogic.com/trestle/odata/$metadata',
      replicationEndpoint: 'https://api-prod.corelogic.com/trestle/odata/{resource}?replication=true',
      clientId: '',
      clientSecret: '',
      metadataPath: pathLib.resolve(__dirname, 'sources/abor_trestle/austin_metadata_trestle.xml'),
      useOrderBy: true,
      dataAdapterName: 'mysql',
      mysql: {
        connectionString: 'mysql://user1:password1@localhost:33033/mymls',
      },
      mlsResources: ['Property', 'Member'],
      // mlsResources: ['Property'],
      // mlsResources: ['Member'],
      // mlsResources: ['Office'],
      // mlsResources: ['CustomProperty'],
      // mlsResources: ['OpenHouse'],
      // mlsResources: ['PropertyRooms'],
      // mlsResources: ['Media'],
      // mlsResources: ['Property', 'Member', 'Office', 'CustomProperty', 'OpenHouse', 'PropertyRooms'],

      // These are listed in the Trestle docs but don't show up in the metadata. Hmm.
      // mlsResources: ['TeamMembers'],
      // mlsResources: ['Teams'],
    },
  },
  server: {
    // port: 4000,
  },
}
