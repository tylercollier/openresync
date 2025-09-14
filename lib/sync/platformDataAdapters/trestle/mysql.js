module.exports = function() {
  function getDatabaseType(property) {
    const type = property.$.Type;
    if (type === 'Edm.String') {
      if (!property.$.MaxLength) {
        // I don't think I've run into this, but better safe than sorry.
        return 'TEXT'
      }
      const maxLength = parseInt(property.$.MaxLength, 10)

      // Below, we handle a problem where we turn some fields from VARCHAR into TEXT. But we shouldn't do that for key
      // fields.
      // TODO: Ideally these fields would come from the metadata, but since they'll change rarely this should be good
      // enough for now.
      const keyNames = [
        'ListingId',
        'ListingKey',
        'MediaKey',
        'MemberKey',
        'OfficeKey',
        'OpenHouseKey',
        'RoomKey',
        'TeamKey',
        'TeamMemberKey',
      ]
      if (keyNames.includes(property.$.Name)) {
        return `VARCHAR(${maxLength})`
      }

      if (maxLength > 255) {
        return 'TEXT'
      }
      return `VARCHAR(${maxLength})`
    } else if (type.startsWith('Cotality.DataStandard.RESO.DD.Enums.Multi')) {
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
