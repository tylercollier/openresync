const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const SyncResource = require('./SyncResource')

class SyncDestination extends BaseModel {
  static get tableName() {
    return 'ors_sync_destinations'
  }

  static get relationMappings() {
    return {
      resource: {
        relation: Model.BelongsToOneRelation,
        modelClass: SyncResource,
        join: {
          from: 'ors_sync_destinations.sync_resources_id',
          to: 'ors_sync_resources.id',
        },
      },
    }
  }
}

module.exports = SyncDestination
