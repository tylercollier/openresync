const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const SyncResource = require('./SyncResource')

class SyncSource extends BaseModel {
  static get tableName() {
    return 'ors_sync_sources'
  }

  static get relationMappings() {
    return {
      resources: {
        relation: Model.HasManyRelation,
        modelClass: SyncResource,
        join: {
          from: 'ors_sync_sources.id',
          to: 'ors_sync_resources.sync_sources_id',
        },
      },
    }
  }
}

module.exports = SyncSource
