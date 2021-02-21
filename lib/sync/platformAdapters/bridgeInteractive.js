module.exports = function() {
  function getEntityTypes(schemas) {
    return schemas.find(x => x.$.Namespace === 'ODataService').EntityType
  }

  function shouldIncludeJsonField(fieldName) {
    return !fieldName.startsWith('@odata')
  }

  function shouldIncludeMetadataField(fieldName) {
    return null
  }

  async function fetchAuth(config, mlsSourceName) {
    return {
      accessToken: config.sources[mlsSourceName].accessToken,
      // As far into the future as possible
      expiresAt: 2147483647 * 1000,
    }
  }

  return {
    getEntityTypes,
    shouldIncludeJsonField,
    shouldIncludeMetadataField,
    fetchAuth,
  }
}
