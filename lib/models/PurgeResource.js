const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const PurgeSource = require('./PurgeSource')
const PurgeDestination = require('./PurgeDestination')

class PurgeResource extends BaseModel {
  static get tableName() {
    return 'ors_purge_resources'
  }

  static get relationMappings() {
    return {
      source: {
        relation: Model.BelongsToOneRelation,
        modelClass: PurgeSource,
        join: {
          from: 'ors_purge_resources.purge_sources_id',
          to: 'ors_purge_sources.id',
        },
      },
      destinations: {
        relation: Model.HasManyRelation,
        modelClass: PurgeDestination,
        join: {
          from: 'ors_purge_resources.id',
          to: 'ors_purge_destinations.purge_resources_id',
        },
      },
    }
  }
}

module.exports = PurgeResource
