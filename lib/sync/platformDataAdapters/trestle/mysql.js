module.exports = function() {
  function getDatabaseType(property) {
    const type = property.$.Type;
    if (type === 'Edm.String') {
      if (!property.$.MaxLength) {
        return 'TEXT'
      }
      const maxLength = parseInt(property.$.MaxLength, 10)

      // Do not allow index fields to be turned into TEXT
      // TODO: We should be checking all indexes here (whether they come from the platform
      // or even if we allow the user to specify them)
      if (property.$.Name === 'ListingKey' || property.$.Name === 'ListingId') {
        return `VARCHAR(${maxLength})`
      }

      // For the Property MLS resource, if we use 255, we get:
      //    Row size too large. The maximum row size for the used table type, not counting BLOBs, is 65535
      // Using 254 fixes this.
      if (maxLength > 254) {
        return 'TEXT'
      }
      return `VARCHAR(${maxLength})`
    } else if (type.startsWith('CoreLogic.DataStandard.RESO.DD.Enums')) {
        return 'TEXT'
    }

    return null
  }

  function overridesDatabaseType(property) {
    return getDatabaseType(property) !== null
  }

  return {
    overridesDatabaseType,
    getDatabaseType,
  }
}
