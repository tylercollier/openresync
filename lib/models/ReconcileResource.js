const { Model } = require('objection')
const BaseModel = require('./BaseModel')
const ReconcileSource = require('./ReconcileSource')
const ReconcileDestination = require('./ReconcileDestination')

class ReconcileResource extends BaseModel {
  static get tableName() {
    return 'ors_reconcile_resources'
  }

  static get relationMappings() {
    return {
      source: {
        relation: Model.BelongsToOneRelation,
        modelClass: ReconcileSource,
        join: {
          from: 'ors_reconcile_resources.reconcile_sources_id',
          to: 'ors_reconcile_sources.id',
        },
      },
      destinations: {
        relation: Model.HasManyRelation,
        modelClass: ReconcileDestination,
        join: {
          from: 'ors_reconcile_resources.id',
          to: 'ors_reconcile_destinations.reconcile_resources_id',
        },
      },
    }
  }
}

module.exports = ReconcileResource
