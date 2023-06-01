module.exports = function() {
  function isIndexField(fieldName) {
    const keyNames = [
      'ListingId',
      'ListingKey',
      'MediaKey',
      'MemberKey',
      'OfficeKey',
      'OpenHouseKey',
      'RoomKey',
      'UnitTypeKey'
    ]
    return keyNames.includes(fieldName)
  }

  function getDatabaseType(property) {
    const type = property.$.Type;
    if (type === 'Edm.String') {
      if (!property.$.MaxLength) {
        if (isIndexField(property.$.Name)) {
          return 'VARCHAR(255)'
        }
        return 'TEXT'
      }
      const maxLength = parseInt(property.$.MaxLength, 10)

      // Below, we handle a problem where we turn some fields from VARCHAR into TEXT. But we shouldn't do that for key
      // fields.
      // TODO: Ideally these fields would come from the metadata, but since they'll change rarely this should be good
      // enough for now.
      if (isIndexField(property.$.Name)) {
        return `VARCHAR(${maxLength})`
      }

      if (maxLength > 255) {
        return 'TEXT'
      }
      return `VARCHAR(${maxLength})`
    } else if (type.startsWith('Collection(')) {
      return 'TEXT'
    } else if (type === 'Edm.Decimal') {
      // I haven't encountered this before but the metadata right now has this in the Property resource:
      // <Property Name="BathroomsTotalDecimal" Type="Edm.Decimal"/>
      // So let's force it to have a precision of 14 and scale of 2, which is what they seem to do for most other
      // decimal fields.
      let precision = property.$.Precision
      if (!property.$.Precision) {
        precision = 14
      }
      let scale = property.$.Scale
      if (!property.$.Scale) {
        scale = 2
      } else if (scale === 'variable') {
        scale = 3
      }
      return 'DECIMAL(' + precision + ', ' + scale + ')'
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
