// This doesn't necessarily need to be in its own file. It's just big and I wanted it out of the way, at least
// temporarily.

function getIndexes(mlsResource) {
  let indexes = {}
  if (mlsResource === 'Property') {
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
  } else if (mlsResource === 'Media') {
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
  } else if (mlsResource === 'Member') {
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
  } else if (mlsResource === 'Office') {
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
  } else if (mlsResource === 'CustomProperty') {
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
  } else if (mlsResource === 'OpenHouse') {
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
  } else if (mlsResource === 'PropertyRooms') {
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
  } else if (mlsResource === 'TeamMembers') {
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
  } else if (mlsResource === 'Teams') {
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
    throw new Error('Unknown MLS resource: ' + mlsResource)
  }
  return indexes
}

module.exports = {
  getIndexes,
}
