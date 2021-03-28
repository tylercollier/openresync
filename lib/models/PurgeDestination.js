const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const PurgeResource = require('./PurgeResource')

class PurgeDestination extends BaseModel {
  static get tableName() {
    return 'ors_purge_destinations'
  }

  static get relationMappings() {
    return {
      resource: {
        relation: Model.BelongsToOneRelation,
        modelClass: PurgeResource,
        join: {
          from: 'ors_purge_destinations.purge_resources_id',
          to: 'ors_purge_resources.id',
        },
      },
    }
  }
}

module.exports = PurgeDestination
