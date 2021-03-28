const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const PurgeResource = require('./PurgeResource')

class PurgeSource extends BaseModel {
  static get tableName() {
    return 'ors_purge_sources'
  }

  static get relationMappings() {
    return {
      resources: {
        relation: Model.HasManyRelation,
        modelClass: PurgeResource,
        join: {
          from: 'ors_purge_sources.id',
          to: 'ors_purge_resources.purge_sources_id',
        },
      },
    }
  }
}

module.exports = PurgeSource
