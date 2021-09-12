const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const ReconcileResource = require('./ReconcileResource')

class ReconcileSource extends BaseModel {
  static get tableName() {
    return 'ors_reconcile_sources'
  }

  static get relationMappings() {
    return {
      resources: {
        relation: Model.HasManyRelation,
        modelClass: ReconcileResource,
        join: {
          from: 'ors_reconcile_sources.id',
          to: 'ors_reconcile_resources.reconcile_sources_id',
        },
      },
    }
  }
}

module.exports = ReconcileSource
