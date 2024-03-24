function getIndexes(mlsResourceName) {
  let indexes = {}
  if (mlsResourceName === 'Property') {
    indexes = {
      ListingKey: {
        fields: ['ListingKeyNumeric'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      PhotosChangeTimestamp: {
        fields: ['PhotosChangeTimestamp'],
        isUpdateTimestamp: true,
        nullable: true,
      },
    }
  } else if (mlsResourceName === 'Media') {
    indexes = {
      MediaKey: {
        fields: ['MediaKeyNumeric'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else if (mlsResourceName === 'Member') {
    indexes = {
      MemberKey: {
        fields: ['MemberKeyNumeric'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else if (mlsResourceName === 'Office') {
    indexes = {
      OfficeKey: {
        fields: ['OfficeKeyNumeric'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else if (mlsResourceName === 'OpenHouse') {
    indexes = {
      OpenHouseKey: {
        fields: ['OpenHouseKeyNumeric'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      ListingId: { fields: ['ListingId'] },
      ListingKeyNumeric: { fields: ['ListingKey'] },
      OpenHouseId: { fields: ['OpenHouseId'] },
    }
  } else if (mlsResourceName === 'VirtualOpenHouse') {
    indexes = {
      OpenHouseKey: {
        fields: ['OpenHouseKeyNumeric'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      ListingId: { fields: ['ListingId'] },
      ListingKeyNumeric: { fields: ['ListingKey'] },
      OpenHouseId: { fields: ['OpenHouseId'] },
    }
  } else {
    throw new Error('Unknown MLS resource: ' + mlsResourceName)
  }
  return indexes
}

module.exports = {
  getIndexes,
}
