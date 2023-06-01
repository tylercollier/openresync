function getIndexes(mlsResourceName) {
  let indexes = {}
  if (mlsResourceName === 'Property') {
    indexes = {
      ListingKey: {
        fields: ['ListingKey'],
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
        fields: ['MediaKey'],
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
        fields: ['MemberKey'],
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
        fields: ['OfficeKey'],
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
        fields: ['OpenHouseKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      ListingId: { fields: ['ListingId'] },
      ListingKey: { fields: ['ListingKey'] },
      OpenHouseId: { fields: ['OpenHouseId'] },
    }
  } else if (mlsResourceName === 'Room') {
    indexes = {
      RoomKey: {
        fields: ['RoomKey'],
        isPrimary: true,
      },
    }
  } else if (mlsResourceName === 'Unit') {
    indexes = {
      UnitTypeKey: {
        fields: ['UnitTypeKey'],
        isPrimary: true,
      },
    }
  } else if (mlsResourceName === 'Lookup') {
    indexes = {
      LookupKey: {
        fields: ['LookupKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
    }
  } else {
    throw new Error('Unknown MLS resource: ' + mlsResourceName)
  }
  return indexes
}

module.exports = {
  getIndexes,
}
