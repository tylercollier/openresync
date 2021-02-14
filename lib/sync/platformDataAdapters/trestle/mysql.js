module.exports = function() {
  function getDatabaseType(property) {
    const type = property.$.Type;
    if (type === 'Edm.String') {
      if (!property.$.MaxLength) {
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

      // For the Property MLS resource, if we use 255, we get:
      //    Row size too large. The maximum row size for the used table type, not counting BLOBs, is 65535
      // Using 253 fixes this.
      if (maxLength > 253) {
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
