const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const SyncSource = require('./SyncSource')
const SyncDestination = require('./SyncDestination')

class SyncResource extends BaseModel {
  static get tableName() {
    return 'ors_sync_resources'
  }

  static get relationMappings() {
    return {
      source: {
        relation: Model.BelongsToOneRelation,
        modelClass: SyncSource,
        join: {
          from: 'ors_sync_resources.sync_sources_id',
          to: 'ors_sync_sources.id',
        },
      },
      destinations: {
        relation: Model.HasManyRelation,
        modelClass: SyncDestination,
        join: {
          from: 'ors_sync_resources.id',
          to: 'ors_sync_destinations.sync_resources_id',
        },
      },
    }
  }
}

module.exports = SyncResource
