module.exports = function() {
  function getEntityTypes(schemas) {
    return schemas.find(x => x.$.Namespace === 'ODataService').EntityType
  }

  function filterField(fieldName) {
    return !fieldName.startsWith('@odata')
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
    filterField,
    fetchAuth,
  }
}
