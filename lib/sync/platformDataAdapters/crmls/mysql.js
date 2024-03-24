module.exports = function() {
  function getDatabaseType(property) {
    const type = property.$.Type;
    if (type === 'Edm.String') {
      if (property.$.Name === 'ShowingContactPhone') {
        return 'VARCHAR(16)'
      } else if (property.$.Name === 'ListOfficeName') {
        return 'VARCHAR(16)'
      }
      if (!property.$.MaxLength) {
        // I don't think I've run into this, but better safe than sorry.
        return 'TEXT'
      }
      const maxLength = parseInt(property.$.MaxLength, 10)
      if (maxLength > 255) {
        return 'TEXT'
      }
      return `VARCHAR(${maxLength})`
    } else if (type.includes('_Flags')) {
      return 'TEXT'
    } else if (type.includes('OData.Models')) {
      return 'VARCHAR(50)'
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
