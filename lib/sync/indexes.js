// This doesn't necessarily need to be in its own file. It's just big and I wanted it out of the way, at least
// temporarily.

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
      MediaModificationTimestamp: {
        fields: ['MediaModificationTimestamp'],
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
  } else if (mlsResourceName === 'CustomProperty') {
    indexes = {
      ListingKey: {
        fields: ['ListingKey'],
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
  } else if (mlsResourceName === 'PropertyRooms') {
    indexes = {
      RoomKey: {
        fields: ['RoomKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      ListingId: { fields: ['ListingId'] },
      ListingKey: { fields: ['ListingKey'] },
    }
  } else if (mlsResourceName === 'TeamMembers') {
    indexes = {
      TeamMemberKey: {
        fields: ['TeamMemberKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      MemberKey: { fields: ['MemberKey'] },
      MemberMlsId: { fields: ['MemberMlsId'] },
      TeamKey: { fields: ['TeamKey'] },
    }
  } else if (mlsResourceName === 'Teams') {
    indexes = {
      TeamKey: {
        fields: ['TeamKey'],
        isPrimary: true,
      },
      ModificationTimestamp: {
        fields: ['ModificationTimestamp'],
        isUpdateTimestamp: true,
      },
      TeamLeadKey: { fields: ['TeamLeadKey'] },
      TeamLeadMlsId: { fields: ['TeamLeadMlsId'] },
    }
  } else {
    throw new Error('Unknown MLS resource: ' + mlsResourceName)
  }
  return indexes
}

module.exports = {
  getIndexes,
}
